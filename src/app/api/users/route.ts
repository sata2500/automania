import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { requireAdmin, setSessionCookie } from '@/lib/auth-server';

// Ensure table exists on first request
async function ensureUsersTable() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        role VARCHAR(50) DEFAULT 'user',
        status VARCHAR(50) DEFAULT 'active',
        provider VARCHAR(50) DEFAULT 'google',
        avatar_url VARCHAR(1000),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_login_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    // Note: First admin must be seeded via: npm run seed-admin
  } catch (err) {}
}

export async function GET() {
  try {
    // SECURITY FIX: Only allow admins to list users
    const adminSession = await requireAdmin();
    if (!adminSession) {
      return NextResponse.json({ success: false, users: [], message: 'Yetkisiz erişim.' }, { status: 403 });
    }

    await ensureUsersTable();
    const rows = await sql`
      SELECT id, name, email, role, status, provider, avatar_url as "avatarUrl", created_at as "createdAt"
      FROM users
      ORDER BY created_at DESC
    `;
    return NextResponse.json({ success: true, users: rows });
  } catch (error: any) {
    return NextResponse.json({ success: false, users: [] }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await ensureUsersTable();
    const body = await request.json();
    const { action, id, name, email, role, status, provider, avatarUrl } = body;

    // Secure actions (update role, block user)
    if (action === 'update_role' || action === 'toggle_status') {
      // SECURITY FIX: Use secure JWT session to verify admin instead of trusting callerEmail from body
      const adminSession = await requireAdmin();
      if (!adminSession) {
        return NextResponse.json({ success: false, message: 'Bu işlem için admin yetkisi gerekiyor.' }, { status: 403 });
      }

      if (action === 'update_role' && id && role) {
        await sql`UPDATE users SET role = ${role} WHERE id = ${id}`;
        return NextResponse.json({ success: true, message: 'Rol güncellendi.' });
      }

      if (action === 'toggle_status' && id && status) {
        await sql`UPDATE users SET status = ${status} WHERE id = ${id}`;
        return NextResponse.json({ success: true, message: 'Erişim durumu güncellendi.' });
      }
    }

    // Default action: Login Upsert (used primarily for Demo login and initial session sync)
    if (email) {
      const cleanEmail = email.toLowerCase().trim();
      const userId = id || 'user-' + btoa(cleanEmail).replace(/=/g, '').toLowerCase();
      const userName = name || cleanEmail.split('@')[0];
      // Role is always driven by the database — no hardcoded email checks.
      // New users always start as 'user'. Promotion to admin is done via the Admin Dashboard.
      const userRole: 'admin' | 'user' = 'user';
      const userProvider = provider || 'google';

      // Check existing status
      const existing = await sql`SELECT role, status, avatar_url FROM users WHERE email = ${cleanEmail}`;
      
      let finalRole = userRole;
      let finalAvatar = avatarUrl;
      
      if (existing.length > 0) {
        if (existing[0].status === 'blocked') {
          return NextResponse.json(
            { success: false, blocked: true, message: 'Bu hesap yönetici tarafından engellenmiştir.' },
            { status: 403 }
          );
        }
        finalRole = existing[0].role;
        finalAvatar = avatarUrl || existing[0].avatar_url;

        await sql`
          UPDATE users
          SET last_login_at = CURRENT_TIMESTAMP, name = ${userName}, avatar_url = ${finalAvatar}
          WHERE email = ${cleanEmail}
        `;
      } else {
        await sql`
          INSERT INTO users (id, name, email, role, status, provider, avatar_url)
          VALUES (${userId}, ${userName}, ${cleanEmail}, ${userRole}, 'active', ${userProvider}, ${finalAvatar || null})
        `;
      }

      const userProfile = {
        id: userId,
        name: userName,
        email: cleanEmail,
        role: finalRole,
        status: 'active' as const,
        provider: userProvider,
        avatarUrl: finalAvatar || null,
      };

      // Issue a secure HTTP-only JWT session cookie
      await setSessionCookie(userProfile);

      return NextResponse.json({
        success: true,
        user: userProfile,
      });
    }

    return NextResponse.json({ success: false, message: 'Geçersiz parametreler.' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    await ensureUsersTable();
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('id');

    // SECURITY FIX: Verify real admin JWT token
    const adminSession = await requireAdmin();
    if (!adminSession) {
      return NextResponse.json({ success: false, message: 'Bu işlem için admin yetkisi gerekiyor.' }, { status: 403 });
    }

    if (userId) {
      await sql`DELETE FROM users WHERE id = ${userId}`;
      return NextResponse.json({ success: true, message: 'Kullanıcı silindi.' });
    }

    return NextResponse.json({ success: false, message: 'ID eksik.' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

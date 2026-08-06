import { NextResponse } from 'next/server';
import sql from '@/lib/db';

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
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_login_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    await sql`
      INSERT INTO users (id, name, email, role, status, provider)
      VALUES ('user-demo-101', 'Salih TANRISEVEN', 'salihtanriseven25@gmail.com', 'admin', 'active', 'google')
      ON CONFLICT (email) DO NOTHING
    `;
  } catch (err) {
    console.error('Error ensuring users table:', err);
  }
}

export async function GET() {
  try {
    await ensureUsersTable();
    const rows = await sql`
      SELECT id, name, email, role, status, provider, created_at as "createdAt"
      FROM users
      ORDER BY created_at DESC
    `;
    return NextResponse.json({ success: true, users: rows });
  } catch (error: any) {
    console.error('GET /api/users error:', error);
    return NextResponse.json({ success: false, users: [] }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await ensureUsersTable();
    const body = await request.json();
    const { action, id, name, email, role, status, provider } = body;

    if (action === 'update_role' && id && role) {
      await sql`UPDATE users SET role = ${role} WHERE id = ${id}`;
      return NextResponse.json({ success: true, message: 'Rol güncellendi.' });
    }

    if (action === 'toggle_status' && id && status) {
      await sql`UPDATE users SET status = ${status} WHERE id = ${id}`;
      return NextResponse.json({ success: true, message: 'Erişim durumu güncellendi.' });
    }

    // Default action: Login Upsert
    if (email) {
      const cleanEmail = email.toLowerCase().trim();
      const userId = id || 'user-' + btoa(cleanEmail).replace(/=/g, '').toLowerCase();
      const userName = name || cleanEmail.split('@')[0];
      const userRole = cleanEmail === 'salihtanriseven25@gmail.com' ? 'admin' : (role || 'user');
      const userProvider = provider || 'google';

      // Check existing status
      const existing = await sql`SELECT role, status FROM users WHERE email = ${cleanEmail}`;
      if (existing.length > 0) {
        if (existing[0].status === 'blocked') {
          return NextResponse.json(
            { success: false, blocked: true, message: 'Bu hesap yönetici tarafından engellenmiştir.' },
            { status: 403 }
          );
        }

        await sql`
          UPDATE users
          SET last_login_at = CURRENT_TIMESTAMP, name = ${userName}
          WHERE email = ${cleanEmail}
        `;

        return NextResponse.json({
          success: true,
          user: {
            id: userId,
            name: userName,
            email: cleanEmail,
            role: existing[0].role,
            status: existing[0].status,
            provider: userProvider,
          },
        });
      }

      // Insert new user
      await sql`
        INSERT INTO users (id, name, email, role, status, provider)
        VALUES (${userId}, ${userName}, ${cleanEmail}, ${userRole}, 'active', ${userProvider})
      `;

      return NextResponse.json({
        success: true,
        user: {
          id: userId,
          name: userName,
          email: cleanEmail,
          role: userRole,
          status: 'active',
          provider: userProvider,
        },
      });
    }

    return NextResponse.json({ success: false, message: 'Görünmeyen parametre.' }, { status: 400 });
  } catch (error: any) {
    console.error('POST /api/users error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    await ensureUsersTable();
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('id');

    if (userId) {
      await sql`DELETE FROM users WHERE id = ${userId}`;
      return NextResponse.json({ success: true, message: 'Kullanıcı silindi.' });
    }

    return NextResponse.json({ success: false, message: 'ID eksik.' }, { status: 400 });
  } catch (error: any) {
    console.error('DELETE /api/users error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

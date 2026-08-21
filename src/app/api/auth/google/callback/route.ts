import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { setSessionCookie } from '@/lib/auth-server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  if (error || !code) {
    return NextResponse.redirect(`${origin}/?auth_error=${encodeURIComponent(error || 'Oturum açılamadı.')}`);
  }

  try {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = `${origin}/api/auth/google/callback`;

    // 1. Exchange authorization code for access token
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId || '',
        client_secret: clientSecret || '',
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    const tokenData = await tokenRes.json();

    if (!tokenRes.ok || !tokenData.access_token) {
      console.error('[Google OAuth] Token exchange failed:', tokenRes.status);
      return NextResponse.redirect(`${origin}/?auth_error=Token+alınamadı`);
    }

    // 2. Fetch User Profile from Google API
    const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    const userData = await userRes.json();

    if (!userRes.ok || !userData.email) {
      return NextResponse.redirect(`${origin}/?auth_error=Kullanıcı+bilgisi+alınamadı`);
    }

    const cleanEmail = userData.email.toLowerCase().trim();
    const userId = 'user-' + btoa(cleanEmail).replace(/=/g, '').toLowerCase();
    const userName = userData.name || cleanEmail.split('@')[0];
    const avatarUrl = userData.picture || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(cleanEmail)}`;
    
    // Ensure table exists
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
    } catch(e) {}

    // Role is always driven by the database — no hardcoded email checks.
    let userRole: 'admin' | 'user' = 'user';
    let userStatus = 'active';

    // Check existing record to preserve role and status
    const existing = await sql`SELECT role, status FROM users WHERE email = ${cleanEmail}`;
    if (existing.length > 0) {
      if (existing[0].status === 'blocked') {
        return NextResponse.redirect(`${origin}/?auth_error=Hesabınız+yönetici+tarafından+engellenmiştir.`);
      }
      // Preserve existing role from DB (may have been promoted to admin)
      userRole = existing[0].role as 'admin' | 'user';
      userStatus = existing[0].status;

      await sql`
        UPDATE users
        SET last_login_at = CURRENT_TIMESTAMP, name = ${userName}, avatar_url = ${avatarUrl}
        WHERE email = ${cleanEmail}
      `;
    } else {
      // New user — always starts as 'user', admins promote via dashboard
      await sql`
        INSERT INTO users (id, name, email, role, status, provider, avatar_url)
        VALUES (${userId}, ${userName}, ${cleanEmail}, 'user', 'active', 'google', ${avatarUrl})
      `;
    }

    const userProfile = {
      id: userId,
      name: userName,
      email: cleanEmail,
      avatarUrl: avatarUrl,
      provider: 'google',
      role: userRole,
    };

    // Set secure HTTP-only JWT cookie
    await setSessionCookie(userProfile);

    // 3. Return HTML script to save session in localStorage and redirect back to homepage
    const profileJson = JSON.stringify(userProfile);
    const html = `
      <!DOCTYPE html>
      <html>
        <head><title>Giriş Yapılıyor...</title></head>
        <body style="background:#020617;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;">
          <div style="text-align:center;">
            <h2>Google ile Giriş Başarılı!</h2>
            <p>Oturumunuz açılıyor, lütfen bekleyin...</p>
          </div>
          <script>
            try {
              localStorage.setItem('automania_pod_user_session', ${JSON.stringify(profileJson)});
            } catch(e){}
            window.location.href = '${origin}';
          </script>
        </body>
      </html>
    `;

    return new NextResponse(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  } catch (err: any) {
    console.error('Google Callback Exception:', err);
    return NextResponse.redirect(`${origin}/?auth_error=${encodeURIComponent(err?.message || 'Bilinmeyen hata')}`);
  }
}

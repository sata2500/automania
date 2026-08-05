import { NextResponse } from 'next/server';

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
      console.error('Google Token Exchange Error:', tokenData);
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

    const userProfile = {
      id: 'user-' + btoa(userData.email).replace(/=/g, '').toLowerCase(),
      name: userData.name || userData.email.split('@')[0],
      email: userData.email,
      avatarUrl: userData.picture || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(userData.email)}`,
      provider: 'google',
    };

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

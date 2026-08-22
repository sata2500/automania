import { NextResponse } from 'next/server';
import crypto from 'crypto';
import sql from '@/lib/db';
import { getAuthoritativeSession } from '@/lib/auth-server';
import { getCanonicalAppOrigin } from '@/lib/oauth-origin';

export async function GET(req: Request) {
  try {
    const session = await getAuthoritativeSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);

    // 1. Fetch Etsy Keystring from global app_settings
    const settingsRows = await sql`
      SELECT setting_value 
      FROM app_settings 
      WHERE setting_key = 'etsy_keystring'
    `;
    const etsyApiKey = settingsRows[0]?.setting_value || process.env.ETSY_API_KEY;

    if (!etsyApiKey) {
      return NextResponse.json({ 
        success: false, 
        error: 'Etsy App Keystring is not configured in Admin Dashboard.' 
      }, { status: 400 });
    }

    // 2. Generate PKCE values
    // Using base64url encoding as required by OAuth 2.0 PKCE spec (RFC 7636)
    const codeVerifier = crypto.randomBytes(32).toString('base64url');
    const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
    
    // Generate a random state string to prevent CSRF
    const state = crypto.randomBytes(16).toString('hex');

    // 3. Save verifier and state to database to check during callback
    await sql`
      UPDATE user_workspaces 
      SET 
        etsy_pkce_verifier = ${codeVerifier},
        etsy_pkce_state = ${state},
        updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ${session.id}
    `;

    // 4. Construct Authorization URL
    const scopes = ['listings_r', 'listings_w', 'shops_r', 'profile_r'].join(' ');
    
    // We need an absolute URL for redirect_uri.
    const redirectUri = `${getCanonicalAppOrigin(req.url, process.env.NEXT_PUBLIC_APP_URL)}/api/etsy/callback`;

    const authUrl = new URL('https://www.etsy.com/oauth/connect');
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('client_id', etsyApiKey);
    authUrl.searchParams.append('redirect_uri', redirectUri);
    authUrl.searchParams.append('scope', scopes);
    authUrl.searchParams.append('state', state);
    authUrl.searchParams.append('code_challenge', codeChallenge);
    authUrl.searchParams.append('code_challenge_method', 'S256');

    // Create response and set returnUrl cookie
    const response = NextResponse.redirect(authUrl.toString());
    const returnUrl = searchParams.get('returnUrl') || '/';
    response.cookies.set('etsy_return_to', returnUrl, { path: '/', maxAge: 600 });

    return response;

  } catch (error: any) {
    console.error('Etsy Auth Route Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

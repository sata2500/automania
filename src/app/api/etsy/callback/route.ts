import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth-server';

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    const returnUrl = req.cookies.get('etsy_return_to')?.value || '/admin';
    const getRedirectUrl = (query: string) => {
      const targetUrl = new URL(returnUrl, req.url);
      const [key, val] = query.split('=');
      targetUrl.searchParams.set(key, val);
      return targetUrl;
    };

    if (error) {
      return NextResponse.redirect(getRedirectUrl(`etsy_error=${error}`));
    }

    if (!code || !state) {
      return NextResponse.redirect(getRedirectUrl(`etsy_error=missing_params`));
    }

    // 1. Fetch user's saved PKCE state and verifier
    const workspaceRows = await sql`
      SELECT etsy_pkce_state, etsy_pkce_verifier 
      FROM user_workspaces 
      WHERE user_id = ${session.id}
    `;

    if (workspaceRows.length === 0) {
      return NextResponse.redirect(getRedirectUrl(`etsy_error=workspace_not_found`));
    }

    const { etsy_pkce_state, etsy_pkce_verifier } = workspaceRows[0];

    // 2. Validate state to prevent CSRF
    if (state !== etsy_pkce_state) {
      return NextResponse.redirect(getRedirectUrl(`etsy_error=invalid_state`));
    }

    // 3. Fetch Etsy Keystring & Shared Secret from global app_settings
    const settingsRows = await sql`
      SELECT setting_key, setting_value 
      FROM app_settings 
      WHERE setting_key IN ('etsy_keystring', 'etsy_shared_secret')
    `;
    let etsyApiKey = process.env.ETSY_API_KEY;
    let etsySharedSecret = process.env.ETSY_SHARED_SECRET;
    for (const row of settingsRows) {
      if (row.setting_key === 'etsy_keystring') etsyApiKey = row.setting_value;
      if (row.setting_key === 'etsy_shared_secret') etsySharedSecret = row.setting_value;
    }

    if (!etsyApiKey) {
      return NextResponse.redirect(getRedirectUrl(`etsy_error=missing_api_key`));
    }

    const url = new URL(req.url);
    const redirectUri = `${url.protocol}//${url.host}/api/etsy/callback`;

    // 4. Exchange authorization code for access token
    const tokenRes = await fetch('https://api.etsy.com/v3/public/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: etsyApiKey,
        redirect_uri: redirectUri,
        code: code,
        code_verifier: etsy_pkce_verifier
      })
    });

    if (!tokenRes.ok) {
      const errorText = await tokenRes.text();
      console.error("Etsy Token Exchange Error:", errorText);
      return NextResponse.redirect(getRedirectUrl(`etsy_error=token_exchange_failed`));
    }

    const tokenData = await tokenRes.json();
    const { access_token, refresh_token, expires_in } = tokenData;

    // Calculate expiration timestamp
    const expiresAt = new Date(Date.now() + expires_in * 1000);

    // 5. Fetch User's Shop ID using the new access token
    const etsyUserId = access_token.split('.')[0];
    
    let shopId = null;
    if (etsyUserId) {
      const meRes = await fetch(`https://openapi.etsy.com/v3/application/users/${etsyUserId}/shops`, {
        method: 'GET',
        headers: {
          'x-api-key': `${etsyApiKey}:${etsySharedSecret || ''}`,
          'Authorization': `Bearer ${access_token}`
        }
      });

      if (meRes.ok) {
        const meData = await meRes.json();
        shopId = meData.shop_id || (meData.results && meData.results[0]?.shop_id) || null;
      } else {
        console.warn("Failed to fetch shop ID:", await meRes.text());
      }
    }

    // 6. Save tokens and shop_id to database
    await sql`
      UPDATE user_workspaces 
      SET 
        etsy_access_token = ${access_token},
        etsy_refresh_token = ${refresh_token},
        etsy_token_expires_at = ${expiresAt.toISOString()},
        etsy_shop_id = ${shopId},
        updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ${session.id}
    `;

    // 7. Redirect back with success flag
    const response = NextResponse.redirect(getRedirectUrl(`etsy_success=true`));
    
    // Clear the cookie
    response.cookies.delete('etsy_return_to');
    
    return response;

  } catch (error: any) {
    console.error('Etsy Callback Route Error:', error);
    // Fallback to absolute admin path if cookies or request URL fail
    return NextResponse.redirect(new URL(`/admin?etsy_error=internal_error`, req.url));
  }
}

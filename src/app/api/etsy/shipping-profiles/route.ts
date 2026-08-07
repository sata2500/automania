import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { getSession } from '@/lib/auth-server';

export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // 1. Fetch User's Etsy Credentials
    const workspaceRows = await sql`
      SELECT etsy_access_token, etsy_shop_id 
      FROM user_workspaces 
      WHERE user_id = ${session.id}
    `;

    if (workspaceRows.length === 0 || !workspaceRows[0].etsy_access_token || !workspaceRows[0].etsy_shop_id) {
      return NextResponse.json({ success: false, connected: false, error: 'Etsy hesabı bağlı değil.' }, { status: 400 });
    }

    const { etsy_access_token, etsy_shop_id } = workspaceRows[0];

    // 2. Fetch Etsy Keystring & Shared Secret from global app_settings
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
      return NextResponse.json({ success: false, connected: false, error: 'API Anahtarı eksik.' }, { status: 400 });
    }

    // 3. Call Etsy API to get shipping profiles
    const profilesRes = await fetch(`https://openapi.etsy.com/v3/application/shops/${etsy_shop_id}/shipping-profiles`, {
      method: 'GET',
      headers: {
        'x-api-key': `${etsyApiKey}:${etsySharedSecret || ''}`,
        'Authorization': `Bearer ${etsy_access_token}`
      }
    });

    if (!profilesRes.ok) {
      const errText = await profilesRes.text();
      if (profilesRes.status === 401) {
        return NextResponse.json({ success: false, connected: false, error: 'Oturum süresi dolmuş. Lütfen tekrar bağlanın.' }, { status: 401 });
      }
      throw new Error(`Etsy API Error: ${errText}`);
    }

    const data = await profilesRes.json();

    // 4. Call Etsy API to get readiness states (Processing Profiles)
    let readinessStates = [];
    try {
      const readinessRes = await fetch(`https://openapi.etsy.com/v3/application/shops/${etsy_shop_id}/readiness-state-definitions`, {
        method: 'GET',
        headers: {
          'x-api-key': `${etsyApiKey}:${etsySharedSecret || ''}`,
          'Authorization': `Bearer ${etsy_access_token}`
        }
      });
      if (readinessRes.ok) {
        const readinessData = await readinessRes.json();
        readinessStates = readinessData.results || [];
      }
    } catch (e) {
      console.warn("Could not fetch readiness states:", e);
    }
    
    return NextResponse.json({ 
      success: true, 
      connected: true,
      profiles: data.results || [],
      readinessStates
    });

  } catch (error: any) {
    console.error('Etsy Shipping Profiles Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

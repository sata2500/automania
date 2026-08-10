import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { getSession } from '@/lib/auth-server';
import { getValidEtsyToken } from '@/lib/etsy-token-manager';

export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const tokenRes = await getValidEtsyToken(session.id);
    if (!tokenRes.success) {
      return NextResponse.json({ success: false, connected: false, error: tokenRes.error }, { status: tokenRes.error?.includes('dolmuş') ? 401 : 400 });
    }

    const { access_token: etsy_access_token, shop_id: etsy_shop_id, api_key: etsyApiKey, shared_secret: etsySharedSecret } = tokenRes;

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

import { NextResponse } from 'next/server';
import { getAuthoritativeSession } from '@/lib/auth-server';
import { getValidEtsyToken } from '@/lib/etsy-token-manager';

export async function GET(req: Request) {
  try {
    const session = await getAuthoritativeSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const tokenRes = await getValidEtsyToken(session.id);
    if (!tokenRes.success) {
      return NextResponse.json({ success: false, connected: false, error: tokenRes.error }, { status: 401 });
    }

    const { access_token: etsy_access_token, shop_id: etsy_shop_id, api_key: etsyApiKey, shared_secret: etsySharedSecret } = tokenRes;

    const policyRes = await fetch(`https://openapi.etsy.com/v3/application/shops/${etsy_shop_id}/policies/return`, {
      method: 'GET',
      headers: {
        'x-api-key': `${etsyApiKey}:${etsySharedSecret || ''}`,
        'Authorization': `Bearer ${etsy_access_token}`
      }
    });

    if (!policyRes.ok) {
      const errText = await policyRes.text();
      return NextResponse.json({ success: false, error: `Etsy Return Policies API Error: ${errText}` }, { status: 400 });
    }

    const data = await policyRes.json();
    return NextResponse.json({ success: true, returnPolicies: data.results || [] });
  } catch (error: any) {
    console.error('Etsy Return Policies Fetch Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

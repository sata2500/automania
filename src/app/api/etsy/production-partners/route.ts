import { getErrorMessage } from '@/lib/errors';
import { NextResponse } from 'next/server';
import { getAuthoritativeSession } from '@/lib/auth-server';
import { getValidEtsyToken } from '@/lib/etsy-token-manager';

export async function GET(_req: Request) {
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

    const partnersRes = await fetch(`https://openapi.etsy.com/v3/application/shops/${etsy_shop_id}/production-partners`, {
      method: 'GET',
      headers: {
        'x-api-key': `${etsyApiKey}:${etsySharedSecret || ''}`,
        'Authorization': `Bearer ${etsy_access_token}`
      }
    });

    if (!partnersRes.ok) {
      const errText = await partnersRes.text();
      return NextResponse.json({ success: false, error: `Etsy Production Partners API Error: ${errText}` }, { status: 400 });
    }

    const data = await partnersRes.json();
    return NextResponse.json({ success: true, partners: data.results || [] });
  } catch (error) {
    console.error('Etsy Production Partners Fetch Error:', error);
    return NextResponse.json({ success: false, error: getErrorMessage(error) }, { status: 500 });
  }
}

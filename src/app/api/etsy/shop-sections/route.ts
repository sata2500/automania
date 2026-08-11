import { NextResponse } from 'next/server';
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
      return NextResponse.json({ success: false, connected: false, error: tokenRes.error }, { status: 401 });
    }

    const { access_token: etsy_access_token, shop_id: etsy_shop_id, api_key: etsyApiKey, shared_secret: etsySharedSecret } = tokenRes;

    const sectionsRes = await fetch(`https://openapi.etsy.com/v3/application/shops/${etsy_shop_id}/sections`, {
      method: 'GET',
      headers: {
        'x-api-key': `${etsyApiKey}:${etsySharedSecret || ''}`,
        'Authorization': `Bearer ${etsy_access_token}`
      }
    });

    if (!sectionsRes.ok) {
      const errText = await sectionsRes.text();
      return NextResponse.json({ success: false, error: `Etsy Sections API Error: ${errText}` }, { status: 400 });
    }

    const data = await sectionsRes.json();
    return NextResponse.json({ success: true, sections: data.results || [] });
  } catch (error: any) {
    console.error('Etsy Shop Sections Fetch Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

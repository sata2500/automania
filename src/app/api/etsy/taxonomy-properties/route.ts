import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth-server';
import { getValidEtsyToken } from '@/lib/etsy-token-manager';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const taxonomy_id = searchParams.get('taxonomy_id');

    if (!taxonomy_id) {
      return NextResponse.json({ success: false, error: 'taxonomy_id is required' }, { status: 400 });
    }

    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const tokenRes = await getValidEtsyToken(session.id);
    if (!tokenRes.success) {
      return NextResponse.json({ success: false, connected: false, error: tokenRes.error }, { status: 401 });
    }

    const { access_token: etsy_access_token, api_key: etsyApiKey, shared_secret: etsySharedSecret } = tokenRes;

    const propertiesRes = await fetch(`https://openapi.etsy.com/v3/application/seller-taxonomy/nodes/${taxonomy_id}/properties`, {
      method: 'GET',
      headers: {
        'x-api-key': `${etsyApiKey}:${etsySharedSecret || ''}`,
        'Authorization': `Bearer ${etsy_access_token}`
      }
    });

    if (!propertiesRes.ok) {
      const errText = await propertiesRes.text();
      return NextResponse.json({ success: false, error: `Etsy Taxonomy Properties API Error: ${errText}` }, { status: 400 });
    }

    const data = await propertiesRes.json();
    return NextResponse.json({ success: true, properties: data.results || [] });
  } catch (error: any) {
    console.error('Etsy Taxonomy Properties Fetch Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

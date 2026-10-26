import { NextResponse } from 'next/server';
import { getAuthoritativeSession } from '@/lib/auth-server';
import { getValidEtsyToken } from '@/lib/etsy-token-manager';
import { fetchTaxonomyProperties } from '@/lib/etsy-taxonomy-properties';

export async function GET(req: Request) {
  try {
    const session = await getAuthoritativeSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const taxonomy_id = searchParams.get('taxonomy_id');

    if (!taxonomy_id) {
      return NextResponse.json({ success: false, error: 'taxonomy_id is required' }, { status: 400 });
    }

    const tokenRes = await getValidEtsyToken(session.id);
    if (!tokenRes.success) {
      return NextResponse.json({ success: false, connected: false, error: tokenRes.error }, { status: 401 });
    }

    const { access_token: etsy_access_token, api_key: etsyApiKey, shared_secret: etsySharedSecret } = tokenRes;

    if (!etsyApiKey || !etsy_access_token) {
      return NextResponse.json({ success: false, error: 'Etsy API anahtarı bulunamadı.' }, { status: 400 });
    }
    let properties;
    try {
      properties = await fetchTaxonomyProperties({ apiKey: etsyApiKey, sharedSecret: etsySharedSecret, accessToken: etsy_access_token }, Number(taxonomy_id));
    } catch (error) {
      return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Etsy kategori özellikleri alınamadı.' }, { status: 400 });
    }
    return NextResponse.json({ success: true, properties });
  } catch (error: unknown) {
    console.error('Etsy Taxonomy Properties Fetch Error:', error instanceof Error ? error.message : 'unknown error');
    return NextResponse.json({ success: false, error: 'Etsy taxonomy özellikleri alınamadı.' }, { status: 500 });
  }
}

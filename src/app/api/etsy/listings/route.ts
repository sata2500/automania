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

    const { searchParams } = new URL(req.url);
    const listingId = searchParams.get('listing_id');

    const tokenRes = await getValidEtsyToken(session.id);
    if (!tokenRes.success) {
      return NextResponse.json({ success: false, error: tokenRes.error }, { status: tokenRes.error?.includes('dolmuş') ? 401 : 400 });
    }

    const { access_token: etsy_access_token, shop_id: etsy_shop_id, api_key: etsyApiKey, shared_secret: etsySharedSecret } = tokenRes;

    const headers = {
      'x-api-key': `${etsyApiKey}:${etsySharedSecret || ''}`,
      'Authorization': `Bearer ${etsy_access_token}`
    };

    // 3. If listing_id is provided, fetch inventory for that listing
    if (listingId) {
      const invRes = await fetch(`https://openapi.etsy.com/v3/application/listings/${listingId}/inventory`, {
        method: 'GET',
        headers
      });

      if (!invRes.ok) {
        throw new Error(`Inventory fetch failed: ${await invRes.text()}`);
      }

      const invData = await invRes.json();
      return NextResponse.json({ success: true, inventory: invData });
    }

    // 4. Otherwise, fetch shop listings (draft + active)
    const activeRes = await fetch(`https://openapi.etsy.com/v3/application/shops/${etsy_shop_id}/listings?state=active&limit=25`, { headers });
    const draftRes = await fetch(`https://openapi.etsy.com/v3/application/shops/${etsy_shop_id}/listings?state=draft&limit=25`, { headers });
    
    let listings = [];
    if (activeRes.ok) {
      const aData = await activeRes.json();
      if (aData.results) listings.push(...aData.results);
    }
    if (draftRes.ok) {
      const dData = await draftRes.json();
      if (dData.results) listings.push(...dData.results);
    }

    // Sort by most recently updated
    listings.sort((a, b) => b.updated_timestamp - a.updated_timestamp);

    return NextResponse.json({ success: true, listings });

  } catch (error: any) {
    console.error('Etsy Listings Fetch Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

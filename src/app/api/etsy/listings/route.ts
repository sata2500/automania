import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { getSession } from '@/lib/auth-server';

export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const listingId = searchParams.get('listing_id');

    // 1. Fetch User's Etsy Credentials
    const workspaceRows = await sql`
      SELECT etsy_access_token, etsy_shop_id 
      FROM user_workspaces 
      WHERE user_id = ${session.id}
    `;

    if (workspaceRows.length === 0 || !workspaceRows[0].etsy_access_token || !workspaceRows[0].etsy_shop_id) {
      return NextResponse.json({ success: false, error: 'Etsy hesabı bağlı değil.' }, { status: 400 });
    }

    const { etsy_access_token, etsy_shop_id } = workspaceRows[0];

    // 2. Fetch Etsy Keystring & Shared Secret
    const settingsRows = await sql`SELECT setting_key, setting_value FROM app_settings WHERE setting_key IN ('etsy_keystring', 'etsy_shared_secret')`;
    let etsyApiKey = process.env.ETSY_API_KEY;
    let etsySharedSecret = process.env.ETSY_SHARED_SECRET;
    for (const row of settingsRows) {
      if (row.setting_key === 'etsy_keystring') etsyApiKey = row.setting_value;
      if (row.setting_key === 'etsy_shared_secret') etsySharedSecret = row.setting_value;
    }

    if (!etsyApiKey) {
      return NextResponse.json({ success: false, error: 'API Anahtarı eksik.' }, { status: 400 });
    }

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

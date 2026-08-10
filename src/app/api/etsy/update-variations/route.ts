import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { getSession } from '@/lib/auth-server';
import { getValidEtsyToken } from '@/lib/etsy-token-manager';

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { listingIds, variations } = body;

    if (!Array.isArray(listingIds) || listingIds.length === 0) {
      return NextResponse.json({ success: false, error: 'En az bir ilan ID si gereklidir.' }, { status: 400 });
    }

    if (!Array.isArray(variations) || variations.length === 0) {
      return NextResponse.json({ success: false, error: 'Uygulanacak varyasyonlar eksik.' }, { status: 400 });
    }

    const tokenRes = await getValidEtsyToken(session.id);
    if (!tokenRes.success) {
      return NextResponse.json({ success: false, error: tokenRes.error }, { status: tokenRes.error?.includes('dolmuş') ? 401 : 400 });
    }

    const { access_token: etsy_access_token, shop_id: etsy_shop_id, api_key: etsyApiKey, shared_secret: etsySharedSecret } = tokenRes;

    const headers = {
      'x-api-key': `${etsyApiKey}:${etsySharedSecret || ''}`,
      'Authorization': `Bearer ${etsy_access_token}`,
      'Content-Type': 'application/json',
    };

    // Determine which properties are actually used across all variations
    let hasSize = false;
    let hasColor = false;
    for (const v of variations) {
      if (v.size && v.size !== 'N/A') hasSize = true;
      if (v.color && v.color !== 'N/A') hasColor = true;
    }

    const usedProperties = [];
    if (hasSize) usedProperties.push(513); // 513 is custom property 1
    if (hasColor) usedProperties.push(514); // 514 is custom property 2

    // Format the payload based on our known structure
    const productsPayload = variations.map((v: any, idx: number) => {
      // Create properties dynamically based on size/color presence
      const propertyValues = [];
      if (hasSize) {
        propertyValues.push({ property_id: 513, property_name: 'Size', values: [v.size && v.size !== 'N/A' ? v.size : 'One Size'] });
      }
      if (hasColor) {
        propertyValues.push({ property_id: 514, property_name: 'Color', values: [v.color && v.color !== 'N/A' ? v.color : 'Default'] });
      }

      return {
        ...(v.sku ? { sku: v.sku } : {}),
        property_values: propertyValues,
        offerings: [
          {
            price: v.price || 0,
            quantity: v.quantity || 0,
            is_enabled: v.enabled !== false,
          }
        ]
      };
    });

    const results = [];

    // Loop through each listing and push
    for (const listingId of listingIds) {
      try {
        // First, fetch the existing inventory to get the readiness_state_id
        let readiness_state_id = undefined;
        try {
          const invGetRes = await fetch(`https://openapi.etsy.com/v3/application/listings/${listingId}/inventory`, {
            method: 'GET',
            headers
          });
          if (invGetRes.ok) {
            const currentInv = await invGetRes.json();
            if (currentInv.products && currentInv.products.length > 0 && currentInv.products[0].offerings && currentInv.products[0].offerings.length > 0) {
              readiness_state_id = currentInv.products[0].offerings[0].readiness_state_id;
            }
          }
        } catch (e) {
          console.warn('Failed to fetch existing inventory for', listingId);
        }

        // Apply readiness_state_id to the offerings
        const updatedProductsPayload = productsPayload.map(p => ({
          ...p,
          offerings: p.offerings.map(o => ({
            ...o,
            ...(readiness_state_id !== undefined ? { readiness_state_id } : {})
          }))
        }));

        const payload = { 
          products: updatedProductsPayload,
          price_on_property: usedProperties,
          quantity_on_property: usedProperties,
          sku_on_property: usedProperties
        };

        const invRes = await fetch(`https://openapi.etsy.com/v3/application/listings/${listingId}/inventory`, {
          method: 'PUT',
          headers,
          body: JSON.stringify(payload)
        });

        if (invRes.ok) {
          results.push({ listingId, success: true });
        } else {
          const errText = await invRes.text();
          console.warn(`Update failed for ${listingId}:`, errText);
          results.push({ listingId, success: false, error: errText });
        }
      } catch (e: any) {
        results.push({ listingId, success: false, error: e.message });
      }
    }

    return NextResponse.json({ success: true, results });

  } catch (error: any) {
    console.error('Etsy Bulk Update Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

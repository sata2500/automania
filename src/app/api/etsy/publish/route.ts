import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { getSession } from '@/lib/auth-server';

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { 
      title, 
      description, 
      tags, 
      price = 24.99, 
      quantity = 999, 
      variations = [], 
      images = [],
      shipping_profile_id,
      readiness_state_id,
      state = 'draft' // 'draft' or 'active'
    } = body;

    if (!title || !description || !tags || !Array.isArray(tags)) {
      return NextResponse.json({ success: false, error: 'Başlık, açıklama ve etiketler zorunludur.' }, { status: 400 });
    }

    // Enforce 13 tag & 20 char limit
    const validTags = tags.map((t: string) => t.trim()).filter((t: string) => t.length > 0 && t.length <= 20).slice(0, 13);

    // Fetch Global Settings
    const settingsRows = await sql`SELECT setting_key, setting_value FROM app_settings WHERE setting_key IN ('etsy_keystring', 'etsy_shared_secret')`;
    let etsyApiKey = process.env.ETSY_API_KEY;
    let etsySharedSecret = process.env.ETSY_SHARED_SECRET;
    for (const row of settingsRows) {
      if (row.setting_key === 'etsy_keystring') etsyApiKey = row.setting_value;
      if (row.setting_key === 'etsy_shared_secret') etsySharedSecret = row.setting_value;
    }

    // Fetch Etsy Store Credentials from Workspace Settings
    const workspaceRows = await sql`
      SELECT etsy_access_token, etsy_shop_id 
      FROM user_workspaces 
      WHERE user_id = ${session.id} 
    `;

    const etsyAccessToken = workspaceRows[0]?.etsy_access_token || process.env.ETSY_ACCESS_TOKEN;
    const etsyShopId = workspaceRows[0]?.etsy_shop_id || process.env.ETSY_SHOP_ID;

    // If Etsy OAuth is not connected yet, return a clean simulated draft preview
    if (!etsyAccessToken || !etsyShopId) {
      return NextResponse.json({
        success: true,
        simulated: true,
        message: 'Etsy Mağaza Bağlantısı Henüz Tamamlanmadı. Oluşturulan İlan İçeriği ve Varyasyon Tablosu Yayına Hazır!',
        draftPreview: {
          title: title.slice(0, 140),
          description,
          tags: validTags,
          price,
          quantity,
          variationsCount: variations.length,
          state
        }
      });
    }

    // Call Official Etsy API v3 createDraftListing endpoint
    const createRes = await fetch(`https://openapi.etsy.com/v3/application/shops/${etsyShopId}/listings`, {
      method: 'POST',
      headers: {
        'x-api-key': `${etsyApiKey}:${etsySharedSecret || ''}`,
        'Authorization': `Bearer ${etsyAccessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        quantity,
        title: title.slice(0, 140),
        description,
        price,
        who_made: 'i_did',
        when_made: '2020_2026',
        taxonomy_id: 1081, // Clothing -> Shirts & Tees -> T-Shirts
        tags: validTags,
        shipping_profile_id,
        readiness_state_id,
        type: 'physical',
        is_customizable: true,
        state
      })
    });

    if (!createRes.ok) {
      const errText = await createRes.text();
      throw new Error(`Etsy API Hatası (${createRes.status}): ${errText}`);
    }

    const listingData = await createRes.json();
    const listingId = listingData.listing_id;

    // If variations are provided, update inventory matrix via PUT /v3/application/listings/{listing_id}/inventory
    let variationsUpdated = false;
    if (listingId && Array.isArray(variations) && variations.length > 0) {
      try {
        const productsPayload = variations.map((v: any, idx: number) => ({
          ...(v.sku ? { sku: v.sku } : {}),
          property_values: [
            { property_id: 504, property_name: 'Size', values: [v.size || 'M'] },
            { property_id: 489, property_name: 'Color', values: [v.color || 'Black'] }
          ],
          offerings: [
            {
              price: v.price || price,
              quantity: v.quantity || quantity,
              is_enabled: true,
              readiness_state_id: readiness_state_id
            }
          ]
        }));

        const invRes = await fetch(`https://openapi.etsy.com/v3/application/listings/${listingId}/inventory`, {
          method: 'PUT',
          headers: {
            'x-api-key': `${etsyApiKey}:${etsySharedSecret || ''}`,
            'Authorization': `Bearer ${etsyAccessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ products: productsPayload })
        });

        if (invRes.ok) {
          variationsUpdated = true;
        }
      } catch (e: any) {
        console.warn('Etsy Variations update warning:', e.message);
      }
    }

    // Upload images if provided
    let imagesUploaded = 0;
    if (listingId && Array.isArray(images) && images.length > 0) {
      for (const imgUrl of images) {
        try {
          let blob: Blob;
          let filename = `mockup-${Date.now()}.png`;

          if (imgUrl.startsWith('data:image')) {
            const base64Data = imgUrl.split(',')[1];
            const buffer = Buffer.from(base64Data, 'base64');
            blob = new Blob([buffer], { type: 'image/png' });
          } else if (imgUrl.startsWith('http')) {
            const response = await fetch(imgUrl);
            blob = await response.blob();
            const ext = blob.type.split('/')[1] || 'webp';
            filename = `mockup-${Date.now()}.${ext}`;
          } else {
            continue;
          }
          
          const formData = new FormData();
          formData.append('image', blob, filename);
          formData.append('rank', String(imagesUploaded + 1));

          const imgRes = await fetch(`https://openapi.etsy.com/v3/application/shops/${etsyShopId}/listings/${listingId}/images`, {
            method: 'POST',
            headers: {
              'x-api-key': `${etsyApiKey}:${etsySharedSecret || ''}`,
              'Authorization': `Bearer ${etsyAccessToken}`,
            },
            body: formData
          });

          if (imgRes.ok) {
            imagesUploaded++;
          } else {
            console.warn('Image upload failed:', await imgRes.text());
          }
        } catch (imgErr) {
          console.warn('Image upload error:', imgErr);
        }
      }
    }

    return NextResponse.json({
      success: true,
      listingId,
      listingUrl: listingData.url || `https://www.etsy.com/listing/${listingId}`,
      variationsUpdated,
      imagesUploaded,
      message: `İlan Etsy Mağazanıza (${state.toUpperCase()}) olarak aktarıldı!`
    });

  } catch (error: any) {
    console.error('Etsy Publish API Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

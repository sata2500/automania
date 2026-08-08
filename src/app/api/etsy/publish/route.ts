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
    const uploadErrors: string[] = [];
    if (listingId && Array.isArray(images) && images.length > 0) {
      let mediaIndex = 0;
      for (const imgUrl of images) {
        mediaIndex++;
        try {
          let blob: Blob;
          const uniqueId = `${Date.now()}-${mediaIndex}-${Math.random().toString(36).substring(7)}`;
          let filename = `media-${uniqueId}.png`;
          let isVideo = false;

          if (imgUrl.startsWith('data:video')) {
            isVideo = true;
            const base64Data = imgUrl.split(',')[1];
            const buffer = Buffer.from(base64Data, 'base64');
            const mimeType = imgUrl.split(';')[0].split(':')[1] || 'video/mp4';
            blob = new Blob([buffer], { type: mimeType });
            filename = `video-${uniqueId}.mp4`;
          } else if (imgUrl.startsWith('data:image')) {
            const base64Data = imgUrl.split(',')[1];
            const buffer = Buffer.from(base64Data, 'base64');
            const mimeType = imgUrl.split(';')[0].split(':')[1] || 'image/png';
            blob = new Blob([buffer], { type: mimeType });
            filename = `mockup-${uniqueId}.png`;
          } else if (imgUrl.startsWith('http')) {
            const response = await fetch(imgUrl);
            blob = await response.blob();
            if (blob.type.startsWith('video')) {
              isVideo = true;
            }
            const ext = blob.type.split('/')[1] || (isVideo ? 'mp4' : 'webp');
            filename = isVideo ? `video-${uniqueId}.${ext}` : `mockup-${uniqueId}.${ext}`;
          } else {
            continue;
          }
          
          const endpoint = isVideo 
            ? `https://openapi.etsy.com/v3/application/shops/${etsyShopId}/listings/${listingId}/videos`
            : `https://openapi.etsy.com/v3/application/shops/${etsyShopId}/listings/${listingId}/images`;

          const formData = new FormData();
          formData.append(isVideo ? 'video' : 'image', blob, filename);
          if (!isVideo) {
            formData.append('rank', String(imagesUploaded + 1));
          } else {
            formData.append('name', filename);
          }

          const mediaRes = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'x-api-key': `${etsyApiKey}:${etsySharedSecret || ''}`,
              'Authorization': `Bearer ${etsyAccessToken}`,
            },
            body: formData
          });

          if (mediaRes.ok) {
            const successData = await mediaRes.json();
            console.log(`[Etsy Upload] ${isVideo ? 'Video' : 'Image'} uploaded successfully. Filename: ${filename}. Response:`, successData);
            if (!isVideo) imagesUploaded++;
          } else {
            const errorText = await mediaRes.text();
            console.warn(`[Etsy Upload] Media upload failed for ${filename}. Status: ${mediaRes.status}, Error:`, errorText);
            uploadErrors.push(`Format: ${isVideo ? 'Video' : 'Image'}, Error: ${errorText}`);
          }
          
          // Etsy rate limiting or processing delay for videos
          if (isVideo) {
            console.log(`[Etsy Upload] Waiting 2 seconds after video upload...`);
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        } catch (imgErr: any) {
          console.warn(`[Etsy Upload] Media upload error for mediaIndex ${mediaIndex}:`, imgErr);
          uploadErrors.push(`Upload exception: ${imgErr.message}`);
        }
      }
    }

    return NextResponse.json({
      success: true,
      listingId,
      listingUrl: listingData.url || `https://www.etsy.com/listing/${listingId}`,
      variationsUpdated,
      imagesUploaded,
      uploadErrors: uploadErrors.length > 0 ? uploadErrors : undefined,
      message: `İlan Etsy Mağazanıza (${state.toUpperCase()}) olarak aktarıldı!`
    });

  } catch (error: any) {
    console.error('Etsy Publish API Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

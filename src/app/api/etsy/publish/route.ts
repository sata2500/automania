import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { getSession } from '@/lib/auth-server';
import { getValidEtsyToken } from '@/lib/etsy-token-manager';

export const maxDuration = 60;

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

    const tokenRes = await getValidEtsyToken(session.id);
    const etsyAccessToken = tokenRes.access_token || process.env.ETSY_ACCESS_TOKEN;
    const etsyShopId = tokenRes.shop_id || process.env.ETSY_SHOP_ID;
    let etsyApiKey = tokenRes.api_key || process.env.ETSY_API_KEY;
    let etsySharedSecret = tokenRes.shared_secret || process.env.ETSY_SHARED_SECRET;

    // If Etsy OAuth is not connected yet, return a clean simulated draft preview
    if (!tokenRes.success && (!etsyAccessToken || !etsyShopId)) {
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

    // Upload images/videos if provided
    // Accept both old format (array of URL strings) and new format (array of {url, isVideo} objects)
    let imagesUploaded = 0;
    const uploadErrors: string[] = [];
    
    // Separate images and videos — videos go to /videos endpoint, images to /images endpoint
    const imageItems: string[] = [];
    const videoItems: string[] = [];

    if (listingId && Array.isArray(images) && images.length > 0) {
      for (const item of images) {
        if (typeof item === 'string') {
          // Legacy: guess from URL
          if (item.includes('.mp4') || item.includes('video')) {
            videoItems.push(item);
          } else {
            imageItems.push(item);
          }
        } else if (item && typeof item === 'object') {
          if (item.isVideo) {
            videoItems.push(item.url);
          } else {
            imageItems.push(item.url);
          }
        }
      }
    }

    console.log(`[Etsy Upload] Total: ${images.length} items. Images: ${imageItems.length}, Videos: ${videoItems.length}`);

    // Upload images first
    if (listingId && imageItems.length > 0) {
      let imgIndex = 0;
      for (const imgUrl of imageItems) {
        imgIndex++;
        try {
          let blob: Blob;
          const uniqueId = `${Date.now()}-${imgIndex}-${Math.random().toString(36).substring(7)}`;

          if (imgUrl.startsWith('data:image')) {
            const base64Data = imgUrl.split(',')[1];
            const buffer = Buffer.from(base64Data, 'base64');
            const mimeType = imgUrl.split(';')[0].split(':')[1] || 'image/webp';
            blob = new Blob([buffer], { type: mimeType });
          } else if (imgUrl.startsWith('http')) {
            const response = await fetch(imgUrl);
            blob = await response.blob();
          } else {
            continue;
          }

          const ext = blob.type.split('/')[1] || 'webp';
          const filename = `mockup-${uniqueId}.${ext}`;

          const formData = new FormData();
          formData.append('image', blob, filename);
          formData.append('rank', String(imagesUploaded + 1));

          const imgRes = await fetch(
            `https://openapi.etsy.com/v3/application/shops/${etsyShopId}/listings/${listingId}/images`,
            {
              method: 'POST',
              headers: {
                'x-api-key': `${etsyApiKey}:${etsySharedSecret || ''}`,
                'Authorization': `Bearer ${etsyAccessToken}`,
              },
              body: formData,
            }
          );

          if (imgRes.ok) {
            imagesUploaded++;
            console.log(`[Etsy Upload] Image ${imgIndex}/${imageItems.length} uploaded: ${filename}`);
          } else {
            const errText = await imgRes.text();
            console.warn(`[Etsy Upload] Image ${imgIndex} failed (${imgRes.status}): ${errText}`);
            uploadErrors.push(`Image ${imgIndex}: ${errText}`);
          }
        } catch (err: any) {
          console.warn(`[Etsy Upload] Image ${imgIndex} exception:`, err.message);
          uploadErrors.push(`Image ${imgIndex} exception: ${err.message}`);
        }
      }
    }

    // Upload videos sequentially
    // NOTE: Etsy Open API v3 currently supports only 1 video per listing.
    // The UI shows 2 slots but the API /videos endpoint acts as a setter — each call replaces the previous.
    // We upload only the first video. The second can be added manually from the Etsy dashboard.
    const videosToUpload = videoItems.slice(0, 1);
    if (videoItems.length > 1) {
      console.warn(`[Etsy Upload] ${videoItems.length} videos found but Etsy API only supports 1 per listing. Only the first video will be uploaded.`);
      uploadErrors.push(`Bilgi: Etsy API'si şu an ilanlar için yalnızca 1 video desteklemektedir. İkinci videonuzu Etsy panelinden manuel olarak ekleyebilirsiniz.`);
    }

    if (listingId && videosToUpload.length > 0) {
      let vidIndex = 0;
      for (const vidUrl of videosToUpload) {
        vidIndex++;
        try {
          let blob: Blob;
          const uniqueId = `${Date.now()}-vid${vidIndex}-${Math.random().toString(36).substring(7)}`;

          if (vidUrl.startsWith('data:video')) {
            const base64Data = vidUrl.split(',')[1];
            const buffer = Buffer.from(base64Data, 'base64');
            const mimeType = vidUrl.split(';')[0].split(':')[1] || 'video/mp4';
            blob = new Blob([buffer], { type: mimeType });
          } else if (vidUrl.startsWith('http')) {
            const response = await fetch(vidUrl);
            blob = await response.blob();
          } else {
            continue;
          }

          const filename = `video-${uniqueId}.mp4`;
          console.log(`[Etsy Upload] Uploading video ${vidIndex}/${videoItems.length}: ${filename}, size: ${blob.size} bytes, type: ${blob.type}`);

          const formData = new FormData();
          formData.append('video', blob, filename);
          formData.append('name', filename);

          const vidRes = await fetch(
            `https://openapi.etsy.com/v3/application/shops/${etsyShopId}/listings/${listingId}/videos`,
            {
              method: 'POST',
              headers: {
                'x-api-key': `${etsyApiKey}:${etsySharedSecret || ''}`,
                'Authorization': `Bearer ${etsyAccessToken}`,
              },
              body: formData,
            }
          );

          if (vidRes.ok) {
            const vidData = await vidRes.json();
            console.log(`[Etsy Upload] Video ${vidIndex} uploaded successfully:`, vidData);
          } else {
            const errText = await vidRes.text();
            console.warn(`[Etsy Upload] Video ${vidIndex} failed (${vidRes.status}): ${errText}`);
            uploadErrors.push(`Video ${vidIndex}: ${errText}`);
          }

          // Always wait 5 seconds between videos to let Etsy finish processing
          if (vidIndex < videoItems.length) {
            console.log(`[Etsy Upload] Waiting 5 seconds before next video...`);
            await new Promise(resolve => setTimeout(resolve, 5000));
          }
        } catch (err: any) {
          console.warn(`[Etsy Upload] Video ${vidIndex} exception:`, err.message);
          uploadErrors.push(`Video ${vidIndex} exception: ${err.message}`);
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

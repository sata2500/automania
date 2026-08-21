import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import sql from '@/lib/db';
import { getAuthoritativeSession } from '@/lib/auth-server';
import { getValidEtsyToken } from '@/lib/etsy-token-manager';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { isR2Configured, getR2Client, getBucketName, extractKeyFromUrlOrKey } from '@/lib/r2';
import { isOwnedUploadName } from '@/lib/upload-security';
import { validateEtsyDraftPreflight } from '@/lib/etsy-preflight';
import { consumeRateLimit } from '@/lib/request-rate-limit';
import { writeAuditLog } from '@/lib/audit-log';

export const maxDuration = 60;
const MAX_PUBLISH_MEDIA_BYTES = 50 * 1024 * 1024;

async function loadMediaBlob(userId: string, urlOrPath: string): Promise<Blob | null> {
  if (!urlOrPath) return null;
  try {
    // 1. Data URL (Base64)
    if (urlOrPath.startsWith('data:')) {
      const parts = urlOrPath.split(',');
      const base64Data = parts[1];
      const buffer = Buffer.from(base64Data, 'base64');
      if (buffer.byteLength > MAX_PUBLISH_MEDIA_BYTES) return null;
      const mimeType = urlOrPath.split(';')[0].split(':')[1] || 'image/png';
      return new Blob([buffer], { type: mimeType });
    }

    // 2. Cloudflare R2 Proxy Path (/api/r2/...) or raw R2 key
    if (urlOrPath.startsWith('/api/r2/') || urlOrPath.startsWith('api/r2/')) {
      const key = extractKeyFromUrlOrKey(urlOrPath);
      if (!key || !isOwnedUploadName(userId, key)) return null;
      if (isR2Configured() && key) {
        try {
          const client = getR2Client();
          const bucket = getBucketName();
          const res = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
          if (res.Body) {
            const bytes = await res.Body.transformToByteArray();
            const ext = path.extname(key).toLowerCase();
            const mimeType = (res.ContentType || (ext === '.png' ? 'image/png' : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : ext === '.mp4' ? 'video/mp4' : 'image/webp')).split(';')[0].trim();
            return new Blob([Buffer.from(bytes)], { type: mimeType });
          }
        } catch (r2Err) {
          console.warn('[Etsy Publish] Direct R2 get failed; local fallback will be attempted.');
        }
      }

      // Local fallback in .data/uploads
      const localFallbackPath = path.join(process.cwd(), '.data', 'uploads', path.basename(key));
      if (fsSync.existsSync(localFallbackPath)) {
        const buffer = await fs.readFile(localFallbackPath);
        const ext = path.extname(key).toLowerCase();
        const mimeType = ext === '.png' ? 'image/png' : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : ext === '.mp4' ? 'video/mp4' : 'image/webp';
        return new Blob([buffer], { type: mimeType });
      }
    }

    // 3. Local Uploads (/api/uploads/...)
    if (urlOrPath.startsWith('/api/uploads/')) {
      const filename = path.basename(decodeURIComponent(urlOrPath.split('?')[0]));
      if (!isOwnedUploadName(userId, filename)) return null;
      const filePath = path.join(process.cwd(), '.data', 'uploads', filename);
      if (fsSync.existsSync(filePath)) {
        const buffer = await fs.readFile(filePath);
        const ext = path.extname(filename).toLowerCase();
        const mimeType = ext === '.png' ? 'image/png' : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : ext === '.mp4' ? 'video/mp4' : 'image/webp';
        return new Blob([buffer], { type: mimeType });
      }
    }

    // 4. Sample Uploads (/sample-uploads/...)
    if (urlOrPath.startsWith('/sample-uploads/')) {
      const rel = urlOrPath.replace('/sample-uploads/', '');
      const sampleRoot = path.resolve(process.cwd(), 'public', 'sample-uploads');
      const filePath = path.resolve(sampleRoot, rel);
      if (!filePath.startsWith(`${sampleRoot}${path.sep}`)) return null;
      if (fsSync.existsSync(filePath)) {
        const buffer = await fs.readFile(filePath);
        const ext = path.extname(rel).toLowerCase();
        const mimeType = ext === '.png' ? 'image/png' : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : ext === '.mp4' ? 'video/mp4' : 'image/webp';
        return new Blob([buffer], { type: mimeType });
      }
    }

    // 5. Generic Local Path (starts with /)
    if (urlOrPath.startsWith('/')) {
      const cleanPath = urlOrPath.split('?')[0];
      const filename = path.basename(cleanPath);
      if (!isOwnedUploadName(userId, filename)) return null;
      
      const dataUploadsPath = path.join(process.cwd(), '.data', 'uploads', filename);
      if (fsSync.existsSync(dataUploadsPath)) {
        const buffer = await fs.readFile(dataUploadsPath);
        const ext = path.extname(filename).toLowerCase();
        const mimeType = ext === '.png' ? 'image/png' : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : ext === '.mp4' ? 'video/mp4' : 'image/webp';
        return new Blob([buffer], { type: mimeType });
      }

      const publicPath = path.join(process.cwd(), 'public', cleanPath.startsWith('/') ? cleanPath.substring(1) : cleanPath);
      if (fsSync.existsSync(publicPath)) {
        const buffer = await fs.readFile(publicPath);
        const ext = path.extname(cleanPath).toLowerCase();
        const mimeType = ext === '.png' ? 'image/png' : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : ext === '.mp4' ? 'video/mp4' : 'image/webp';
        return new Blob([buffer], { type: mimeType });
      }
    }

    // Remote URLs are deliberately rejected: publish should only use user-owned uploads or data URLs.
    if (urlOrPath.startsWith('http://') || urlOrPath.startsWith('https://')) return null;

    // Raw non-URL strings are rejected to avoid ambiguous or attacker-controlled sources.
  } catch (err) {
    console.warn('[Etsy Publish] Failed to load media blob:', err instanceof Error ? err.message : 'unknown error');
  }
  return null;
}

export async function POST(req: Request) {
  try {
    const session = await getAuthoritativeSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const rateLimit = consumeRateLimit(`etsy:publish-draft:${session.id}`, 5, 10 * 60_000);
    if (!rateLimit.allowed) {
      return NextResponse.json({ success: false, error: 'Etsy draft oluşturma limiti aşıldı.' }, {
        status: 429,
        headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) },
      });
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
      state = 'draft',
      taxonomy_id = 1081,
      who_made = 'i_did',
      when_made = 'made_to_order',
      is_supply = false,
      production_partner_id,
      is_customizable = false,
      sku,
      materials = [],
      styles = [],
      shop_section_id,
      return_policy_id,
      should_auto_renew = false,
      taxonomy_properties_values = {}
    } = body;

    if (!title || !description || !tags || !Array.isArray(tags)) {
      return NextResponse.json({ success: false, error: 'Başlık, açıklama ve etiketler zorunludur.' }, { status: 400 });
    }

    const preflightErrors = validateEtsyDraftPreflight({
      state,
      title,
      description,
      tags,
      taxonomyId: taxonomy_id,
      variations,
      images,
    });
    if (preflightErrors.length > 0) {
      return NextResponse.json({ success: false, error: preflightErrors.join(' ') }, { status: 400 });
    }

    const taxonomyId = Number(taxonomy_id);
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

    const taxonomyRows = await sql`SELECT id FROM etsy_taxonomy_cache WHERE id = ${taxonomyId} LIMIT 1`;
    if (taxonomyRows.length === 0) {
      return NextResponse.json({ success: false, error: 'Taxonomy ID doğrulanamadı. Önce Etsy taxonomy senkronizasyonunu çalıştırın.' }, { status: 400 });
    }

    // Validate & Sanitize Etsy Marketplace Fields
    // Etsy allows POD items only when who_made is 'i_did' (you designed it) or when is_supply is true.
    const safeWhoMade = (who_made === 'someone_else' || who_made === 'collective') ? who_made : 'i_did';
    const safeWhenMade = when_made || 'made_to_order';
    const safeIsSupply = Boolean(is_supply);

    // Sanitize production_partner_ids: must be an array of positive numbers or omitted
    let safeProductionPartners: number[] | undefined = undefined;
    if (Array.isArray(production_partner_id)) {
      const validPartners = production_partner_id.map(Number).filter(n => !isNaN(n) && n > 0);
      if (validPartners.length > 0) safeProductionPartners = validPartners;
    } else if (production_partner_id && !isNaN(Number(production_partner_id)) && Number(production_partner_id) > 0) {
      safeProductionPartners = [Number(production_partner_id)];
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
        quantity: Math.max(1, Number(quantity) || 999),
        title: title.slice(0, 140),
        description,
        price: Number(price) || 24.99,
        who_made: safeWhoMade,
        when_made: safeWhenMade,
        taxonomy_id: taxonomyId,
        materials: Array.isArray(materials) 
          ? materials.flatMap((m: string) => (typeof m === 'string' ? m.split(',') : []))
              .map(m => m.replace(/[^a-zA-Z0-9 _\-&+]/g, '').trim().substring(0, 13).trim())
              .filter(Boolean).slice(0, 13) 
          : [],
        styles: Array.isArray(styles) ? styles.slice(0, 2) : [],
        is_supply: safeIsSupply,
        tags: validTags,
        shipping_profile_id: shipping_profile_id ? Number(shipping_profile_id) : undefined,
        readiness_state_id: readiness_state_id ? Number(readiness_state_id) : undefined,
        type: 'physical',
        is_customizable: Boolean(is_customizable),
        production_partner_ids: safeProductionPartners,
        state,
        shop_section_id: shop_section_id ? Number(shop_section_id) : undefined,
        return_policy_id: return_policy_id ? Number(return_policy_id) : undefined,
        should_auto_renew: Boolean(should_auto_renew)
      })
    });

    if (!createRes.ok) {
      await createRes.text();
      throw new Error(`Etsy API Hatası (${createRes.status}).`);
    }

    const listingData = await createRes.json();
    const listingId = listingData.listing_id;

    // Update dynamic taxonomy properties if provided
    let propertiesUpdatedCount = 0;
    const uploadErrors: string[] = [];
    if (listingId && taxonomy_properties_values && Object.keys(taxonomy_properties_values).length > 0) {
      for (const [propId, valueIds] of Object.entries(taxonomy_properties_values)) {
        if (Array.isArray(valueIds) && valueIds.length > 0) {
          try {
            const propRes = await fetch(`https://openapi.etsy.com/v3/application/shops/${etsyShopId}/listings/${listingId}/properties/${propId}`, {
              method: 'PUT',
              headers: {
                'x-api-key': `${etsyApiKey}:${etsySharedSecret || ''}`,
                'Authorization': `Bearer ${etsyAccessToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ value_ids: valueIds, values: [] })
            });
            if (propRes.ok) {
              propertiesUpdatedCount++;
            } else {
              const err = await propRes.text();
              uploadErrors.push(`Özellik hatası (ID: ${propId}): ${err}`);
            }
          } catch (err: any) {
            uploadErrors.push(`Özellik hatası (ID: ${propId}): ${err.message}`);
          }
        }
      }
    }

    // If variations are provided, update inventory matrix via PUT /v3/application/listings/{listing_id}/inventory
    let variationsUpdated = false;
    if (listingId && Array.isArray(variations) && variations.length > 0) {
      try {
        const productsPayload = variations.map((v: any, idx: number) => ({
          ...(v.sku ? { sku: v.sku } : (sku ? { sku: sku } : {})),
          property_values: [
            { property_id: 513, property_name: 'Size', values: [v.size || 'M'] },
            { property_id: 514, property_name: 'Color', values: [v.color || 'Black'] }
          ],
          offerings: [
            {
              price: v.price || price,
              quantity: v.quantity || quantity,
              is_enabled: v.enabled !== false,
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
          body: JSON.stringify({ 
            products: productsPayload,
            price_on_property: [513, 514],
            quantity_on_property: [513, 514],
            sku_on_property: [] // Empty array means SKU is at the listing level, not per variation
          })
        });

        if (invRes.ok) {
          variationsUpdated = true;
        } else {
          const invErr = await invRes.text();
          uploadErrors.push(`Varyasyon hatası: ${invErr}`);
        }
      } catch (err: any) {
        uploadErrors.push(`Varyasyon hatası: ${err.message}`);
      }
    }

    // Upload images/videos if provided
    // Accept both old format (array of URL strings) and new format (array of {url, isVideo} objects)
    let imagesUploaded = 0;
    
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
          const uniqueId = `${Date.now()}-${imgIndex}-${Math.random().toString(36).substring(7)}`;
          const blob = await loadMediaBlob(session.id, imgUrl);

          if (!blob) {
            console.warn(`[Etsy Upload] Image ${imgIndex} could not be loaded.`);
            continue;
          }

          let fileExt = (blob.type.split('/')[1] || 'jpeg').toLowerCase();
          if (fileExt === 'webp') fileExt = 'jpeg';
          const filename = `mockup-${uniqueId}.${fileExt}`;

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
            uploadErrors.push(`Image ${imgIndex}: yükleme başarısız (HTTP ${imgRes.status}).`);
          }
        } catch (err: any) {
          uploadErrors.push(`Image ${imgIndex}: yükleme sırasında beklenmeyen hata.`);
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
          const uniqueId = `${Date.now()}-vid${vidIndex}-${Math.random().toString(36).substring(7)}`;
          const blob = await loadMediaBlob(session.id, vidUrl);

          if (!blob) {
            console.warn(`[Etsy Upload] Video ${vidIndex} could not be loaded.`);
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
            uploadErrors.push(`Video ${vidIndex}: yükleme başarısız (HTTP ${vidRes.status}).`);
          }

          // Always wait 5 seconds between videos to let Etsy finish processing
          if (vidIndex < videoItems.length) {
            console.log(`[Etsy Upload] Waiting 5 seconds before next video...`);
            await new Promise(resolve => setTimeout(resolve, 5000));
          }
        } catch (err: any) {
          uploadErrors.push(`Video ${vidIndex}: yükleme sırasında beklenmeyen hata.`);
        }
      }
    }

    await writeAuditLog({
      userId: session.id,
      action: 'etsy.draft_listing.created',
      resourceType: 'etsy_listing',
      resourceId: listingId ? String(listingId) : undefined,
      metadata: {
        state: 'draft',
        taxonomyId,
        imageCount: imageItems.length,
        videoCount: videoItems.length,
        variationCount: Array.isArray(variations) ? variations.length : 0,
        uploadErrorCount: uploadErrors.length,
      },
    });

    return NextResponse.json({
      success: true,
      listingId,
      listingUrl: listingData.url || `https://www.etsy.com/listing/${listingId}`,
      variationsUpdated,
      imagesUploaded,
      uploadErrors: uploadErrors.length > 0 ? uploadErrors : undefined,
      message: `İlan Etsy Mağazanıza (${state.toUpperCase()}) olarak aktarıldı!`
    });

  } catch (error) {
    console.error('[Etsy Publish] Request failed:', error instanceof Error ? error.message : 'unknown error');
    return NextResponse.json({ success: false, error: 'Etsy taslak aktarımı başarısız oldu.' }, { status: 500 });
  }
}

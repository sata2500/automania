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
import { validateEtsyDraftPreflight, validateWhoMade } from '@/lib/etsy-preflight';
import { etsyFetch, readEtsyError } from '@/lib/etsy-api';
import { sanitizeEtsyTags } from '@/lib/etsy-format';
import { checkRateLimit } from '@/lib/request-rate-limit';
import { writeAuditLog } from '@/lib/audit-log';
import {
  hasExplicitLivePublishConfirmation,
  isLivePublishEnabled,
  resolveEtsyPublishMode,
} from '@/lib/etsy-publish-mode';

// 20 görsel + video + envanter adımları sıralı yapıldığında 60 sn yetmeyebiliyor.
export const maxDuration = 300;
const IMAGE_UPLOAD_CONCURRENCY = 3;
const MAX_PUBLISH_MEDIA_BYTES = 50 * 1024 * 1024;

type EtsyVariationInput = {
  sku?: string;
  size?: string;
  color?: string;
  price?: number | string;
  quantity?: number;
  enabled?: boolean;
};

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
        } catch {
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

/** Etsy görsel yükleme JPG/PNG/GIF kabul eder; WebP gerçekten JPEG'e dönüştürülür (yalnızca uzantı değil). */
async function toEtsyImage(blob: Blob): Promise<{ blob: Blob; ext: string }> {
  const type = blob.type.toLowerCase();
  if (type === 'image/jpeg' || type === 'image/jpg') return { blob, ext: 'jpg' };
  if (type === 'image/png') return { blob, ext: 'png' };
  if (type === 'image/gif') return { blob, ext: 'gif' };
  const sharp = (await import('sharp')).default;
  const jpeg = await sharp(Buffer.from(await blob.arrayBuffer())).flatten({ background: '#ffffff' }).jpeg({ quality: 92 }).toBuffer();
  return { blob: new Blob([new Uint8Array(jpeg)], { type: 'image/jpeg' }), ext: 'jpg' };
}

export async function POST(req: Request) {
  try {
    const session = await getAuthoritativeSession();
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
      state: requestedState,
      publishMode: requestedPublishMode,
      confirmLivePublish,
      confirmationPhrase,
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

    const state = resolveEtsyPublishMode({
      publishMode: requestedPublishMode,
      state: requestedState,
    });
    if (!state) {
      return NextResponse.json({ success: false, error: 'Geçersiz Etsy yayınlama modu.' }, { status: 400 });
    }

    if (state === 'active') {
      if (!isLivePublishEnabled(process.env.ETSY_LIVE_PUBLISH_ENABLED)) {
        return NextResponse.json({
          success: false,
          error: 'Canlı Etsy yayınlama bu sunucuda devre dışıdır.',
        }, { status: 403 });
      }
      if (!hasExplicitLivePublishConfirmation({ confirmLivePublish, confirmationPhrase })) {
        return NextResponse.json({
          success: false,
          error: 'Canlı yayın için açık kullanıcı onayı gereklidir.',
        }, { status: 400 });
      }
    }

    const rateLimit = await checkRateLimit(
      `etsy:publish:${state}:${session.id}`,
      state === 'active' ? 2 : 5,
      state === 'active' ? 30 * 60_000 : 10 * 60_000,
    );
    if (!rateLimit.allowed) {
      return NextResponse.json({
        success: false,
        error: state === 'active' ? 'Canlı Etsy yayınlama limiti aşıldı.' : 'Etsy draft oluşturma limiti aşıldı.',
      }, {
        status: 429,
        headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) },
      });
    }

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
    }, {
      allowActive: state === 'active',
      requirePhoto: state === 'active',
    });
    if (preflightErrors.length > 0) {
      return NextResponse.json({ success: false, error: preflightErrors.join(' ') }, { status: 400 });
    }

    const whoMadeError = validateWhoMade({ whoMade: who_made, isSupply: is_supply, whenMade: when_made });
    if (whoMadeError) {
      return NextResponse.json({ success: false, error: whoMadeError }, { status: 400 });
    }

    const taxonomyId = Number(taxonomy_id);
    // Etsy'nin karakter kurallarına uymayan etiketler (ör. & veya virgül) tüm isteği bozar.
    const validTags = sanitizeEtsyTags(tags);
    if (validTags.length === 0) {
      return NextResponse.json({ success: false, error: 'Geçerli en az bir etiket gerekiyor (en fazla 20 karakter; harf, rakam, boşluk, - ve \').' }, { status: 400 });
    }

    // Yalnızca isteği yapan kullanıcının kendi Etsy bağlantısı kullanılır. Ortamdaki genel
    // bir token'a düşmek, bağlantısı olmayan kullanıcıların başka bir mağazaya ilan açmasına yol açardı.
    const tokenRes = await getValidEtsyToken(session.id);
    const etsyAccessToken = tokenRes.success ? tokenRes.access_token : undefined;
    const etsyShopId = tokenRes.success ? tokenRes.shop_id : undefined;
    const etsyApiKey = tokenRes.api_key || process.env.ETSY_API_KEY;
    const etsySharedSecret = tokenRes.shared_secret || process.env.ETSY_SHARED_SECRET;

    // Draft preview is safe without OAuth; live publication must never be simulated.
    if (!etsyAccessToken || !etsyShopId) {
      if (state === 'active') {
        return NextResponse.json({
          success: false,
          error: 'Canlı yayın için doğrulanmış Etsy mağaza bağlantısı gereklidir.',
        }, { status: 412 });
      }
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

    const safeMaterials = Array.isArray(materials)
      ? materials.flatMap((m: string) => (typeof m === 'string' ? m.split(',') : []))
          .map((m) => m.replace(/[^a-zA-Z0-9 _\-&+]/g, '').trim().substring(0, 13).trim())
          .filter(Boolean)
          .slice(0, 13)
      : [];
    const safeStyles = Array.isArray(styles)
      ? styles.filter((style: unknown): style is string => typeof style === 'string' && style.trim().length > 0).slice(0, 2)
      : [];

    // Etsy's createDraftListing endpoint accepts application/x-www-form-urlencoded.
    // Arrays are encoded as repeated fields, except tags which Etsy documents as
    // a comma-separated list.
    const createBody = new URLSearchParams({
      quantity: String(Math.max(1, Number(quantity) || 999)),
      title: title.slice(0, 140),
      description,
      price: String(Number(price) || 24.99),
      who_made: safeWhoMade,
      when_made: safeWhenMade,
      taxonomy_id: String(taxonomyId),
      tags: validTags.join(','),
      is_supply: String(safeIsSupply),
      type: 'physical',
      is_customizable: String(Boolean(is_customizable)),
      should_auto_renew: String(Boolean(should_auto_renew)),
    });
    for (const material of safeMaterials) createBody.append('materials', material);
    for (const style of safeStyles) createBody.append('styles', style);
    for (const partnerId of safeProductionPartners || []) createBody.append('production_partner_ids', String(partnerId));
    if (shipping_profile_id) createBody.set('shipping_profile_id', String(Number(shipping_profile_id)));
    if (readiness_state_id) createBody.set('readiness_state_id', String(Number(readiness_state_id)));
    if (shop_section_id) createBody.set('shop_section_id', String(Number(shop_section_id)));
    if (return_policy_id) createBody.set('return_policy_id', String(Number(return_policy_id)));

    // Call Official Etsy API v3 createDraftListing endpoint.
    const createRes = await etsyFetch(`https://openapi.etsy.com/v3/application/shops/${etsyShopId}/listings`, {
      method: 'POST',
      headers: {
        'x-api-key': `${etsyApiKey}:${etsySharedSecret || ''}`,
        'Authorization': `Bearer ${etsyAccessToken}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: createBody,
    });

    if (!createRes.ok) {
      // Etsy'nin hata metni (ör. geçersiz alan) kullanıcıya iletilir; "HTTP 400" tek başına çözüm göstermez.
      const message = await readEtsyError(createRes, 'Etsy ilan taslağını oluşturmayı reddetti');
      console.warn('[Etsy Publish]', message);
      return NextResponse.json({ success: false, draftCreated: false, error: message }, { status: createRes.status === 429 ? 429 : 502 });
    }

    const listingData = await createRes.json();
    const listingId = listingData.listing_id;

    // Update dynamic taxonomy properties if provided
    const uploadErrors: string[] = [];
    if (listingId && taxonomy_properties_values && Object.keys(taxonomy_properties_values).length > 0) {
      for (const [propId, valueIds] of Object.entries(taxonomy_properties_values)) {
        if (Array.isArray(valueIds) && valueIds.length > 0) {
          try {
            const propRes = await etsyFetch(`https://openapi.etsy.com/v3/application/shops/${etsyShopId}/listings/${listingId}/properties/${propId}`, {
              method: 'PUT',
              headers: {
                'x-api-key': `${etsyApiKey}:${etsySharedSecret || ''}`,
                'Authorization': `Bearer ${etsyAccessToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ value_ids: valueIds, values: [] })
            });
            if (!propRes.ok) {
              uploadErrors.push(await readEtsyError(propRes, `Kategori özelliği kaydedilemedi (ID: ${propId})`));
            }
          } catch (err: unknown) {
            uploadErrors.push(`Özellik hatası (ID: ${propId}): ${err instanceof Error ? err.message : 'unknown error'}`);
          }
        }
      }
    }

    // If variations are provided, update inventory matrix via PUT /v3/application/listings/{listing_id}/inventory
    let variationsUpdated = false;
    if (listingId && Array.isArray(variations) && variations.length > 0) {
      try {
        const productsPayload = (variations as EtsyVariationInput[]).map((v) => ({
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

        const invRes = await etsyFetch(`https://openapi.etsy.com/v3/application/listings/${listingId}/inventory`, {
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
          uploadErrors.push(await readEtsyError(invRes, 'Varyasyonlar (envanter) kaydedilemedi'));
        }
      } catch (err: unknown) {
        uploadErrors.push(`Varyasyon hatası: ${err instanceof Error ? err.message : 'unknown error'}`);
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

    // Upload images (sınırlı eşzamanlılıkla; `rank` sırayı korur). Yüklenemeyen her görsel hataya yazılır —
    // sessizce atlanan görsel, ilanın eksik görselle "başarılı" sayılmasına yol açar.
    if (listingId && imageItems.length > 0) {
      const queue = imageItems.map((url, index) => ({ url, rank: index + 1 }));
      const worker = async () => {
        for (let next = queue.shift(); next; next = queue.shift()) {
          const { url: imgUrl, rank } = next;
          try {
            const loaded = await loadMediaBlob(session.id, imgUrl);
            if (!loaded) {
              uploadErrors.push(`Görsel ${rank}: dosya okunamadı (silinmiş veya erişilemiyor).`);
              continue;
            }
            const { blob, ext } = await toEtsyImage(loaded);
            const formData = new FormData();
            formData.append('image', blob, `mockup-${listingId}-${rank}.${ext}`);
            formData.append('rank', String(rank));

            const imgRes = await etsyFetch(
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
            } else {
              uploadErrors.push(await readEtsyError(imgRes, `Görsel ${rank} yüklenemedi`));
            }
          } catch (uploadError) {
            uploadErrors.push(`Görsel ${rank}: yükleme sırasında beklenmeyen hata (${uploadError instanceof Error ? uploadError.message : 'bilinmiyor'}).`);
          }
        }
      };
      await Promise.all(Array.from({ length: Math.min(IMAGE_UPLOAD_CONCURRENCY, queue.length) }, worker));
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
            uploadErrors.push(`Video ${vidIndex}: dosya okunamadı (silinmiş veya erişilemiyor).`);
            continue;
          }

          const filename = `video-${uniqueId}.mp4`;
          console.log(`[Etsy Upload] Uploading video ${vidIndex}/${videoItems.length}: ${filename}, size: ${blob.size} bytes, type: ${blob.type}`);

          const formData = new FormData();
          formData.append('video', blob, filename);
          formData.append('name', filename);

          const vidRes = await etsyFetch(
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
            uploadErrors.push(await readEtsyError(vidRes, `Video ${vidIndex} yüklenemedi`));
          }
        } catch {
          uploadErrors.push(`Video ${vidIndex}: yükleme sırasında beklenmeyen hata.`);
        }
      }
    }

    let activated = false;
    if (state === 'active') {
      const blockingUploadErrors = uploadErrors.filter((error) => !error.startsWith('Bilgi:'));
      // Canlı yayın yalnızca gönderilen her görsel yüklendiyse ve hiçbir adım başarısız olmadıysa yapılır.
      if (!listingId || imagesUploaded < 1 || imagesUploaded < imageItems.length || blockingUploadErrors.length > 0) {
        const error = !listingId
          ? 'Etsy listing kimliği alınamadığı için canlı yayın durduruldu.'
          : imagesUploaded < 1
            ? 'Canlı yayın için en az bir görselin Etsy’ye başarıyla yüklenmesi gerekir.'
            : 'Görsel, varyasyon veya kategori adımlarındaki hatalar nedeniyle canlı yayın durduruldu.';
        await writeAuditLog({
          userId: session.id,
          action: 'etsy.listing.publish_blocked',
          resourceType: 'etsy_listing',
          resourceId: listingId ? String(listingId) : undefined,
          metadata: {
            requestedState: state,
            resultingState: 'draft',
            taxonomyId,
            imageCount: imageItems.length,
            imagesUploaded,
            videoCount: videoItems.length,
            variationCount: Array.isArray(variations) ? variations.length : 0,
            uploadErrorCount: uploadErrors.length,
          },
        });
        return NextResponse.json({
          success: false,
          draftCreated: Boolean(listingId),
          listingId,
          state: 'draft',
          error,
          uploadErrors: uploadErrors.length > 0 ? uploadErrors : undefined,
        }, { status: 502 });
      }

      try {
        const activateRes = await etsyFetch(
          `https://openapi.etsy.com/v3/application/shops/${etsyShopId}/listings/${listingId}`,
          {
            method: 'PATCH',
            headers: {
              'x-api-key': `${etsyApiKey}:${etsySharedSecret || ''}`,
              'Authorization': `Bearer ${etsyAccessToken}`,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({ state: 'active' }),
          },
        );

        if (!activateRes.ok) {
          console.warn('[Etsy Publish] Listing activation failed', { status: activateRes.status });
          await writeAuditLog({
            userId: session.id,
            action: 'etsy.listing.publish_failed',
            resourceType: 'etsy_listing',
            resourceId: String(listingId),
            metadata: {
              requestedState: state,
              resultingState: 'draft',
              activationStatus: activateRes.status,
              taxonomyId,
              imageCount: imageItems.length,
              imagesUploaded,
              variationCount: Array.isArray(variations) ? variations.length : 0,
            },
          });
          return NextResponse.json({
            success: false,
            draftCreated: true,
            listingId,
            state: 'draft',
            error: `${await readEtsyError(activateRes, 'İlan taslak olarak oluşturuldu ancak Etsy yayına almayı reddetti')} Taslağı Etsy panelinden kontrol edebilirsiniz.`,
          }, { status: 502 });
        }
        activated = true;
      } catch {
        await writeAuditLog({
          userId: session.id,
          action: 'etsy.listing.publish_failed',
          resourceType: 'etsy_listing',
          resourceId: String(listingId),
          metadata: {
            requestedState: state,
            resultingState: 'draft',
            activationStatus: 'network_error',
            taxonomyId,
            imageCount: imageItems.length,
            imagesUploaded,
            variationCount: Array.isArray(variations) ? variations.length : 0,
          },
        });
        return NextResponse.json({
          success: false,
          draftCreated: true,
          listingId,
          state: 'draft',
          error: 'Listing taslak olarak oluşturuldu ancak canlı yayınlama bağlantısı başarısız oldu.',
        }, { status: 502 });
      }
    }

    const resultingState = activated ? 'active' : 'draft';
    const blockingErrors = uploadErrors.filter((error) => !error.startsWith('Bilgi:'));
    await writeAuditLog({
      userId: session.id,
      action: activated ? 'etsy.listing.published' : 'etsy.draft_listing.created',
      resourceType: 'etsy_listing',
      resourceId: listingId ? String(listingId) : undefined,
      metadata: {
        requestedState: state,
        resultingState,
        taxonomyId,
        imageCount: imageItems.length,
        imagesUploaded,
        videoCount: videoItems.length,
        variationCount: Array.isArray(variations) ? variations.length : 0,
        uploadErrorCount: uploadErrors.length,
      },
    });

    return NextResponse.json({
      success: true,
      listingId,
      state: resultingState,
      listingUrl: listingData.url || `https://www.etsy.com/listing/${listingId}`,
      variationsUpdated,
      imagesUploaded,
      imagesRequested: imageItems.length,
      partial: blockingErrors.length > 0,
      uploadErrors: uploadErrors.length > 0 ? uploadErrors : undefined,
      message: activated
        ? 'İlan Etsy mağazanızda canlı olarak yayınlandı.'
        : blockingErrors.length > 0
          ? `İlan taslak olarak oluşturuldu, ancak ${blockingErrors.length} adım tamamlanamadı (${imagesUploaded}/${imageItems.length} görsel yüklendi). Eksikleri Etsy panelinden tamamlayın.`
          : 'İlan Etsy mağazanıza taslak (DRAFT) olarak aktarıldı.',
    });

  } catch (error) {
    console.error('[Etsy Publish] Request failed:', error instanceof Error ? error.message : 'unknown error');
    return NextResponse.json({ success: false, error: 'Etsy listing aktarımı başarısız oldu.' }, { status: 500 });
  }
}

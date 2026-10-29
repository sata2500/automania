import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import sql from '@/lib/db';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { isR2Configured, getR2Client, getBucketName, extractKeyFromUrlOrKey } from '@/lib/r2';
import { isOwnedUploadName } from '@/lib/upload-security';
import { etsyFetch, readEtsyError } from '@/lib/etsy-api';

/**
 * Etsy'de taslak ilan oluşturma servisi: createDraftListing, kategori özellikleri, envanter (varyasyonlar),
 * görsel ve video yükleme. SEO stüdyosundaki yayın (`/api/etsy/publish`) ve otomasyon hattı aynı kodu kullanır.
 * Canlıya alma kararı çağırana aittir; bu servis yalnızca taslak oluşturur.
 */

// Etsy aynı ilana eşzamanlı görsel yüklemeyi "being edited by another process" (409) ile reddeder.
const IMAGE_UPLOAD_CONCURRENCY = 1;
const ETSY_BUSY_RETRY_DELAYS_MS = [2000, 5000];
const MAX_PUBLISH_MEDIA_BYTES = 50 * 1024 * 1024;

export class EtsyListingError extends Error {
  constructor(message: string, readonly status = 502) {
    super(message);
    this.name = 'EtsyListingError';
  }
}

export type EtsyVariationInput = {
  sku?: string;
  size?: string;
  color?: string;
  price?: number | string;
  quantity?: number;
  enabled?: boolean;
};

export type EtsyCredentials = {
  etsyAccessToken: string;
  etsyShopId: string | number;
  etsyApiKey?: string;
  etsySharedSecret?: string;
};

/** Doğrulanmış ilan alanları (Etsy alan adlarıyla). */
export type EtsyDraftListingInput = {
  title: string;
  description: string;
  validTags: string[];
  price: number | string;
  quantity: number | string;
  taxonomyId: number;
  who_made?: string;
  when_made?: string;
  is_supply?: boolean;
  production_partner_id?: unknown;
  materials?: unknown;
  styles?: unknown;
  is_customizable?: boolean;
  should_auto_renew?: boolean;
  shipping_profile_id?: number | string;
  readiness_state_id?: number | string;
  shop_section_id?: number | string;
  return_policy_id?: number | string;
  sku?: string;
  taxonomy_properties_values?: Record<string, unknown>;
  variations?: EtsyVariationInput[];
  images?: Array<string | { url?: string; isVideo?: boolean; altText?: string }>;
  /** Paketli ürün ağırlığı ve ölçüleri; birimi olmayan değer gönderilmez */
  item_weight?: number;
  item_weight_unit?: 'oz' | 'lb' | 'g' | 'kg';
  item_length?: number;
  item_width?: number;
  item_height?: number;
  item_dimensions_unit?: 'in' | 'cm';
};

/** Etsy görsel alt metni sınırı (Etsy arayüzü 250 karakterde keser). */
const ALT_TEXT_MAX = 250;

export type EtsyDraftListingResult = {
  listingId: number;
  listingUrl: string;
  variationsUpdated: boolean;
  imagesUploaded: number;
  imageItems: string[];
  videoItems: string[];
  uploadErrors: string[];
};

export async function loadMediaBlob(userId: string, urlOrPath: string): Promise<Blob | null> {
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
export async function toEtsyImage(blob: Blob): Promise<{ blob: Blob; ext: string }> {
  const type = blob.type.toLowerCase();
  if (type === 'image/jpeg' || type === 'image/jpg') return { blob, ext: 'jpg' };
  if (type === 'image/png') return { blob, ext: 'png' };
  if (type === 'image/gif') return { blob, ext: 'gif' };
  const sharp = (await import('sharp')).default;
  const jpeg = await sharp(Buffer.from(await blob.arrayBuffer())).flatten({ background: '#ffffff' }).jpeg({ quality: 92 }).toBuffer();
  return { blob: new Blob([new Uint8Array(jpeg)], { type: 'image/jpeg' }), ext: 'jpg' };
}

/**
 * Etsy envanterinde beden × renk kombinasyonlarının tamamı bulunmalıdır ("All combinations of property values
 * must be supplied"). Ürüne göre farklı renkler kullanan şablonlarda eksik kombinasyonlar satışa kapalı
 * (is_enabled: false) satırlar olarak eklenir; tekrarlayan kombinasyonlardan ilki tutulur.
 */
export function completeVariationMatrix(rows: EtsyVariationInput[], fallbackPrice: number): EtsyVariationInput[] {
  const key = (size: string, color: string) => `${size}\u0000${color}`;
  const seen = new Map<string, EtsyVariationInput>();
  for (const row of rows) {
    const k = key(row.size || 'M', row.color || 'Black');
    if (!seen.has(k)) seen.set(k, row);
  }
  const sizes = [...new Set(rows.map((r) => r.size || 'M'))];
  const colors = [...new Set(rows.map((r) => r.color || 'Black'))];
  const enabledPrices = rows.filter((r) => r.enabled !== false).map((r) => Number(r.price)).filter((p) => p > 0);
  const placeholderPrice = enabledPrices.length > 0 ? Math.min(...enabledPrices) : fallbackPrice;
  const result: EtsyVariationInput[] = [];
  for (const size of sizes) {
    for (const color of colors) {
      result.push(seen.get(key(size, color)) ?? { size, color, price: placeholderPrice, quantity: 1, enabled: false });
    }
  }
  return result;
}

export async function createEtsyDraftListing(
  userId: string,
  credentials: EtsyCredentials,
  input: EtsyDraftListingInput,
): Promise<EtsyDraftListingResult> {
  const { etsyAccessToken, etsyShopId, etsyApiKey, etsySharedSecret } = credentials;
  const {
    title, description, validTags, price, quantity, taxonomyId,
    who_made, when_made, is_supply, production_partner_id,
    is_customizable, should_auto_renew, shipping_profile_id, readiness_state_id,
    shop_section_id, return_policy_id, sku,
  } = input;
  const materials = input.materials ?? [];
  const styles = input.styles ?? [];
  const taxonomy_properties_values = input.taxonomy_properties_values ?? {};
  const variations = input.variations ?? [];
  const images = input.images ?? [];

  const taxonomyRows = await sql`SELECT id FROM etsy_taxonomy_cache WHERE id = ${taxonomyId} LIMIT 1`;
  if (taxonomyRows.length === 0) {
    throw new EtsyListingError('Taxonomy ID doğrulanamadı. Önce Etsy taxonomy senkronizasyonunu çalıştırın.', 400);
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
  const positive = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined);
  const weight = positive(input.item_weight);
  if (weight && input.item_weight_unit) {
    createBody.set('item_weight', String(weight));
    createBody.set('item_weight_unit', input.item_weight_unit);
  }
  const dimensions = [positive(input.item_length), positive(input.item_width), positive(input.item_height)];
  // Etsy ölçüleri birlikte ister: üçü ve birimi yoksa hiçbiri gönderilmez.
  if (input.item_dimensions_unit && dimensions.every(Boolean)) {
    createBody.set('item_length', String(dimensions[0]));
    createBody.set('item_width', String(dimensions[1]));
    createBody.set('item_height', String(dimensions[2]));
    createBody.set('item_dimensions_unit', input.item_dimensions_unit);
  }

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
    throw new EtsyListingError(message, createRes.status === 429 ? 429 : 502);
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
      const productsPayload = completeVariationMatrix(variations as EtsyVariationInput[], Number(price) || 0).map((v) => ({
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
  } else if (listingId && sku) {
    // Varyasyonsuz ilanda SKU envanterdeki tek ürüne yazılır (taslak oluşturma isteği SKU almaz).
    try {
      const invRes = await etsyFetch(`https://openapi.etsy.com/v3/application/listings/${listingId}/inventory`, {
        method: 'PUT',
        headers: {
          'x-api-key': `${etsyApiKey}:${etsySharedSecret || ''}`,
          'Authorization': `Bearer ${etsyAccessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          products: [{ sku, property_values: [], offerings: [{ price, quantity, is_enabled: true, readiness_state_id }] }],
        }),
      });
      if (!invRes.ok) uploadErrors.push(await readEtsyError(invRes, 'SKU kaydedilemedi'));
    } catch (err: unknown) {
      uploadErrors.push(`SKU hatası: ${err instanceof Error ? err.message : 'unknown error'}`);
    }
  }

  // Upload images/videos if provided
  // Accept both old format (array of URL strings) and new format (array of {url, isVideo} objects)
  let imagesUploaded = 0;
  
  // Separate images and videos — videos go to /videos endpoint, images to /images endpoint
  const imageItems: string[] = [];
  const videoItems: string[] = [];
  const altTexts = new Map<number, string>();

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
        if (typeof item.url !== 'string') continue;
        if (item.isVideo) {
          videoItems.push(item.url);
        } else {
          imageItems.push(item.url);
          const alt = item.altText?.replace(/\s+/g, ' ').trim().slice(0, ALT_TEXT_MAX).trim();
          if (alt) altTexts.set(imageItems.length, alt);
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
          const loaded = await loadMediaBlob(userId, imgUrl);
          if (!loaded) {
            uploadErrors.push(`Görsel ${rank}: dosya okunamadı (silinmiş veya erişilemiyor).`);
            continue;
          }
          const { blob, ext } = await toEtsyImage(loaded);
          const formData = new FormData();
          formData.append('image', blob, `mockup-${listingId}-${rank}.${ext}`);
          formData.append('rank', String(rank));
          const altText = altTexts.get(rank);
          if (altText) formData.append('alt_text', altText);

          const postImage = () => etsyFetch(
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
          let imgRes = await postImage();
          // İlan Etsy tarafında hâlâ işleniyorsa (envanter güncellemesi vb.) kısa bekleyip tekrar denenir.
          for (const delay of ETSY_BUSY_RETRY_DELAYS_MS) {
            if (imgRes.status !== 409) break;
            await new Promise((resolve) => setTimeout(resolve, delay));
            imgRes = await postImage();
          }

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
        const blob = await loadMediaBlob(userId, vidUrl);

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

  return {
    listingId,
    listingUrl: listingData.url || `https://www.etsy.com/listing/${listingId}`,
    variationsUpdated,
    imagesUploaded,
    imageItems,
    videoItems,
    uploadErrors,
  };
}

/**
 * Görsel önizlemelerinin sunucu tarafı (bkz. media-preview): üretim (sharp → WebP, saydamlık korunur, büyütülmez)
 * ve R2'de saklama. Önizleme ilk istendiğinde özgün dosyadan üretilir ve `<anahtar>.w<genişlik>.webp` olarak
 * yazılır; sonraki istekler hazır önizlemeyi alır.
 */
import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { extractKeyFromUrlOrKey, getBucketName, getR2Client, isR2Configured } from '@/lib/r2';
import { isOwnedUploadName } from '@/lib/upload-security';
import { isPreviewKey, previewKey, type PreviewWidth } from '@/lib/media-preview';

export async function renderPreview(source: Buffer, width: PreviewWidth): Promise<Buffer> {
  const sharp = (await import('sharp')).default;
  return sharp(source, { limitInputPixels: 300_000_000 })
    .rotate()
    .resize(width, width, { fit: 'inside', withoutEnlargement: true })
    // Üretimde kullanılan büyük önizleme baskı kalitesinde tutulur.
    .webp({ quality: width >= 2048 ? 92 : 80, alphaQuality: width >= 2048 ? 100 : 90, effort: 4 })
    .toBuffer();
}

export type StoredPreview =
  | { kind: 'stored'; body: ReadableStream; length?: number }
  | { kind: 'rendered'; buffer: Buffer; store: () => Promise<void> };

/**
 * R2'deki önizleme; yoksa özgün görselden üretilir (`store` ile R2'ye yazılır). Özgün dosya görsel değilse veya
 * okunamazsa null.
 */
export async function getPreview(objectKey: string, width: PreviewWidth): Promise<StoredPreview | null> {
  const client = getR2Client();
  const bucket = getBucketName();
  const key = previewKey(objectKey, width);
  try {
    const cached = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    if (cached.Body) return { kind: 'stored', body: cached.Body.transformToWebStream(), length: cached.ContentLength };
  } catch {
    // Önizleme henüz yok: üretilir.
  }
  const original = await client.send(new GetObjectCommand({ Bucket: bucket, Key: objectKey }));
  const type = (original.ContentType || '').split(';')[0]!.trim().toLowerCase();
  if (!original.Body || (type && !type.startsWith('image/'))) return null;
  const buffer = await renderPreview(Buffer.from(await original.Body.transformToByteArray()), width);
  return {
    kind: 'rendered',
    buffer,
    store: async () => {
      await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: buffer, ContentType: 'image/webp', CacheControl: 'private, max-age=31536000, immutable' }))
        .catch((error: unknown) => console.warn('[Preview] Could not be stored', error instanceof Error ? error.message : error));
    },
  };
}

// Aynı tasarım art arda birçok mockup'a basılır: sıcak örnekte önizleme bellekte tutulur (en fazla birkaç tasarım).
const memory = new Map<string, Buffer>();
const MEMORY_LIMIT = 4;

/**
 * Kullanıcının depodaki görselinin önizlemesi (Buffer). Depo dışı adres, başkasının dosyası veya hata: null
 * (çağıran özgün dosyayı kullanır).
 */
export async function loadPreviewBuffer(userId: string, src: string, width: PreviewWidth): Promise<Buffer | null> {
  if (!isR2Configured() || !/^\/api\/r2\//.test(src)) return null;
  const objectKey = decodeURIComponent(extractKeyFromUrlOrKey(src.split('?')[0]!));
  if (!objectKey || isPreviewKey(objectKey) || !isOwnedUploadName(userId, objectKey)) return null;
  const cacheKey = `${objectKey}@${width}`;
  const hit = memory.get(cacheKey);
  if (hit) return hit;
  try {
    const preview = await getPreview(objectKey, width);
    if (!preview) return null;
    let buffer: Buffer;
    if (preview.kind === 'stored') {
      buffer = Buffer.from(await new Response(preview.body).arrayBuffer());
    } else {
      await preview.store();
      buffer = preview.buffer;
    }
    memory.set(cacheKey, buffer);
    if (memory.size > MEMORY_LIMIT) memory.delete(memory.keys().next().value!);
    return buffer;
  } catch (error) {
    console.warn('[Preview] Load failed; using the original.', error instanceof Error ? error.message : error);
    return null;
  }
}

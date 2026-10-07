/**
 * Sunucu tarafında kullanıcıya ait görselleri güvenli biçimde yükler.
 *
 * Kullanıcıdan gelen bir `src` değeri asla olduğu gibi `fetch` edilmez:
 *  - Kullanıcının kendi R2 / yerel upload dosyaları doğrudan depolamadan okunur
 *    (HTTP isteği ve çerez yönlendirmesi yoktur).
 *  - Paketlenmiş demo görselleri `public/demo` klasöründen okunur.
 *  - `data:` URL'leri boyut sınırıyla çözülür.
 *  - Harici adresler yalnızca HTTPS ve izin verilen alan adları için,
 *    çerezsiz, yönlendirmesiz, zaman aşımı ve boyut sınırıyla indirilir.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { extractKeyFromUrlOrKey, getBucketName, getPublicBaseUrl, getR2Client, isR2Configured } from '@/lib/r2';
import { detectMimeFromMagicBytes, isOwnedUploadName, MAX_IMAGE_UPLOAD_BYTES } from '@/lib/upload-security';

export const MAX_REMOTE_IMAGE_BYTES = 20 * 1024 * 1024;
const REMOTE_FETCH_TIMEOUT_MS = 15_000;

/** Varsayılan olarak izin verilen harici görsel alan adları (Etsy CDN ve eski Vercel Blob). */
const DEFAULT_ALLOWED_HOSTS = ['i.etsystatic.com', '*.public.blob.vercel-storage.com'];

export class MediaSourceError extends Error {
  constructor(message: string, readonly status: number = 400) {
    super(message);
    this.name = 'MediaSourceError';
  }
}

export type MediaSource =
  | { kind: 'data'; mimeType: string; base64: string }
  | { kind: 'r2'; key: string }
  | { kind: 'local-upload'; filename: string }
  | { kind: 'demo'; filename: string }
  | { kind: 'remote'; url: URL };

function hostMatches(hostname: string, pattern: string): boolean {
  const host = hostname.toLowerCase();
  const rule = pattern.trim().toLowerCase();
  if (!rule) return false;
  if (rule.startsWith('*.')) {
    const suffix = rule.slice(1); // ".example.com"
    return host.endsWith(suffix) && host.length > suffix.length;
  }
  return host === rule;
}

export function getAllowedRemoteHosts(): string[] {
  const extra = (process.env.MEDIA_FETCH_ALLOWED_HOSTS ?? '')
    .split(',')
    .map((h) => h.trim())
    .filter(Boolean);
  return [...DEFAULT_ALLOWED_HOSTS, ...extra];
}

export function isAllowedRemoteHost(hostname: string, allowedHosts = getAllowedRemoteHosts()): boolean {
  return allowedHosts.some((pattern) => hostMatches(hostname, pattern));
}

function r2PublicOrigin(): string | null {
  const base = getPublicBaseUrl();
  if (!/^https?:\/\//i.test(base)) return null;
  try {
    return new URL(base).origin;
  } catch {
    return null;
  }
}

/**
 * Bir `src` değerini hangi kaynaktan okunacağına göre sınıflandırır.
 * `appOrigin`, uygulamanın kendi origin'idir (ör. https://automania.app).
 */
export function classifyMediaSource(src: string, appOrigin?: string): MediaSource {
  const value = (src ?? '').trim();
  if (!value) throw new MediaSourceError('Görsel kaynağı boş olamaz.');

  const dataMatch = /^data:(image\/[a-z0-9.+-]+);base64,([\s\S]+)$/i.exec(value);
  if (dataMatch) {
    return { kind: 'data', mimeType: dataMatch[1].toLowerCase(), base64: dataMatch[2] };
  }

  let pathname: string | null = null;
  let remote: URL | null = null;

  if (value.startsWith('/') && !value.startsWith('//')) {
    pathname = value.split(/[?#]/)[0];
  } else {
    let parsed: URL;
    try {
      parsed = new URL(value);
    } catch {
      throw new MediaSourceError('Geçersiz görsel adresi.');
    }
    if (appOrigin && parsed.origin === appOrigin) {
      pathname = parsed.pathname;
    } else if (r2PublicOrigin() && parsed.origin === r2PublicOrigin()) {
      return { kind: 'r2', key: extractKeyFromUrlOrKey(value) };
    } else {
      remote = parsed;
    }
  }

  if (pathname !== null) {
    let decoded: string;
    try {
      decoded = decodeURIComponent(pathname);
    } catch {
      throw new MediaSourceError('Geçersiz görsel adresi.');
    }
    if (decoded.startsWith('/api/r2/')) {
      return { kind: 'r2', key: decoded.slice('/api/r2/'.length) };
    }
    if (decoded.startsWith('/api/uploads/')) {
      return { kind: 'local-upload', filename: decoded.slice('/api/uploads/'.length) };
    }
    if (decoded.startsWith('/demo/')) {
      const filename = decoded.slice('/demo/'.length);
      if (path.basename(filename) !== filename) throw new MediaSourceError('Geçersiz demo görseli.');
      return { kind: 'demo', filename };
    }
    throw new MediaSourceError('Bu görsel kaynağı desteklenmiyor.');
  }

  const url = remote!;
  if (url.protocol !== 'https:') throw new MediaSourceError('Yalnızca HTTPS görsel adresleri desteklenir.');
  if (url.username || url.password) throw new MediaSourceError('Geçersiz görsel adresi.');
  if (!isAllowedRemoteHost(url.hostname)) {
    throw new MediaSourceError('Bu alan adından görsel indirilmesine izin verilmiyor.', 403);
  }
  return { kind: 'remote', url };
}

async function readRemote(url: URL, maxBytes: number): Promise<Buffer> {
  const res = await fetch(url, {
    redirect: 'error',
    credentials: 'omit',
    signal: AbortSignal.timeout(REMOTE_FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new MediaSourceError(`Görsel indirilemedi (HTTP ${res.status}).`, 502);

  const contentType = (res.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
  if (!contentType.startsWith('image/')) throw new MediaSourceError('İndirilen dosya bir görsel değil.', 415);

  const declared = Number(res.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new MediaSourceError('Görsel boyutu izin verilen sınırı aşıyor.', 413);
  }
  if (!res.body) throw new MediaSourceError('Görsel indirilemedi.', 502);

  const chunks: Uint8Array[] = [];
  let total = 0;
  const reader = res.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new MediaSourceError('Görsel boyutu izin verilen sınırı aşıyor.', 413);
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

function assertSize(buffer: Buffer, maxBytes: number): Buffer {
  if (buffer.byteLength > maxBytes) throw new MediaSourceError('Görsel boyutu izin verilen sınırı aşıyor.', 413);
  return buffer;
}

/**
 * `src` değerinin işaret ettiği görseli, kullanıcının sahipliği doğrulanarak okur.
 */
export async function loadImageForUser(
  userId: string,
  src: string,
  options: { appOrigin?: string; maxBytes?: number } = {},
): Promise<Buffer> {
  const maxBytes = options.maxBytes ?? MAX_REMOTE_IMAGE_BYTES;
  const source = classifyMediaSource(src, options.appOrigin);

  switch (source.kind) {
    case 'data':
      return assertSize(Buffer.from(source.base64, 'base64'), maxBytes);

    case 'r2': {
      if (!isOwnedUploadName(userId, source.key)) throw new MediaSourceError('Bu görsele erişim yetkiniz yok.', 403);
      if (!isR2Configured()) throw new MediaSourceError('Depolama yapılandırılmamış.', 503);
      const object = await getR2Client().send(new GetObjectCommand({ Bucket: getBucketName(), Key: source.key }));
      if (!object.Body) throw new MediaSourceError('Görsel bulunamadı.', 404);
      if (typeof object.ContentLength === 'number' && object.ContentLength > maxBytes) {
        throw new MediaSourceError('Görsel boyutu izin verilen sınırı aşıyor.', 413);
      }
      return assertSize(Buffer.from(await object.Body.transformToByteArray()), maxBytes);
    }

    case 'local-upload': {
      if (!isOwnedUploadName(userId, source.filename)) throw new MediaSourceError('Bu görsele erişim yetkiniz yok.', 403);
      const filePath = path.join(process.cwd(), '.data', 'uploads', source.filename);
      try {
        return assertSize(await fs.readFile(filePath), Math.min(maxBytes, MAX_IMAGE_UPLOAD_BYTES));
      } catch (error) {
        if (error instanceof MediaSourceError) throw error;
        throw new MediaSourceError('Görsel bulunamadı.', 404);
      }
    }

    case 'demo': {
      const filePath = path.join(process.cwd(), 'public', 'demo', source.filename);
      try {
        return assertSize(await fs.readFile(filePath), maxBytes);
      } catch (error) {
        if (error instanceof MediaSourceError) throw error;
        throw new MediaSourceError('Görsel bulunamadı.', 404);
      }
    }

    case 'remote':
      return readRemote(source.url, maxBytes);
  }
}

const VISION_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);

/**
 * Görseli yükler ve AI vision modellerinin kabul ettiği bir biçimde döner.
 * PNG/JPEG/WebP/GIF dışındaki biçimler (ör. SVG demo görselleri) PNG'ye dönüştürülür.
 * `userId` null ise (misafir) yalnızca data URL'leri ve paketlenmiş demo görselleri kabul edilir.
 */
export async function loadVisionImage(
  userId: string | null,
  src: string,
  options: { appOrigin?: string; maxBytes?: number } = {},
): Promise<{ buffer: Buffer; mimeType: string }> {
  let buffer: Buffer;
  if (userId) {
    buffer = await loadImageForUser(userId, src, options);
  } else {
    let kind: MediaSource['kind'] | null = null;
    try {
      kind = classifyMediaSource(src, options.appOrigin).kind;
    } catch {
      kind = null;
    }
    if (kind !== 'data' && kind !== 'demo') {
      throw new MediaSourceError('Bu görseli analiz etmek için giriş yapmalısınız.', 401);
    }
    // Misafirlerin demo/data görselleri için sahiplik kontrolü gerekmez; userId yerine sabit bir değer kullanılır.
    buffer = await loadImageForUser('guest', src, options);
  }

  const detected = detectMimeFromMagicBytes(buffer);
  if (detected && VISION_MIME_TYPES.has(detected)) return { buffer, mimeType: detected };

  try {
    const { default: sharp } = await import('sharp');
    return { buffer: await sharp(buffer).png().toBuffer(), mimeType: 'image/png' };
  } catch {
    throw new MediaSourceError('Görsel biçimi desteklenmiyor.', 415);
  }
}

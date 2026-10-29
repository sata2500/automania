/**
 * Depolamaya yazılan görsellerin sıkıştırılması (sunucu tarafı, sharp).
 *  - 'design' (baskı dosyası): kayıpsız PNG, en yüksek sıkıştırma (zlib 9, uyarlanabilir filtre). Tamamen
 *    saydam piksellerin görünmeyen renk değerleri sıfırlanır; görünen hiçbir piksel değişmez. Yapay zekâ ve
 *    tasarım programı çıktıları tipik olarak üçte bir boyuta iner. Dosya doğrudan indirilip baskıda/upscale'de
 *    kullanılabilir. En uzun kenar 4500 px ile sınırlı. Saydam kenar boşlukları otomatik kırpılır (içeriğin
 *    çevresinde %2 pay bırakılır; opak görsellere dokunulmaz). Hiç saydam pikseli olmayan görsel alfa kanalı
 *    olmadan saklanır.
 *  - 'photo' (mockup fotoğrafı): yüksek kaliteli WebP (q90, keskin renk alt örneklemesi), en uzun kenar 3000 px.
 * Sonuç orijinalden büyükse orijinal korunur. Hareketli GIF'lere dokunulmaz.
 */
import sharp from 'sharp';

export type OptimizeKind = 'design' | 'photo';

export type OptimizedImage = { buffer: Buffer; mimeType: string; width: number; height: number; optimized: boolean };

const MAX_SIDE: Record<OptimizeKind, number> = { design: 4500, photo: 3000 };

export type OptimizeOptions = {
  /** Saydam kenar boşluklarını kırp (varsayılan: açık). Ham yapay zekâ çıktısı gibi ara görsellerde kapatılır. */
  trim?: boolean;
};

/** Alfa eşiği: neredeyse görünmez kenar pikselleri (yumuşatma kalıntısı) boşluk sayılır. */
const TRIM_ALPHA_THRESHOLD = 12;
const TRIM_PADDING_RATIO = 0.02;

/**
 * RGBA piksellerde görünen içeriğin sınırları (%2 payla). Saydam kenar yoksa veya görsel tamamen
 * saydamsa null.
 */
export function transparentTrimBox(pixels: Uint8Array | Buffer, width: number, height: number): { left: number; top: number; width: number; height: number } | null {
  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let y = 0; y < height; y++) {
    const row = y * width * 4;
    for (let x = 0; x < width; x++) {
      if (pixels[row + x * 4 + 3]! > TRIM_ALPHA_THRESHOLD) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;
  const pad = Math.round(Math.max(maxX - minX + 1, maxY - minY + 1) * TRIM_PADDING_RATIO);
  const left = Math.max(0, minX - pad);
  const top = Math.max(0, minY - pad);
  const right = Math.min(width - 1, maxX + pad);
  const bottom = Math.min(height - 1, maxY + pad);
  if (left === 0 && top === 0 && right === width - 1 && bottom === height - 1) return null;
  return { left, top, width: right - left + 1, height: bottom - top + 1 };
}

export function isOptimizeKind(value: unknown): value is OptimizeKind {
  return value === 'design' || value === 'photo';
}

export async function optimizeImageForStorage(input: Buffer, mimeType: string, kind: OptimizeKind, options: OptimizeOptions = {}): Promise<OptimizedImage> {
  const meta = await sharp(input, { animated: true }).metadata();
  const width = meta.width ?? 0;
  const height = meta.pageHeight ?? meta.height ?? 0;
  if (mimeType === 'image/gif' || (meta.pages ?? 1) > 1) {
    return { buffer: input, mimeType, width, height, optimized: false };
  }
  const max = MAX_SIDE[kind];
  const pipeline = sharp(input).rotate().resize(max, max, { fit: 'inside', withoutEnlargement: true });

  let data: Buffer;
  let info: { width: number; height: number };
  let outMime: string;
  let trimmed = false;
  if (kind === 'design') {
    const raw = await pipeline.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    let pixels = raw.data;
    let outWidth = raw.info.width;
    let outHeight = raw.info.height;
    const box = options.trim === false || meta.hasAlpha === false ? null : transparentTrimBox(pixels, outWidth, outHeight);
    if (box) {
      const cropped = Buffer.alloc(box.width * box.height * 4);
      for (let y = 0; y < box.height; y++) {
        const start = ((box.top + y) * outWidth + box.left) * 4;
        pixels.copy(cropped, y * box.width * 4, start, start + box.width * 4);
      }
      pixels = cropped;
      outWidth = box.width;
      outHeight = box.height;
      trimmed = true;
    }
    // Görünmeyen (tamamen saydam) piksellerin rengi sıkıştırmayı bozmasın.
    let opaque = true;
    for (let i = 0; i < pixels.length; i += 4) {
      if (pixels[i + 3] === 0) { pixels[i] = 0; pixels[i + 1] = 0; pixels[i + 2] = 0; }
      if (pixels[i + 3] !== 255) opaque = false;
    }
    const encoded = sharp(pixels, { raw: { width: outWidth, height: outHeight, channels: 4 } });
    data = await (opaque ? encoded.removeAlpha() : encoded).png({ compressionLevel: 9, adaptiveFiltering: true }).toBuffer();
    info = { width: outWidth, height: outHeight };
    outMime = 'image/png';
  } else {
    ({ data, info } = await pipeline.webp({ quality: 90, smartSubsample: true, effort: 4 }).toBuffer({ resolveWithObject: true }));
    outMime = 'image/webp';
  }
  const resized = info.width !== width || info.height !== height;
  // Kırpılan görsel her zaman yeni hâliyle saklanır; aksi hâlde büyüyen sonuç yerine orijinal korunur.
  if (!resized && !trimmed && data.byteLength >= input.byteLength) {
    return { buffer: input, mimeType, width, height, optimized: false };
  }
  return { buffer: data, mimeType: outMime, width: info.width, height: info.height, optimized: true };
}

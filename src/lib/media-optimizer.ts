/**
 * Depolamaya yazılan görsellerin sıkıştırılması (sunucu tarafı, sharp).
 *  - 'design' (baskı dosyası): kayıpsız PNG, en yüksek sıkıştırma (zlib 9, uyarlanabilir filtre). Tamamen
 *    saydam piksellerin görünmeyen renk değerleri sıfırlanır; görünen hiçbir piksel değişmez. Yapay zekâ ve
 *    tasarım programı çıktıları tipik olarak üçte bir boyuta iner. Dosya doğrudan indirilip baskıda/upscale'de
 *    kullanılabilir. En uzun kenar 4500 px ile sınırlı.
 *  - 'photo' (mockup fotoğrafı): yüksek kaliteli WebP (q90, keskin renk alt örneklemesi), en uzun kenar 3000 px.
 * Sonuç orijinalden büyükse orijinal korunur. Hareketli GIF'lere dokunulmaz.
 */
import sharp from 'sharp';

export type OptimizeKind = 'design' | 'photo';

export type OptimizedImage = { buffer: Buffer; mimeType: string; width: number; height: number; optimized: boolean };

const MAX_SIDE: Record<OptimizeKind, number> = { design: 4500, photo: 3000 };

export function isOptimizeKind(value: unknown): value is OptimizeKind {
  return value === 'design' || value === 'photo';
}

export async function optimizeImageForStorage(input: Buffer, mimeType: string, kind: OptimizeKind): Promise<OptimizedImage> {
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
  if (kind === 'design') {
    const raw = await pipeline.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const pixels = raw.data;
    // Görünmeyen (tamamen saydam) piksellerin rengi sıkıştırmayı bozmasın.
    for (let i = 0; i < pixels.length; i += 4) {
      if (pixels[i + 3] === 0) { pixels[i] = 0; pixels[i + 1] = 0; pixels[i + 2] = 0; }
    }
    const opaque = meta.hasAlpha === false;
    const encoded = sharp(pixels, { raw: { width: raw.info.width, height: raw.info.height, channels: 4 } });
    data = await (opaque ? encoded.removeAlpha() : encoded).png({ compressionLevel: 9, adaptiveFiltering: true }).toBuffer();
    info = raw.info;
    outMime = 'image/png';
  } else {
    ({ data, info } = await pipeline.webp({ quality: 90, smartSubsample: true, effort: 4 }).toBuffer({ resolveWithObject: true }));
    outMime = 'image/webp';
  }
  const resized = info.width !== width || info.height !== height;
  if (!resized && data.byteLength >= input.byteLength) {
    return { buffer: input, mimeType, width, height, optimized: false };
  }
  return { buffer: data, mimeType: outMime, width: info.width, height: info.height, optimized: true };
}

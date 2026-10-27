/**
 * Depolamaya yazılan görsellerin sıkıştırılması (sunucu tarafı, sharp).
 *  - 'design' (baskı dosyası): neredeyse kayıpsız WebP. libwebp'nin "near-lossless" kipi yalnızca gözle
 *    ayırt edilemeyen piksel farklarına izin verir; renk alt örneklemesi (chroma subsampling) yapılmaz,
 *    saydamlık birebir korunur (ölçülen en büyük fark 2/255). Tipik olarak PNG'nin %35–45'i boyutundadır.
 *    En uzun kenar 4500 px ile sınırlı.
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
  const output = kind === 'design'
    ? pipeline.webp({ nearLossless: true, quality: 60, alphaQuality: 100, effort: 1 })
    : pipeline.webp({ quality: 90, smartSubsample: true, effort: 4 });
  const { data, info } = await output.toBuffer({ resolveWithObject: true });
  const resized = info.width !== width || info.height !== height;
  if (!resized && data.byteLength >= input.byteLength) {
    return { buffer: input, mimeType, width, height, optimized: false };
  }
  return { buffer: data, mimeType: 'image/webp', width: info.width, height: info.height, optimized: true };
}

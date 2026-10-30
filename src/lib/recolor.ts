/** Kumaş rengine uyarlama görsel sarmalayıcısı (sunucu, sharp). Algoritma: `recolor-core`. */
import sharp from 'sharp';
import { recolorPixels, type RecolorMode } from '@/lib/recolor-core';

export { adaptToFabric, mapLightness, recolorPixel, recolorPixels, type RecolorMode } from '@/lib/recolor-core';

export interface RecolorResult {
  pngBuffer: Buffer;
  processingTimeMs: number;
  /** Rengi değiştirilen (görünür) piksel oranı */
  changedRatio: number;
  /** Görselde saydam alan (kaldırılmış zemin) var mı? Yoksa uyarlama yapılamaz. */
  hasTransparency: boolean;
}

/**
 * Tasarımı hedef kumaşa uyarlar.
 * @param mode 'dark_garment': koyu kumaş için (koyu tonlar açılır); 'light_garment': açık kumaş için (açık tonlar koyulaşır)
 */
export async function recolorDesign(input: string | Buffer, mode: RecolorMode): Promise<RecolorResult> {
  const startTime = Date.now();
  const buffer: Buffer = typeof input === 'string' ? Buffer.from(input, 'base64') : input;
  const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { changedRatio, hasTransparency } = recolorPixels(data, info.width, info.height, mode);
  const pngBuffer = await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
  return { pngBuffer, processingTimeMs: Date.now() - startTime, changedRatio, hasTransparency };
}

/** Arka plan kaldırma görsel sarmalayıcıları (sunucu, sharp). Algoritma: `background-removal-core`. */
import sharp from 'sharp';
import { cleanupVariantBackground, clearTransparentColor, removeBackgroundPixels } from '@/lib/background-removal-core';

export {
  analyzeBackground,
  BackgroundRemovalError,
  cleanupVariantBackground,
  keyOutSolidBackground,
  type BackgroundAnalysis,
  type BackgroundKind,
} from '@/lib/background-removal-core';

type Rgb = { r: number; g: number; b: number };

export type BackgroundRemovalResult = {
  pngBuffer: Buffer;
  method: 'chroma' | 'solid';
  removedRatio: number;
  width: number;
  height: number;
};

/** Zemin türünü belirleyip uygun yöntemle kaldırır; uygun değilse açıklayıcı bir hata fırlatır. */
export async function removeBackgroundAuto(input: Buffer): Promise<BackgroundRemovalResult> {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const { method, removedRatio } = removeBackgroundPixels(data, width, height);
  const pngBuffer = await sharp(data, { raw: { width, height, channels: 4 } }).png().toBuffer();
  return { pngBuffer, method, removedRatio, width, height };
}

/** `cleanupVariantBackground` görsel sarmalayıcısı: modelin ham çıktısından saydam PNG üretir. */
export async function removeVariantBackground(input: Buffer, keyColor?: Rgb): Promise<{ pngBuffer: Buffer; width: number; height: number }> {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  cleanupVariantBackground(data, width, height, keyColor);
  clearTransparentColor(data);
  const pngBuffer = await sharp(data, { raw: { width, height, channels: 4 } }).png().toBuffer();
  return { pngBuffer, width, height };
}

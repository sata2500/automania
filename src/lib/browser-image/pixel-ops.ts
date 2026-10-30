/**
 * Misafirin tasarım işlemleri (tarayıcıda, sunucuya gönderilmeden): arka plan kaldırma, kumaşa uyarlama ve
 * kayıpsız sıkıştırma. Algoritmalar sunucudakilerle aynıdır (`*-core`); sonuç her işlemde saydam boşlukları
 * kırpılmış (%2 pay), en yüksek sıkıştırmalı PNG'dir. Saf fonksiyon (DOM yok): Web Worker'da çalışır.
 */
import { clearTransparentColor, removeBackgroundPixels } from '@/lib/background-removal-core';
import { recolorPixels, type RecolorMode } from '@/lib/recolor-core';
import { cropRgba, transparentTrimBox } from '@/lib/image-trim';
import { encodePng } from '@/lib/png-encoder';

export type PixelOp = { type: 'remove-bg' } | { type: 'recolor'; mode: RecolorMode } | { type: 'encode' };

export type PixelOpResult = {
  /** Kodlanmış PNG; işlem bir şey değiştirmediyse (kumaşa uyarlama) null. */
  png: Uint8Array | null;
  width: number;
  height: number;
  removedRatio?: number;
  changedRatio?: number;
};

/** Kumaşa uyarlamada değişiklik bu oranın altındaysa yeni kopya oluşturulmaz (sunucuyla aynı). */
const MIN_CHANGED_RATIO = 0.002;

export function runPixelOp(op: PixelOp, data: Uint8Array | Uint8ClampedArray, width: number, height: number): PixelOpResult {
  const pixels = data instanceof Uint8Array ? data : new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  const result: Omit<PixelOpResult, 'png' | 'width' | 'height'> = {};
  if (op.type === 'remove-bg') {
    result.removedRatio = removeBackgroundPixels(pixels, width, height).removedRatio;
  } else if (op.type === 'recolor') {
    const { changedRatio, hasTransparency } = recolorPixels(pixels, width, height, op.mode);
    if (!hasTransparency) {
      throw new Error('Tasarımın arka planı saydam değil. Kumaşa uyarlamadan önce "Arka planı kaldır" ile zemini kaldırın.');
    }
    if (changedRatio < MIN_CHANGED_RATIO) return { png: null, width, height, changedRatio };
    result.changedRatio = changedRatio;
  }
  clearTransparentColor(pixels);
  const box = transparentTrimBox(pixels, width, height);
  const out = box ? cropRgba(pixels, width, box) : pixels;
  const outWidth = box?.width ?? width;
  const outHeight = box?.height ?? height;
  return { ...result, png: encodePng(out, outWidth, outHeight), width: outWidth, height: outHeight };
}

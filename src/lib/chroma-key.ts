/** Perde arka planını kaldırma servisi (sunucu, sharp). Algoritma: `chroma-key-core`. */
import sharp from 'sharp';
import { keyOutBackground } from '@/lib/chroma-key-core';

export { estimateKeyColor, keyOutBackground } from '@/lib/chroma-key-core';

// ─── Tipler ──────────────────────────────────────────────────────────────────

export interface ChromaKeyOptions {
  /**
   * Beklenen perde rengi. Gerçek renk her zaman görselin kenarlarından ölçülür; bu değer yalnız
   * kenarlar düz bir perde rengi değilse kullanılır (varsayılan #00FF00).
   */
  keyColor?: { r: number; g: number; b: number };
}

export interface ChromaKeyResult {
  /** PNG buffer (transparan arka plan) */
  pngBuffer: Buffer;
  /** Kaldırılan (tamamen saydam) piksel oranı (0–1) */
  removedRatio: number;
  /** İşlem süresi (ms) */
  processingTimeMs: number;
  width: number;
  height: number;
}

/**
 * Base64 veya Buffer formatındaki görselden perde arka planını kaldırır.
 * @param input  - base64 string veya Buffer
 * @param options - Chroma key parametreleri
 * @returns Transparan PNG buffer
 */
export async function removeChromaBackground(
  input: string | Buffer,
  options: ChromaKeyOptions = {}
): Promise<ChromaKeyResult> {
  const startTime = Date.now();
  const buffer: Buffer = typeof input === 'string' ? Buffer.from(input, 'base64') : input;

  const { data, info } = await sharp(buffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height } = info;
  const removedCount = keyOutBackground(data, width, height, options.keyColor);

  // Tamamen saydam piksellerin rengi sıfırlanır: saydamlığı yok sayan görüntüleyicilerde perde rengi
  // görünmez, kenar kırpma (trim) doğru çalışır ve dosya küçülür.
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) { data[i] = 0; data[i + 1] = 0; data[i + 2] = 0; }
  }

  const pngBuffer = await sharp(data, { raw: { width, height, channels: 4 } })
    .png()
    .toBuffer();

  return {
    pngBuffer,
    removedRatio: removedCount / (width * height),
    processingTimeMs: Date.now() - startTime,
    width,
    height,
  };
}

/**
 * Chroma key kalitesini değerlendirir.
 */
export function evaluateChromaKeyQuality(result: ChromaKeyResult): {
  quality: 'good' | 'warning' | 'poor';
  message: string;
} {
  const { removedRatio } = result;

  if (removedRatio < 0.05) {
    return {
      quality: 'poor',
      message: 'Çok az piksel kaldırıldı. Görselin arka planı düz bir perde rengi olmayabilir.',
    };
  }
  if (removedRatio > 0.85) {
    return {
      quality: 'warning',
      message: `Çok fazla piksel kaldırıldı (%${Math.round(removedRatio * 100)}). Tasarımın bir kısmı da kaldırılmış olabilir.`,
    };
  }
  return {
    quality: 'good',
    message: `Arka plan başarıyla kaldırıldı (%${Math.round(removedRatio * 100)} piksel işlendi).`,
  };
}

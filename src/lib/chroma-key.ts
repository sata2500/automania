/**
 * Chroma Key — Yeşil Arka Plan Kaldırma Servisi
 * ================================================
 * Sharp kütüphanesi kullanarak sunucu tarafında yeşil arka plan kaldırır.
 * AI tarafından üretilen yeşil arka planlı görselden transparan PNG oluşturur.
 *
 * Sharp kütüphanesi WebP dahil birçok formatı destekler ve Node.js için
 * 2026 standartlarında en yüksek performansı veren görsel işleme kütüphanesidir.
 */

import sharp from 'sharp';

// ─── Tipler ──────────────────────────────────────────────────────────────────

export interface ChromaKeyOptions {
  /**
   * Renk uzaklığı eşiği (0–441).
   * Pikselin hedef renge olan Öklid uzaklığı bu değerin altındaysa kaldırılır.
   * Varsayılan: 80 (saf yeşil #00FF00'a yakın her şey)
   */
  threshold?: number;

  /**
   * Geçiş bölgesi genişliği (0–200).
   * threshold ile threshold+feather arası pikseller kısmen şeffaflaştırılır.
   * Varsayılan: 40
   */
  feather?: number;

  /**
   * Hedef renk (varsayılan: saf yeşil #00FF00)
   */
  keyColor?: { r: number; g: number; b: number };
}

export interface ChromaKeyResult {
  /** PNG buffer (transparan arka plan) */
  pngBuffer: Buffer;
  /** Kaldırılan piksel oranı (0–1) */
  removedRatio: number;
  /** İşlem süresi (ms) */
  processingTimeMs: number;
}

// ─── Yardımcı ────────────────────────────────────────────────────────────────

/**
 * Bir pikselin yeşil perde sonrası alfa değerini döner. Döngüde piksel başına nesne oluşturmamak için
 * HSV hesabı satır içidir (eski `rgbToHsv` ile aynı sonuç). -1: piksel tamamen kaldırıldı (alfa 0).
 */
export function greenScreenAlpha(r: number, g: number, b: number, alpha: number): number {
  // Sınır değerlerinde eski sonuçla birebir aynı kalmak için hesap 0–1 aralığında yapılır.
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const maxN = Math.max(rn, gn, bn);
  const d = maxN - Math.min(rn, gn, bn);
  // Doygunluk (s = d/max) ve parlaklık (v = max) eşikleri: çok gri/beyaz ve çok siyah korunur.
  if (maxN === 0 || maxN < 0.15 || d / maxN < 0.15) return alpha;

  let h: number;
  if (maxN === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
  else if (maxN === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  h = (h / 6) * 360;

  // Yeşil tonu (Hue 70–170) tamamen saydam; 60–70 ve 170–180 arası kenarlar kısmen saydam.
  if (h >= 70 && h <= 170) return -1;
  if ((h >= 60 && h < 70) || (h > 170 && h <= 180)) {
    const distanceToCore = h < 70 ? 70 - h : h - 170;
    return Math.min(alpha, Math.round((distanceToCore / 10) * 255));
  }
  return alpha;
}

// ─── Ana Fonksiyon ────────────────────────────────────────────────────────────

/**
 * Base64 veya Buffer formatındaki görselden yeşil arka planı kaldırır.
 * @param input  - base64 string veya Buffer
 * @param options - Chroma key parametreleri
 * @returns Transparan PNG buffer
 */
export async function removeGreenBackground(
  input: string | Buffer,
  options: ChromaKeyOptions = {}
): Promise<ChromaKeyResult> {
  const startTime = Date.now();

  // Not: Mevcut algoritma HSV tabanlı sabit yeşil aralığı kullanır; `options`
  // içindeki threshold/feather/keyColor değerleri şu an dikkate alınmaz.
  void options;

  // Input'u Buffer'a çevir
  const buffer: Buffer = typeof input === 'string'
    ? Buffer.from(input, 'base64')
    : input;

  // Sharp ile görseli işle (Raw RGBA piksellerini al)
  const { data, info } = await sharp(buffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  const totalPixels = width * height;
  let removedCount = 0;

  // Piksel bazlı işlem — RGBA düzeni (her piksel 4 byte)
  for (let i = 0; i < data.length; i += channels) {
    const nextAlpha = greenScreenAlpha(data[i]!, data[i + 1]!, data[i + 2]!, data[i + 3]!);
    if (nextAlpha === -1) {
      data[i + 3] = 0;
      removedCount++;
    } else {
      data[i + 3] = nextAlpha;
    }
  }

  // Raw piksellerden tekrar PNG oluştur
  const pngBuffer = await sharp(data, {
    raw: {
      width,
      height,
      channels,
    },
  })
    .png()
    .toBuffer();

  return {
    pngBuffer,
    removedRatio: removedCount / totalPixels,
    processingTimeMs: Date.now() - startTime,
  };
}

/**
 * Birden fazla görseli paralel olarak işler.
 */
export async function removeGreenBackgroundBatch(
  inputs: Array<{ id: string; data: string | Buffer }>,
  options: ChromaKeyOptions = {}
): Promise<Map<string, ChromaKeyResult>> {
  const results = new Map<string, ChromaKeyResult>();

  await Promise.all(
    inputs.map(async ({ id, data }) => {
      try {
        const result = await removeGreenBackground(data, options);
        results.set(id, result);
      } catch (error) {
        console.error(`[ChromaKey] ${id} işlenirken hata:`, error);
      }
    })
  );

  return results;
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
      message: 'Çok az piksel kaldırıldı. Görsel yeşil arka plana sahip olmayabilir veya eşik değeri çok yüksek.',
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

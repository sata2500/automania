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

function rgbToHsv(r: number, g: number, b: number) {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  
  let h = 0;
  const s = max === 0 ? 0 : d / max;
  const v = max;

  if (max !== min) {
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  
  return { h: h * 360, s, v };
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
    const r = data[i]!;
    const g = data[i + 1]!;
    const b = data[i + 2]!;

    const { h, s, v } = rgbToHsv(r, g, b);

    // Yeşil tonu algılaması (Hue: 70 - 170 arası yeşildir)
    // AI görsellerindeki gölgeler ve ışık patlamaları için Saturation ve Value eşikleri düşük tutuldu
    const isGreenHue = h >= 70 && h <= 170;
    const isColorful = s >= 0.15; // Çok gri/beyaz değil
    const isNotBlack = v >= 0.15; // Çok siyah değil

    if (isGreenHue && isColorful && isNotBlack) {
      // Tam transparan
      data[i + 3] = 0;
      removedCount++;
    } else {
      // Sınırdaki pikseller (Yumuşatma / Feather)
      // Yeşil tonuna çok yakın olan ama sınırda kalan renkleri yarı saydam yapalım
      const isEdgeGreen = (h >= 60 && h < 70) || (h > 170 && h <= 180);
      if (isEdgeGreen && isColorful && isNotBlack) {
        // Hue sınırlarına yaklaştıkça saydamlık artar
        const distanceToCore = h < 70 ? (70 - h) : (h - 170); // 0 ile 10 arası
        const alphaRatio = distanceToCore / 10; // 0.0 (tam saydam) ile 1.0 (tam opak) arası
        data[i + 3] = Math.min(data[i + 3]!, Math.round(alphaRatio * 255));
      }
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

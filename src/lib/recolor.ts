import sharp from 'sharp';

// ─── Yardımcı Fonksiyonlar (HSL Dönüşümü) ────────────────────────────────

function rgbToHsl(r: number, g: number, b: number) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return { h: h * 360, s, l };
}

function hslToRgb(h: number, s: number, l: number) {
  let r, g, b;
  h /= 360;

  if (s === 0) {
    r = g = b = l; // achromatic
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
}

// ─── Kenar Algılama Algoritması ──────────────────────────────────────────────

/**
 * Verilen pikselin (x, y) etrafındaki şeffaf pikselleri arar.
 * Eğer belirtilen yarıçap (radius) içinde şeffaf (alpha < 50) piksel bulursa true döner.
 */
function isNearTransparency(
  x: number,
  y: number,
  width: number,
  height: number,
  data: Buffer,
  radius: number
): boolean {
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      // Dairesel bir yarıçap oluşturmak için köşeleri atla
      if (dx * dx + dy * dy > radius * radius) continue;

      const nx = x + dx;
      const ny = y + dy;

      // Resim sınırları kontrolü
      if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
        const alphaIdx = (ny * width + nx) * 4 + 3;
        // Şeffaflık eşiği (alpha < 50 ise şeffaf kabul et)
        if (data[alphaIdx]! < 50) {
          return true;
        }
      } else {
        // Resmin dışı şeffaf kabul edilir
        return true;
      }
    }
  }
  return false;
}

// ─── Ana Fonksiyon ────────────────────────────────────────────────────────────

export interface RecolorResult {
  pngBuffer: Buffer;
  processingTimeMs: number;
}

/**
 * Edge Detection (Kenar Algılama) yöntemiyle tasarım uyarlaması yapar.
 * Sadece şeffaf alanlara temas eden dış hatlardaki piksellerin parlaklığını değiştirir.
 * Tasarımın iç detaylarındaki siyah/beyaz hatlara dokunmaz.
 * 
 * @param input - base64 string veya Buffer
 * @param mode - 'light_garment' (açık kumaş için: beyaz konturları siyah yap) 
 *               'dark_garment' (koyu kumaş için: siyah konturları beyaz yap)
 */
export async function recolorDesign(
  input: string | Buffer,
  mode: 'light_garment' | 'dark_garment'
): Promise<RecolorResult> {
  const startTime = Date.now();

  const buffer: Buffer = typeof input === 'string'
    ? Buffer.from(input, 'base64')
    : input;

  const { data, info } = await sharp(buffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  
  // Çözünürlüğe göre yarıçapı dinamik ayarla (ortalama 2000px için radius=6 olur)
  // Daha kalın bir kontur algılaması için çarpanı artırabilirsiniz.
  const radius = Math.max(3, Math.floor(width / 300));

  for (let i = 0; i < data.length; i += channels) {
    const alpha = data[i + 3]!;

    // Tamamen şeffaf pikselleri atla
    if (alpha < 5) continue;

    const r = data[i]!;
    const g = data[i + 1]!;
    const b = data[i + 2]!;

    const { h, s, l } = rgbToHsl(r, g, b);

    // Sadece gri/siyah/beyaz tonlar (Saturation çok düşükse)
    if (s < 0.20) {
      
      let shouldInvert = false;

      // Dark Garment (Koyu tişört için): Siyahları beyaz yapmalıyız
      if (mode === 'dark_garment') {
        if (l < 0.4) { // Eğer piksel koyuysa (siyah)
          shouldInvert = true;
        }
      } 
      // Light Garment (Açık tişört için): Beyazları siyah yapmalıyız
      else {
        if (l > 0.6) { // Eğer piksel açıksa (beyaz)
          shouldInvert = true;
        }
      }

      if (shouldInvert) {
        // Pikselin (x, y) koordinatlarını bul
        const pixelIndex = i / 4;
        const x = pixelIndex % width;
        const y = Math.floor(pixelIndex / width);

        // Sadece Dış Hatta (Şeffaflığa yakın) olanları çevir
        if (isNearTransparency(x, y, width, height, data, radius)) {
          let newL = 1.0 - l;
          
          // Kontrast güçlendirmesi
          if (newL < 0.2) newL = 0.05; 
          if (newL > 0.8) newL = 0.95;

          const { r: newR, g: newG, b: newB } = hslToRgb(h, s, newL);
          
          data[i] = newR;
          data[i + 1] = newG;
          data[i + 2] = newB;
        }
      }
    }
  }

  const pngBuffer = await sharp(data, {
    raw: { width, height, channels }
  })
    .png()
    .toBuffer();

  return {
    pngBuffer,
    processingTimeMs: Date.now() - startTime
  };
}

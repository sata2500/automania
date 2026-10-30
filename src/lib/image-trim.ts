/**
 * Tasarımların saydam kenar boşluklarının kırpılması (saf, RGBA). Sunucuda (`media-optimizer`) ve tarayıcıda
 * (misafir, `browser-image`) aynı sınırlar kullanılır.
 */

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

/** RGBA piksellerden bir kutuyu yeni bir tampona kopyalar. */
export function cropRgba(pixels: Uint8Array | Uint8ClampedArray, width: number, box: { left: number; top: number; width: number; height: number }): Uint8Array {
  const out = new Uint8Array(box.width * box.height * 4);
  for (let y = 0; y < box.height; y++) {
    const from = ((box.top + y) * width + box.left) * 4;
    out.set(pixels.subarray(from, from + box.width * 4), y * box.width * 4);
  }
  return out;
}

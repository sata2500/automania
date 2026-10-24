import { describe, expect, it } from 'vitest';
import { greenScreenAlpha } from './chroma-key';

// Önceki (nesne tahsis eden) uygulamanın birebir kopyası: yeni hızlı yolun aynı sonucu verdiğini doğrular.
function legacyAlpha(r: number, g: number, b: number, alpha: number): number {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;
  let h = 0;
  const s = max === 0 ? 0 : d / max;
  const v = max;
  if (max !== min) {
    switch (max) {
      case rn: h = (gn - bn) / d + (gn < bn ? 6 : 0); break;
      case gn: h = (bn - rn) / d + 2; break;
      case bn: h = (rn - gn) / d + 4; break;
    }
    h /= 6;
  }
  h *= 360;
  const isColorful = s >= 0.15;
  const isNotBlack = v >= 0.15;
  if (h >= 70 && h <= 170 && isColorful && isNotBlack) return -1;
  const isEdgeGreen = (h >= 60 && h < 70) || (h > 170 && h <= 180);
  if (isEdgeGreen && isColorful && isNotBlack) {
    const distanceToCore = h < 70 ? 70 - h : h - 170;
    return Math.min(alpha, Math.round((distanceToCore / 10) * 255));
  }
  return alpha;
}

describe('greenScreenAlpha', () => {
  it('removes pure green and keeps other colors', () => {
    expect(greenScreenAlpha(0, 255, 0, 255)).toBe(-1);
    expect(greenScreenAlpha(255, 0, 0, 255)).toBe(255);
    expect(greenScreenAlpha(255, 255, 255, 255)).toBe(255);
    expect(greenScreenAlpha(0, 0, 0, 255)).toBe(255);
  });

  it('matches the previous implementation across the color space', () => {
    for (let r = 0; r <= 255; r += 5) {
      for (let g = 0; g <= 255; g += 5) {
        for (let b = 0; b <= 255; b += 5) {
          const expected = legacyAlpha(r, g, b, 255);
          const actual = greenScreenAlpha(r, g, b, 255);
          if (expected !== actual) throw new Error(`mismatch at ${r},${g},${b}: ${expected} vs ${actual}`);
        }
      }
    }
  });
});

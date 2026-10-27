import { describe, expect, it } from 'vitest';
import { analyzeBackground, keyOutSolidBackground } from './background-removal';

type Rgb = [number, number, number];
function image(w: number, h: number, paint: (x: number, y: number) => Rgb | null) {
  const data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const c = paint(x, y);
    data.set(c ? [...c, 255] : [0, 0, 0, 0], (y * w + x) * 4);
  }
  return data;
}
const inRect = (x: number, y: number, x0: number, y0: number, x1: number, y1: number) => x >= x0 && x < x1 && y >= y0 && y < y1;
const alphaAt = (d: Uint8Array, w: number, x: number, y: number) => d[(y * w + x) * 4 + 3];

describe('analyzeBackground', () => {
  it('classifies white, green screen, transparent and photo-like borders', () => {
    expect(analyzeBackground(image(40, 40, (x, y) => (inRect(x, y, 10, 10, 30, 30) ? [200, 0, 0] : [255, 255, 255])), 40, 40).kind).toBe('solid');
    expect(analyzeBackground(image(40, 40, () => [0, 255, 0]), 40, 40).kind).toBe('chroma');
    expect(analyzeBackground(image(40, 40, () => null), 40, 40).kind).toBe('transparent');
    expect(analyzeBackground(image(40, 40, (x, y) => [(x * 37) % 255, (y * 53) % 255, (x * y) % 255]), 40, 40).kind).toBe('complex');
  });
});

describe('keyOutSolidBackground', () => {
  it('removes the outer white background but keeps white areas enclosed by the design', () => {
    // Siyah çerçeveli kare; içi beyaz (ör. harf içi / göz akı) korunmalı.
    const data = image(40, 40, (x, y) => {
      if (!inRect(x, y, 10, 10, 30, 30)) return [255, 255, 255];
      return inRect(x, y, 13, 13, 27, 27) ? [255, 255, 255] : [20, 20, 20];
    });
    keyOutSolidBackground(data, 40, 40, { r: 255, g: 255, b: 255 });
    expect(alphaAt(data, 40, 2, 2)).toBe(0);
    expect(alphaAt(data, 40, 20, 20)).toBe(255);
    expect(alphaAt(data, 40, 11, 20)).toBe(255);
  });

  it('turns anti-aliased edge pixels semi-transparent without a white fringe', () => {
    const data = image(40, 10, (x) => (x === 19 ? [140, 140, 140] : x >= 20 && x < 30 ? [20, 20, 20] : [255, 255, 255]));
    keyOutSolidBackground(data, 40, 10, { r: 255, g: 255, b: 255 });
    const i = (5 * 40 + 19) * 4;
    expect(data[i + 3]).toBeGreaterThan(60);
    expect(data[i + 3]).toBeLessThan(255);
    expect(data[i]).toBeLessThan(80); // beyaz karışım arındırıldı, koyu kenar rengi kaldı
  });
});

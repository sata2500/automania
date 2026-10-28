import { describe, expect, it } from 'vitest';
import { cleanupVariantBackground } from './background-removal';

const W = 200, H = 200;
type Px = [number, number, number, number];

function image(paint: (x: number, y: number) => Px) {
  const data = new Uint8Array(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) data.set(paint(x, y), (y * W + x) * 4);
  return data;
}
const alphaAt = (data: Uint8Array, x: number, y: number) => data[(y * W + x) * 4 + 3];
const inCircle = (x: number, y: number, r: number) => (x - 100) ** 2 + (y - 100) ** 2 <= r * r;

const GREEN: Px = [0, 255, 0, 255];
const BLACK: Px = [8, 8, 10, 255];
const CREAM: Px = [240, 225, 190, 255];

describe('cleanupVariantBackground', () => {
  it('removes a black plate drawn behind the artwork on the key-colour canvas', () => {
    const data = image((x, y) => {
      if (inCircle(x, y, 40)) return CREAM;
      if (x >= 30 && x < 170 && y >= 30 && y < 170) return BLACK;
      return GREEN;
    });
    cleanupVariantBackground(data, W, H, { r: 0, g: 255, b: 0 });
    expect(alphaAt(data, 5, 5)).toBe(0);      // perde
    expect(alphaAt(data, 35, 35)).toBe(0);    // plaka köşesi
    expect(alphaAt(data, 100, 100)).toBe(255); // tasarım
  });

  it('removes a fully black canvas without touching the artwork', () => {
    const data = image((x, y) => (inCircle(x, y, 50) ? CREAM : BLACK));
    cleanupVariantBackground(data, W, H, { r: 0, g: 255, b: 0 });
    expect(alphaAt(data, 2, 2)).toBe(0);
    expect(alphaAt(data, 100, 100)).toBe(255);
  });

  it('keeps a round dark badge (not a rectangular plate)', () => {
    const data = image((x, y) => {
      if (inCircle(x, y, 30)) return CREAM;
      if (inCircle(x, y, 90)) return BLACK;
      return GREEN;
    });
    cleanupVariantBackground(data, W, H, { r: 0, g: 255, b: 0 });
    expect(alphaAt(data, 2, 2)).toBe(0);
    expect(alphaAt(data, 100, 30)).toBe(255); // amblemin koyu halkası korunur
  });
});

describe('removeBackgroundAuto on a transparent design with a plate', () => {
  it('removes the plate instead of reporting the background as already transparent', async () => {
    const sharp = (await import('sharp')).default;
    const { removeBackgroundAuto } = await import('./background-removal');
    const data = image((x, y) => {
      if (inCircle(x, y, 40)) return CREAM;
      if (x >= 30 && x < 170 && y >= 30 && y < 170) return BLACK;
      return [0, 0, 0, 0];
    });
    const png = await sharp(Buffer.from(data), { raw: { width: W, height: H, channels: 4 } }).png().toBuffer();
    const result = await removeBackgroundAuto(png);
    const { data: out } = await sharp(result.pngBuffer).raw().toBuffer({ resolveWithObject: true });
    expect(alphaAt(new Uint8Array(out), 35, 35)).toBe(0);
    expect(alphaAt(new Uint8Array(out), 100, 100)).toBe(255);
  });
});

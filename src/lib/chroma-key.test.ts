import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { estimateKeyColor, keyOutBackground, removeChromaBackground } from './chroma-key';

type Rgb = [number, number, number];
const KEY: Rgb = [0, 255, 0];

/** w×h RGBA görsel; paint(x, y) piksel rengini döner (varsayılan perde). */
function image(w: number, h: number, paint: (x: number, y: number) => Rgb | undefined) {
  const data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const [r, g, b] = paint(x, y) ?? KEY;
      data.set([r, g, b, 255], (y * w + x) * 4);
    }
  }
  return data;
}

const px = (data: Uint8Array, w: number, x: number, y: number) => Array.from(data.slice((y * w + x) * 4, (y * w + x) * 4 + 4));
const inRect = (x: number, y: number, x0: number, y0: number, x1: number, y1: number) => x >= x0 && x < x1 && y >= y0 && y < y1;

describe('keyOutBackground', () => {
  it('removes the outer green screen but keeps the design\'s own greens', () => {
    const tree: Rgb = [46, 107, 58]; // koyu yeşil ağaç
    const light: Rgb = [93, 216, 74]; // açık yeşil ampul, siyah konturlu
    const data = image(60, 40, (x, y) => {
      if (inRect(x, y, 5, 5, 20, 35)) return tree;
      if (inRect(x, y, 30, 10, 50, 30)) return inRect(x, y, 32, 12, 48, 28) ? light : [17, 17, 17];
      return undefined;
    });
    keyOutBackground(data, 60, 40);
    expect(px(data, 60, 0, 0)[3]).toBe(0);
    expect(px(data, 60, 25, 20)[3]).toBe(0);
    expect(px(data, 60, 12, 20)).toEqual([...tree, 255]);
    expect(px(data, 60, 40, 20)).toEqual([...light, 255]);
  });

  it('clears enclosed holes that match the screen color (letter counters)', () => {
    const red: Rgb = [192, 57, 43];
    const data = image(40, 40, (x, y) => {
      if (!inRect(x, y, 8, 8, 32, 32)) return undefined;
      return inRect(x, y, 14, 14, 26, 26) ? undefined : red;
    });
    keyOutBackground(data, 40, 40);
    expect(px(data, 40, 20, 20)[3]).toBe(0);
    expect(px(data, 40, 10, 20)).toEqual([...red, 255]);
  });

  it('unmixes anti-aliased edges instead of leaving a green fringe', () => {
    const red: Rgb = [200, 30, 30];
    // 20–29 arası kırmızı; 19. sütun yarı yarıya kırmızı/perde karışımı (kenar yumuşatma).
    const data = image(40, 10, (x) => {
      if (x === 19) return [100, 142, 15];
      return x >= 20 && x < 30 ? red : undefined;
    });
    keyOutBackground(data, 40, 10);
    const [r, g, b, a] = px(data, 40, 19, 5);
    expect(a).toBeGreaterThan(100);
    expect(a).toBeLessThan(160);
    expect(g).toBeLessThanOrEqual(Math.max(r!, b!)); // yeşil taşma bastırıldı
    expect(r).toBeGreaterThan(150);
  });

  it('turns a soft glow over the screen into partial transparency of the glow color', () => {
    const cream: Rgb = [255, 243, 196];
    const glow: Rgb = [89, 254, 69]; // %35 krem + %65 perde
    const data = image(80, 40, (x, y) => {
      if (inRect(x, y, 30, 12, 50, 28)) return cream;
      if (inRect(x, y, 20, 4, 60, 36)) return glow;
      return undefined;
    });
    keyOutBackground(data, 80, 40);
    const [r, g, b, a] = px(data, 80, 24, 20);
    expect(a).toBeGreaterThan(60);
    expect(a).toBeLessThan(130);
    expect(Math.abs(r! - cream[0])).toBeLessThan(30);
    expect(g).toBeLessThan(250);
    expect(b).toBeGreaterThan(150);
    expect(px(data, 80, 40, 20)).toEqual([...cream, 255]);
  });
});

describe('estimateKeyColor', () => {
  it('measures an off-pure screen color from the borders', () => {
    const data = image(30, 30, (x, y) => (inRect(x, y, 10, 10, 20, 20) ? [200, 0, 0] : [20, 230, 30]));
    expect(estimateKeyColor(data, 30, 30, 4)).toEqual({ r: 20, g: 230, b: 30 });
  });

  it('falls back to pure green when the borders are not a green screen', () => {
    const data = image(30, 30, () => [240, 240, 240]);
    expect(estimateKeyColor(data, 30, 30, 4)).toEqual({ r: 0, g: 255, b: 0 });
  });
});

describe('removeChromaBackground', () => {
  it('returns a transparent PNG and the removed ratio', async () => {
    const data = image(20, 20, (x, y) => (inRect(x, y, 5, 5, 15, 15) ? [30, 30, 30] : undefined));
    const input = await sharp(Buffer.from(data), { raw: { width: 20, height: 20, channels: 4 } }).png().toBuffer();
    const result = await removeChromaBackground(input);
    expect(result.removedRatio).toBeCloseTo(0.75, 1);
    const meta = await sharp(result.pngBuffer).metadata();
    expect(meta.format).toBe('png');
    expect(meta.hasAlpha).toBe(true);
    expect([result.width, result.height]).toEqual([20, 20]);
    // Saydam piksellerde perde rengi saklı kalmaz (saydamlığı yok sayan görüntüleyicilerde yeşil görünmez).
    const raw = await sharp(result.pngBuffer).raw().toBuffer();
    expect(Array.from(raw.subarray(0, 4))).toEqual([0, 0, 0, 0]);
  });
});

describe('other screens and framed images', () => {
  it('keys out a magenta screen while keeping greens and pinks that differ from it', () => {
    const tree: Rgb = [46, 107, 58];
    const rose: Rgb = [176, 58, 92]; // koyu pembe, magentadan farklı
    const data = image(60, 30, (x, y) => {
      if (inRect(x, y, 5, 5, 25, 25)) return tree;
      if (inRect(x, y, 35, 5, 55, 25)) return rose;
      return [255, 0, 255];
    });
    keyOutBackground(data, 60, 30);
    expect(px(data, 60, 0, 0)[3]).toBe(0);
    expect(px(data, 60, 30, 15)[3]).toBe(0);
    expect(px(data, 60, 15, 15)).toEqual([...tree, 255]);
    expect(px(data, 60, 45, 15)).toEqual([...rose, 255]);
  });

  it('finds the screen even when a dark frame surrounds the image', () => {
    const data = image(80, 80, (x, y) => {
      if (!inRect(x, y, 4, 4, 76, 76)) return [0, 0, 0];
      return inRect(x, y, 30, 30, 50, 50) ? [200, 40, 40] : [8, 227, 49];
    });
    keyOutBackground(data, 80, 80);
    expect(px(data, 80, 15, 15)[3]).toBe(0);
    expect(px(data, 80, 40, 40)).toEqual([200, 40, 40, 255]);
  });
});

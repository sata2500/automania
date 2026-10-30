import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { encodePng } from '@/lib/png-encoder';
import { runPixelOp } from './pixel-ops';

async function decode(png: Uint8Array) {
  const { data, info } = await sharp(Buffer.from(png)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, info };
}

/** Beyaz zemin ortasında kenarları yumuşak olmayan kırmızı kare. */
function squareOnWhite(size = 60, inner = 20) {
  const data = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const inside = x >= inner && x < size - inner && y >= inner && y < size - inner;
      data[i] = inside ? 200 : 255; data[i + 1] = inside ? 20 : 255; data[i + 2] = inside ? 30 : 255; data[i + 3] = 255;
    }
  }
  return data;
}

describe('encodePng', () => {
  it('pikselleri kayıpsız kodlar (saydam görsel RGBA)', async () => {
    const width = 7, height = 5;
    const rgba = new Uint8Array(width * height * 4);
    for (let i = 0; i < rgba.length; i++) rgba[i] = (i * 37) % 256;
    const { data, info } = await decode(encodePng(rgba, width, height));
    expect(info.width).toBe(width);
    expect(info.height).toBe(height);
    expect(Buffer.from(data).equals(Buffer.from(rgba))).toBe(true);
  });

  it('opak görseli alfa kanalsız yazar', async () => {
    const rgba = squareOnWhite(10, 3);
    const png = encodePng(rgba, 10, 10);
    const meta = await sharp(Buffer.from(png)).metadata();
    expect(meta.hasAlpha).toBe(false);
    const { data } = await decode(png);
    expect(Buffer.from(data).equals(Buffer.from(rgba))).toBe(true);
  });
});

describe('runPixelOp', () => {
  it('düz zemini kaldırır ve saydam boşlukları kırpar', async () => {
    const result = runPixelOp({ type: 'remove-bg' }, squareOnWhite(), 60, 60);
    expect(result.removedRatio).toBeGreaterThan(0.5);
    // Kare 20 px; %2 pay bu boyutta 0 px
    expect(result.width).toBe(20);
    expect(result.height).toBe(20);
    const { data } = await decode(result.png!);
    const center = (10 * 20 + 10) * 4;
    expect([data[center], data[center + 1], data[center + 2], data[center + 3]]).toEqual([200, 20, 30, 255]);
  });

  it('saydam zemini olmayan tasarımda kumaşa uyarlama açıklayıcı hata verir', () => {
    expect(() => runPixelOp({ type: 'recolor', mode: 'dark_garment' }, squareOnWhite(), 60, 60)).toThrow(/saydam değil/);
  });

  it('koyu kumaş için siyah konturu açar', async () => {
    const size = 30;
    const data = new Uint8ClampedArray(size * size * 4);
    for (let y = 10; y < 20; y++) for (let x = 10; x < 20; x++) data.set([0, 0, 0, 255], (y * size + x) * 4);
    const result = runPixelOp({ type: 'recolor', mode: 'dark_garment' }, data, size, size);
    expect(result.png).not.toBeNull();
    expect(result.changedRatio).toBeGreaterThan(0.5);
    const decoded = await decode(result.png!);
    const center = (Math.floor(result.height / 2) * result.width + Math.floor(result.width / 2)) * 4;
    expect(decoded.data[center]).toBeGreaterThan(200);
  });

  it('encode: değiştirmeden kırpıp sıkıştırır', () => {
    const size = 40;
    const data = new Uint8ClampedArray(size * size * 4);
    for (let y = 15; y < 25; y++) for (let x = 15; x < 25; x++) data.set([10, 120, 200, 255], (y * size + x) * 4);
    const result = runPixelOp({ type: 'encode' }, data, size, size);
    expect(result.width).toBe(10);
    expect(result.png!.byteLength).toBeGreaterThan(0);
  });
});

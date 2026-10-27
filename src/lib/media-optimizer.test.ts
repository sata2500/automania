import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { optimizeImageForStorage } from './media-optimizer';

async function designPng(size: number) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
    <circle cx="${size / 2}" cy="${size / 2}" r="${size / 3}" fill="#c0392b" stroke="#111" stroke-width="${size / 50}"/>
    <text x="50%" y="55%" font-size="${size / 8}" text-anchor="middle" fill="#fff8e7">HELLO</text></svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

describe('optimizeImageForStorage', () => {
  it('stores designs as near-lossless WebP: smaller, alpha kept, pixels visually identical', async () => {
    const png = await designPng(800);
    const result = await optimizeImageForStorage(png, 'image/png', 'design');
    expect(result.mimeType).toBe('image/webp');
    expect(result.buffer.byteLength).toBeLessThan(png.byteLength);
    expect([result.width, result.height]).toEqual([800, 800]);
    const a = await sharp(png).ensureAlpha().raw().toBuffer();
    const b = await sharp(result.buffer).ensureAlpha().raw().toBuffer();
    let maxDiff = 0;
    for (let i = 0; i < a.length; i += 4) {
      if (a[i + 3]! === 0 && b[i + 3]! === 0) continue;
      for (let c = 0; c < 4; c++) maxDiff = Math.max(maxDiff, Math.abs(a[i + c]! - b[i + c]!));
    }
    expect(maxDiff).toBeLessThanOrEqual(8);
  });

  it('caps very large designs at 4500 px', async () => {
    const big = await sharp({ create: { width: 5000, height: 2500, channels: 4, background: { r: 10, g: 20, b: 30, alpha: 1 } } }).png().toBuffer();
    const result = await optimizeImageForStorage(big, 'image/png', 'design');
    expect([result.width, result.height]).toEqual([4500, 2250]);
  });

  it('keeps the original when re-encoding would not help', async () => {
    // Zaten sıkıştırılmış (kayıplı WebP) görsel yeniden kodlanınca büyür: orijinal saklanır.
    const lossy = await sharp(await designPng(600)).webp({ quality: 50 }).toBuffer();
    const result = await optimizeImageForStorage(lossy, 'image/webp', 'design');
    expect(result.optimized).toBe(false);
    expect(result.buffer).toBe(lossy);
  });
});

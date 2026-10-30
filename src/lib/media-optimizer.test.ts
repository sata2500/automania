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
  it('stores designs as lossless PNG: smaller, alpha kept, visible pixels identical', async () => {
    const png = await designPng(800);
    // Kırpma ayrı test edilir; burada piksel birebirliği tüm tuvalde karşılaştırılır.
    const result = await optimizeImageForStorage(png, 'image/png', 'design', { trim: false });
    expect(result.mimeType).toBe('image/png');
    expect(result.buffer.byteLength).toBeLessThanOrEqual(png.byteLength);
    expect([result.width, result.height]).toEqual([800, 800]);
    const a = await sharp(png).ensureAlpha().raw().toBuffer();
    const b = await sharp(result.buffer).ensureAlpha().raw().toBuffer();
    let maxDiff = 0;
    for (let i = 0; i < a.length; i += 4) {
      if (a[i + 3]! === 0 && b[i + 3]! === 0) continue;
      for (let c = 0; c < 4; c++) maxDiff = Math.max(maxDiff, Math.abs(a[i + c]! - b[i + c]!));
    }
    expect(maxDiff).toBe(0);
  });

  it('makes a loosely compressed PNG smaller without changing it', async () => {
    const loose = await sharp(await designPng(800)).png({ compressionLevel: 0 }).toBuffer();
    const result = await optimizeImageForStorage(loose, 'image/png', 'design');
    expect(result.optimized).toBe(true);
    expect(result.buffer.byteLength).toBeLessThan(loose.byteLength / 3);
  });

  it('caps very large designs at 4500 px', async () => {
    const big = await sharp({ create: { width: 5000, height: 2500, channels: 4, background: { r: 10, g: 20, b: 30, alpha: 1 } } }).png().toBuffer();
    const result = await optimizeImageForStorage(big, 'image/png', 'design');
    expect([result.width, result.height]).toEqual([4500, 2250]);
  });

  it('keeps the original when re-encoding would not help', async () => {
    // Zaten sıkıştırılmış (kayıplı WebP) görsel PNG'ye çevrilince büyür: orijinal saklanır.
    const lossy = await sharp(await designPng(600)).webp({ quality: 50 }).toBuffer();
    const result = await optimizeImageForStorage(lossy, 'image/webp', 'design', { trim: false });
    expect(result.optimized).toBe(false);
    expect(result.buffer).toBe(lossy);
  });
});

describe('transparent trim', () => {
  async function paddedDesign() {
    // 1000×800 tuval, ortada 400×200 opak dikdörtgen (300,300)-(699,499); geri kalanı saydam.
    const rect = await sharp({ create: { width: 400, height: 200, channels: 4, background: { r: 200, g: 30, b: 30, alpha: 1 } } }).png().toBuffer();
    return sharp({ create: { width: 1000, height: 800, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: rect, left: 300, top: 300 }]).png().toBuffer();
  }

  it('trims transparent margins of designs, leaving a 2% pad', async () => {
    const result = await optimizeImageForStorage(await paddedDesign(), 'image/png', 'design');
    expect(result.optimized).toBe(true);
    // Pay: en uzun kenarın %2'si = 8 px.
    expect([result.width, result.height]).toEqual([416, 216]);
    const meta = await sharp(result.buffer).metadata();
    expect([meta.width, meta.height]).toEqual([416, 216]);
  });

  it('does not trim when disabled (raw AI output) or when the image is opaque', async () => {
    const raw = await optimizeImageForStorage(await paddedDesign(), 'image/png', 'design', { trim: false });
    expect([raw.width, raw.height]).toEqual([1000, 800]);
    const opaque = await sharp({ create: { width: 300, height: 200, channels: 3, background: { r: 255, g: 255, b: 255 } } }).png().toBuffer();
    const kept = await optimizeImageForStorage(opaque, 'image/png', 'design');
    expect([kept.width, kept.height]).toEqual([300, 200]);
  });

  it('is idempotent: an already trimmed design is not changed again', async () => {
    const first = await optimizeImageForStorage(await paddedDesign(), 'image/png', 'design');
    const second = await optimizeImageForStorage(first.buffer, 'image/png', 'design');
    expect(second.optimized).toBe(false);
    expect([second.width, second.height]).toEqual([416, 216]);
  });

  it('stores mockup photos as JPEG on a white background, max 3000 px', async () => {
    const photo = await sharp({ create: { width: 4000, height: 3000, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: await designPng(1500), top: 750, left: 1250 }])
      .png()
      .toBuffer();
    const result = await optimizeImageForStorage(photo, 'image/png', 'photo');
    expect(result.mimeType).toBe('image/jpeg');
    expect([result.width, result.height]).toEqual([3000, 2250]);
    const { data } = await sharp(result.buffer).raw().toBuffer({ resolveWithObject: true });
    expect([data[0], data[1], data[2]]).toEqual([255, 255, 255]); // saydam köşe beyaz
  });
});

import { describe, expect, it } from 'vitest';
import { adaptToFabric, recolorPixel } from './recolor';

const lum = ([r, g, b]: [number, number, number]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

describe('recolorPixel', () => {
  it('dark garment: black and navy become light, light colors stay', () => {
    const black = recolorPixel(0, 0, 0, 'dark_garment')!;
    expect(lum(black)).toBeGreaterThan(200);
    const navy = recolorPixel(20, 30, 90, 'dark_garment')!;
    expect(navy[2]).toBeGreaterThan(navy[0]); // hâlâ mavi
    expect(lum(navy)).toBeGreaterThan(110);
    expect(recolorPixel(255, 255, 255, 'dark_garment')).toBeNull();
    expect(recolorPixel(250, 200, 40, 'dark_garment')).toBeNull(); // sarı zaten açık
  });

  it('light garment: white becomes dark, pale yellow stays yellow but darker, dark colors stay', () => {
    const white = recolorPixel(255, 255, 255, 'light_garment')!;
    expect(lum(white)).toBeLessThan(60);
    const pale = recolorPixel(255, 240, 150, 'light_garment')!;
    expect(lum(pale)).toBeLessThan(170);
    expect(pale[0]).toBeGreaterThan(pale[2]); // sarı tonu korundu
    expect(recolorPixel(0, 0, 0, 'light_garment')).toBeNull();
    expect(recolorPixel(180, 30, 30, 'light_garment')).toBeNull();
  });

  it('adapts lines that touch the fabric but keeps dark text on the design\'s own light plate', () => {
    // 60x30: solda zeminsiz siyah çizgi (kumaşa değer), sağda krem plaka üzerinde siyah yazı.
    const w = 60, h = 30;
    const data = new Uint8Array(w * h * 4);
    const set = (x: number, y: number, c: number[]) => data.set(c, (y * w + x) * 4);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) set(x, y, [0, 0, 0, 0]);
    for (let y = 5; y < 25; y++) for (let x = 5; x < 8; x++) set(x, y, [0, 0, 0, 255]);
    for (let y = 2; y < 28; y++) for (let x = 20; x < 58; x++) set(x, y, [240, 230, 200, 255]);
    for (let y = 12; y < 18; y++) for (let x = 35; x < 45; x++) set(x, y, [0, 0, 0, 255]);
    adaptToFabric(data, w, h, 'dark_garment');
    expect(data[(10 * w + 6) * 4]).toBeGreaterThan(200); // çizgi açıldı
    expect(data[(15 * w + 40) * 4]).toBe(0); // plakadaki yazı aynı
    expect(data[(15 * w + 30) * 4]).toBe(240); // plaka aynı
    expect(data[(10 * w + 6) * 4 + 3]).toBe(255); // alfa aynı
  });

  it('does nothing on an image without transparency', () => {
    const data = new Uint8Array([0, 0, 0, 255, 0, 0, 0, 255]);
    expect(adaptToFabric(data, 2, 1, 'dark_garment')).toBe(-1);
  });
});

import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { renderMockupJpeg } from './server-mockup-render';

const solid = (width: number, height: number, r: number, g: number, b: number, alpha = 1) =>
  sharp({ create: { width, height, channels: 4, background: { r, g, b, alpha } } }).png().toBuffer();

async function pixel(buffer: Buffer, x: number, y: number) {
  const { data, info } = await sharp(buffer).raw().toBuffer({ resolveWithObject: true });
  const i = (y * info.width + x) * info.channels;
  return [data[i]!, data[i + 1]!, data[i + 2]!];
}

const close = (a: number[], b: number[]) => a.every((v, i) => Math.abs(v - b[i]!) <= 12);

describe('renderMockupJpeg', () => {
  it('fits the design into the print area, centred, keeping its aspect ratio', async () => {
    const mockup = await solid(400, 400, 255, 255, 255);
    const design = await solid(100, 50, 200, 0, 0); // 2:1
    const area = { id: 'a', name: '', x: 25, y: 25, width: 50, height: 50, rotation: 0 }; // 200x200 kutu
    const out = await renderMockupJpeg(mockup, design, { printAreas: [area] });
    expect([out.width, out.height]).toEqual([400, 400]);
    // Tasarım 200x100 olarak kutunun ortasına oturur: y 150..250
    expect(close(await pixel(out.buffer, 200, 200), [200, 0, 0])).toBe(true);
    expect(close(await pixel(out.buffer, 200, 140), [255, 255, 255])).toBe(true);
    expect(close(await pixel(out.buffer, 110, 200), [200, 0, 0])).toBe(true);
  });

  it('rotates around the area centre and clips overflow at the canvas edge', async () => {
    const mockup = await solid(300, 300, 255, 255, 255);
    const design = await solid(200, 200, 0, 0, 200);
    const area = { id: 'a', name: '', x: 50, y: 50, width: 60, height: 60, rotation: 45 }; // sağ alta taşar
    const out = await renderMockupJpeg(mockup, design, { printAreas: [area] });
    expect([out.width, out.height]).toEqual([300, 300]);
    expect(close(await pixel(out.buffer, 240, 240), [0, 0, 200])).toBe(true);
  });

  it('puts transparent mockup areas on white and keeps static images without a design', async () => {
    const mockup = await solid(100, 60, 0, 0, 0, 0);
    const out = await renderMockupJpeg(mockup, null, { printAreas: [] });
    expect(close(await pixel(out.buffer, 50, 30), [255, 255, 255])).toBe(true);
    expect((await sharp(out.buffer).metadata()).format).toBe('jpeg');
  });

  it('applies mockup opacity to the design', async () => {
    const mockup = await solid(100, 100, 255, 255, 255);
    const design = await solid(100, 100, 0, 0, 0);
    const out = await renderMockupJpeg(mockup, design, { printAreas: [{ id: 'a', name: '', x: 0, y: 0, width: 100, height: 100, rotation: 0 }], opacity: 0.5 });
    const [r] = await pixel(out.buffer, 50, 50);
    expect(r).toBeGreaterThan(100);
    expect(r).toBeLessThan(160);
  });
});

/**
 * Sunucuda mockup üretimi (giriş yapılmış manuel üretim): tasarım, mockup'ın baskı alanlarına tarayıcıdaki
 * önizlemeyle (`canvas-renderer`) aynı kurallarla yerleştirilir ve Etsy'ye gidecek JPEG üretilir.
 *  - Tasarım baskı alanına en-boy oranı korunarak sığdırılır ve alanın ortasına konur; alan dönükse tasarım
 *    alanın merkezi etrafında döndürülür.
 *  - Mockup saydamlığı (opacity) ve 'square' dışa aktarım (kare tuvale sığdırma) desteklenir.
 *  - Saydam alanlar beyaz zemine oturur; çıktı mozjpeg q90 (renk alt örneklemesi yok).
 */
import sharp, { type OverlayOptions } from 'sharp';
import type { PrintArea } from '@/types/pod';

export type ServerRenderMockup = {
  printAreas: PrintArea[];
  opacity?: number;
  exportAspect?: 'original' | 'square';
};

/** Bindirmeyi tuvalin dışına taşan kısmından kırpar (sharp, taşan bindirmeyi kabul etmez). */
async function clipOverlay(input: Buffer, width: number, height: number, left: number, top: number, canvasW: number, canvasH: number) {
  const x0 = Math.max(0, left), y0 = Math.max(0, top);
  const x1 = Math.min(canvasW, left + width), y1 = Math.min(canvasH, top + height);
  if (x1 <= x0 || y1 <= y0) return null;
  if (x0 === left && y0 === top && x1 === left + width && y1 === top + height) return { input, left, top };
  const clipped = await sharp(input).extract({ left: x0 - left, top: y0 - top, width: x1 - x0, height: y1 - y0 }).png().toBuffer();
  return { input: clipped, left: x0, top: y0 };
}

export async function renderMockupJpeg(mockupBuffer: Buffer, designBuffer: Buffer | null, mockup: ServerRenderMockup): Promise<{ buffer: Buffer; width: number; height: number }> {
  // EXIF yönü uygulanır (tarayıcı da görseli yönüne göre çizer).
  const { data: oriented, info: orientedInfo } = await sharp(mockupBuffer).rotate().toBuffer({ resolveWithObject: true });
  const origW = orientedInfo.width;
  const origH = orientedInfo.height;
  // Önizlemeyle aynı: 'square' tuvalde görsel kareye uzatılır (mockup düzenleyicisi kırpmayı zaten yapar).
  const square = mockup.exportAspect === 'square';
  const canvasW = square ? Math.max(origW, origH) : origW;
  const canvasH = square ? Math.max(origW, origH) : origH;
  const background = await sharp(oriented).resize(canvasW, canvasH, { fit: 'fill' }).flatten({ background: '#ffffff' }).toBuffer();

  const overlays: OverlayOptions[] = [];
  if (designBuffer && mockup.printAreas.length > 0) {
    const designMeta = await sharp(designBuffer).metadata();
    const dW = designMeta.width || 1000;
    const dH = designMeta.height || 1000;
    const opacity = Math.min(1, Math.max(0, mockup.opacity ?? 1));
    for (const area of mockup.printAreas) {
      const boxW = (area.width / 100) * canvasW;
      const boxH = (area.height / 100) * canvasH;
      const centerX = (area.x / 100) * canvasW + boxW / 2;
      const centerY = (area.y / 100) * canvasH + boxH / 2;
      const scale = Math.min(boxW / dW, boxH / dH);
      const drawW = Math.max(1, Math.round(dW * scale));
      const drawH = Math.max(1, Math.round(dH * scale));
      let pipeline = sharp(designBuffer).ensureAlpha().resize(drawW, drawH, { fit: 'fill', kernel: 'lanczos3' });
      if (area.rotation) pipeline = sharp(await pipeline.png().toBuffer()).rotate(area.rotation, { background: { r: 0, g: 0, b: 0, alpha: 0 } });
      let { data, info } = await pipeline.raw().toBuffer({ resolveWithObject: true });
      if (opacity < 1) {
        data = Buffer.from(data);
        for (let i = 3; i < data.length; i += 4) data[i] = Math.round(data[i]! * opacity);
      }
      const png = await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
      const clipped = await clipOverlay(png, info.width, info.height, Math.round(centerX - info.width / 2), Math.round(centerY - info.height / 2), canvasW, canvasH);
      if (clipped) overlays.push(clipped);
    }
  }

  const buffer = await sharp(background)
    .composite(overlays)
    .jpeg({ quality: 90, mozjpeg: true, chromaSubsampling: '4:4:4' })
    .toBuffer();
  return { buffer, width: canvasW, height: canvasH };
}

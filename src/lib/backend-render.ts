import sharp from 'sharp';
import { PrintArea } from '@/types/pod';

/**
 * Renders a transparent design PNG onto a mockup image at the specified print area.
 * 
 * @param mockupBuffer - The raw image buffer of the mockup (e.g. from R2)
 * @param designBuffer - The transparent PNG buffer of the design
 * @param printArea - The coordinates and dimensions as percentages (0-100)
 * @returns The composited PNG image as a Buffer
 */
export async function renderDesignOnMockup(
  mockupBuffer: Buffer,
  designBuffer: Buffer,
  printArea: PrintArea
): Promise<Buffer> {
  const mockup = sharp(mockupBuffer);
  const mMetadata = await mockup.metadata();
  
  const mWidth = mMetadata.width || 1000;
  const mHeight = mMetadata.height || 1000;
  
  const pxWidth = Math.round((printArea.width / 100) * mWidth);
  const pxHeight = Math.round((printArea.height / 100) * mHeight);
  const pxX = Math.round((printArea.x / 100) * mWidth);
  const pxY = Math.round((printArea.y / 100) * mHeight);

  // Resize design to fit inside the print area box
  const design = sharp(designBuffer)
    .resize(pxWidth, pxHeight, {
      fit: 'inside',
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    });

  let processedDesignBuffer = await design.toBuffer();

  if (printArea.rotation && printArea.rotation !== 0) {
    processedDesignBuffer = await sharp(processedDesignBuffer)
      .rotate(printArea.rotation, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .toBuffer();
  }
  
  const dMetadata = await sharp(processedDesignBuffer).metadata();
  const dWidth = dMetadata.width || 0;
  const dHeight = dMetadata.height || 0;

  const finalX = Math.round(pxX + (pxWidth - dWidth) / 2);
  const finalY = Math.round(pxY + (pxHeight - dHeight) / 2);

  const finalBuffer = await mockup
    .composite([
      {
        input: processedDesignBuffer,
        top: finalY,
        left: finalX,
        blend: 'over'
      }
    ])
    .png()
    .toBuffer();

  return finalBuffer;
}

import { Jimp } from 'jimp';
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
  // Load both images using Jimp
  const mockup = await Jimp.read(mockupBuffer);
  const design = await Jimp.read(designBuffer);

  const mWidth = mockup.bitmap.width;
  const mHeight = mockup.bitmap.height;

  // Convert print area percentages to actual pixels
  const pxWidth = (printArea.width / 100) * mWidth;
  const pxHeight = (printArea.height / 100) * mHeight;
  const pxX = (printArea.x / 100) * mWidth;
  const pxY = (printArea.y / 100) * mHeight;

  // First, scale the design to fit within the print area dimensions.
  // We use contain/scaleToFit logic to maintain the design's aspect ratio
  // while ensuring it fits inside the print area box.
  design.scaleToFit(pxWidth, pxHeight);

  // If there's a rotation, apply it.
  if (printArea.rotation && printArea.rotation !== 0) {
    // Jimp's rotate takes degrees. Background color is transparent by default (0x00000000).
    design.rotate(-printArea.rotation, false);
  }

  // Calculate the centered position of the scaled/rotated design within the print area box.
  // The print area's (X, Y) usually refers to its top-left corner in standard coords.
  const dWidth = design.bitmap.width;
  const dHeight = design.bitmap.height;
  
  const finalX = pxX + (pxWidth - dWidth) / 2;
  const finalY = pxY + (pxHeight - dHeight) / 2;

  // Composite the design over the mockup
  mockup.composite(design, finalX, finalY, {
    mode: Jimp.BLEND_SOURCE_OVER,
    opacitySource: 1,
    opacityDest: 1
  });

  // Export the result as PNG
  return await mockup.getBufferAsync(Jimp.MIME_PNG);
}

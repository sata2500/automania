import { loadImage } from './canvas-renderer';

/**
 * Crops or fits an image into a clean 1:1 Square canvas aspect ratio
 */
export async function cropImageToSquare(
  imageSrc: string,
  targetSize: number = 1500
): Promise<string> {
  const img = await loadImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) throw new Error('Could not get canvas context');

  canvas.width = targetSize;
  canvas.height = targetSize;

  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;

  // Determine crop dimensions (contain / cover centered fit)
  let srcX = 0;
  let srcY = 0;
  let srcW = w;
  let srcH = h;

  if (w > h) {
    srcW = h;
    srcX = (w - h) / 2;
  } else if (h > w) {
    srcH = w;
    srcY = (h - w) / 2;
  }

  // Draw center cropped 1:1 square
  ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, targetSize, targetSize);

  return canvas.toDataURL('image/png');
}

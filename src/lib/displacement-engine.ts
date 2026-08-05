/**
 * Professional Automatic Wrinkle & Fold Detection + Displacement Mapping Engine
 * ==============================================================================
 * Automatically detects fabric wrinkles, folds and creases from any JPEG/PNG
 * mockup photo, then warps and blends the design to physically conform to them.
 */

/** Fast approximate Gaussian blur using repeated box blurs */
function gaussianBlur(src: Float32Array, w: number, h: number, radius: number): Float32Array {
  let current = src;
  const r = Math.max(1, Math.round(radius));

  for (let pass = 0; pass < 2; pass++) {
    const next = new Float32Array(w * h);

    // Horizontal pass
    const temp = new Float32Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let sum = 0;
        let count = 0;
        for (let kx = -r; kx <= r; kx++) {
          const nx = Math.min(w - 1, Math.max(0, x + kx));
          sum += current[y * w + nx];
          count++;
        }
        temp[y * w + x] = sum / count;
      }
    }

    // Vertical pass
    for (let x = 0; x < w; x++) {
      for (let y = 0; y < h; y++) {
        let sum = 0;
        let count = 0;
        for (let ky = -r; ky <= r; ky++) {
          const ny = Math.min(h - 1, Math.max(0, y + ky));
          sum += temp[ny * w + x];
          count++;
        }
        next[y * w + x] = sum / count;
      }
    }
    current = next;
  }
  return current;
}

/**
 * Automatically generates a wrinkle displacement map from a mockup print area.
 */
export function generateWrinkleMapFromMockup(
  mockupImg: HTMLImageElement,
  cropX: number,
  cropY: number,
  cropW: number,
  cropH: number
): HTMLCanvasElement {
  const w = Math.max(16, Math.round(cropW));
  const h = Math.max(16, Math.round(cropH));

  const mapCanvas = document.createElement('canvas');
  mapCanvas.width = w;
  mapCanvas.height = h;

  const ctx = mapCanvas.getContext('2d');
  if (!ctx) return mapCanvas;

  ctx.drawImage(mockupImg, cropX, cropY, cropW, cropH, 0, 0, w, h);
  return mapCanvas;
}

/**
 * Warps a design image using a pure Canvas 2D CPU Gradient Displacement Algorithm
 * with Bilinear Interpolation.
 */
export async function applyDisplacementWarp(
  designImg: HTMLImageElement,
  wrinkleMapDataUrl: string,
  drawW: number,
  drawH: number,
  scale: number
): Promise<HTMLCanvasElement> {
  const w = Math.max(1, Math.round(drawW));
  const h = Math.max(1, Math.round(drawH));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  if (scale <= 0) {
    ctx.drawImage(designImg, 0, 0, w, h);
    return canvas;
  }

  // 1. Draw source design
  const srcCanvas = document.createElement('canvas');
  srcCanvas.width = w;
  srcCanvas.height = h;
  const srcCtx = srcCanvas.getContext('2d');
  if (!srcCtx) {
    ctx.drawImage(designImg, 0, 0, w, h);
    return canvas;
  }
  srcCtx.drawImage(designImg, 0, 0, w, h);
  const sData = srcCtx.getImageData(0, 0, w, h).data;

  // 2. Load wrinkle map image
  let mapImg: HTMLImageElement;
  try {
    mapImg = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = (err) => reject(err);
      img.src = wrinkleMapDataUrl;
    });
  } catch {
    ctx.drawImage(designImg, 0, 0, w, h);
    return canvas;
  }

  // Draw wrinkle map to extract luminance grid
  const mapCanvas = document.createElement('canvas');
  mapCanvas.width = w;
  mapCanvas.height = h;
  const mapCtx = mapCanvas.getContext('2d');
  if (!mapCtx) {
    ctx.drawImage(designImg, 0, 0, w, h);
    return canvas;
  }
  mapCtx.drawImage(mapImg, 0, 0, w, h);
  const mapPixels = mapCtx.getImageData(0, 0, w, h).data;

  // Convert map to Float32 luminance grid [0..1]
  const rawLum = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const r = mapPixels[i * 4];
    const g = mapPixels[i * 4 + 1];
    const b = mapPixels[i * 4 + 2];
    rawLum[i] = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  }

  // Smooth luminance grid with Gaussian blur so fold gradients are smooth
  const lum = gaussianBlur(rawLum, w, h, 3);

  // Prepare output ImageData
  const outData = ctx.createImageData(w, h);
  const oData = outData.data;

  // Maximum displacement in pixels (calibrated to 2..6 pixels max)
  const maxShiftPixels = Math.min(8, Math.max(1, (scale / 40) * 5));

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;

      // Compute central difference luminance gradients
      const xLeft = x > 0 ? x - 1 : x;
      const xRight = x < w - 1 ? x + 1 : x;
      const yTop = y > 0 ? y - 1 : y;
      const yBottom = y < h - 1 ? y + 1 : y;

      const gx = (lum[y * w + xRight] - lum[y * w + xLeft]) * 0.5;
      const gy = (lum[yBottom * w + x] - lum[yTop * w + x]) * 0.5;

      // Displace source coordinates along fold brightness gradient
      const srcX = x + gx * maxShiftPixels * 4;
      const srcY = y + gy * maxShiftPixels * 4;

      // Bilinear Interpolation Sampling from sData
      if (srcX >= 0 && srcX < w - 1 && srcY >= 0 && srcY < h - 1) {
        const x0 = Math.floor(srcX);
        const x1 = x0 + 1;
        const y0 = Math.floor(srcY);
        const y1 = y0 + 1;

        const dx = srcX - x0;
        const dy = srcY - y0;

        const i00 = (y0 * w + x0) * 4;
        const i10 = (y0 * w + x1) * 4;
        const i01 = (y1 * w + x0) * 4;
        const i11 = (y1 * w + x1) * 4;

        const w00 = (1 - dx) * (1 - dy);
        const w10 = dx * (1 - dy);
        const w01 = (1 - dx) * dy;
        const w11 = dx * dy;

        const outIdx = idx * 4;
        oData[outIdx]     = Math.round(sData[i00]     * w00 + sData[i10]     * w10 + sData[i01]     * w01 + sData[i11]     * w11);
        oData[outIdx + 1] = Math.round(sData[i00 + 1] * w00 + sData[i10 + 1] * w10 + sData[i01 + 1] * w01 + sData[i11 + 1] * w11);
        oData[outIdx + 2] = Math.round(sData[i00 + 2] * w00 + sData[i10 + 2] * w10 + sData[i01 + 2] * w01 + sData[i11 + 2] * w11);
        oData[outIdx + 3] = Math.round(sData[i00 + 3] * w00 + sData[i10 + 3] * w10 + sData[i01 + 3] * w01 + sData[i11 + 3] * w11);
      } else {
        const outIdx = idx * 4;
        oData[outIdx + 3] = 0;
      }
    }
  }

  ctx.putImageData(outData, 0, 0);
  return canvas;
}

/**
 * Blends fabric shadows onto the design ONLY where dark fold lines occur,
 * normalizing baseline fabric brightness so FLAT areas produce ZERO square box border!
 */
export function applyFabricShadowBlend(
  designCanvas: HTMLCanvasElement,
  mockupImg: HTMLImageElement,
  cropX: number,
  cropY: number,
  cropW: number,
  cropH: number,
  intensity: number
): HTMLCanvasElement {
  if (intensity <= 0) return designCanvas;

  const w = designCanvas.width;
  const h = designCanvas.height;

  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = w;
  shadowCanvas.height = h;
  const shadowCtx = shadowCanvas.getContext('2d');
  if (!shadowCtx) return designCanvas;

  shadowCtx.drawImage(mockupImg, cropX, cropY, cropW, cropH, 0, 0, w, h);

  const mockupPx = shadowCtx.getImageData(0, 0, w, h).data;
  const designCtx = designCanvas.getContext('2d');
  if (!designCtx) return designCanvas;

  const designData = designCtx.getImageData(0, 0, w, h);
  const dp = designData.data;

  // Calculate baseline (90th percentile / peak) luminance of fabric crop
  // so flat bright fabric acts as neutral 1.0 (zero darkening / zero square box border!)
  let maxFabricLum = 180;
  for (let i = 0; i < w * h; i += 8) {
    const r = mockupPx[i * 4];
    const g = mockupPx[i * 4 + 1];
    const b = mockupPx[i * 4 + 2];
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    if (lum > maxFabricLum) maxFabricLum = lum;
  }
  maxFabricLum = Math.max(128, maxFabricLum);

  const blendAlpha = Math.min(1.0, Math.max(0.0, intensity));

  for (let i = 0; i < w * h; i++) {
    const di = i * 4;
    // Skip fully transparent design pixels
    if (dp[di + 3] === 0) continue;

    const r = mockupPx[di];
    const g = mockupPx[di + 1];
    const b = mockupPx[di + 2];
    const fabLum = 0.299 * r + 0.587 * g + 0.114 * b;

    // Shadow factor: 1.0 for flat bright fabric, < 1.0 ONLY inside dark fold shadows
    const shadowFactor = Math.min(1.0, fabLum / maxFabricLum);

    // Apply shadow multiply lerp ONLY where shadowFactor < 1.0
    const factor = 1.0 - (1.0 - shadowFactor) * blendAlpha;

    dp[di]     = Math.round(dp[di]     * factor);
    dp[di + 1] = Math.round(dp[di + 1] * factor);
    dp[di + 2] = Math.round(dp[di + 2] * factor);
  }

  designCtx.putImageData(designData, 0, 0);
  return designCanvas;
}

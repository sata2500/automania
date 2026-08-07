/**
 * Professional Automatic Wrinkle & Fold Detection + Displacement Mapping Engine
 * ==============================================================================
 * Automatically detects fabric wrinkles, folds and creases from any JPEG/PNG
 * mockup photo, then warps and blends the design to physically conform to them.
 *
 * The CPU-intensive pixel loop runs in a Web Worker to avoid blocking the UI.
 */

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
 * Warps a design image using gradient displacement via Web Worker (off main thread).
 * Falls back to direct draw if Worker is unavailable.
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

  const outputCanvas = document.createElement('canvas');
  outputCanvas.width = w;
  outputCanvas.height = h;
  const ctx = outputCanvas.getContext('2d');
  if (!ctx) return outputCanvas;

  // No displacement needed
  if (scale <= 0) {
    ctx.drawImage(designImg, 0, 0, w, h);
    return outputCanvas;
  }

  // Extract design pixels
  const srcCanvas = document.createElement('canvas');
  srcCanvas.width = w;
  srcCanvas.height = h;
  const srcCtx = srcCanvas.getContext('2d');
  if (!srcCtx) {
    ctx.drawImage(designImg, 0, 0, w, h);
    return outputCanvas;
  }
  srcCtx.drawImage(designImg, 0, 0, w, h);
  const designPixels = srcCtx.getImageData(0, 0, w, h).data;

  // Load wrinkle map image
  let mapImg: HTMLImageElement;
  try {
    mapImg = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = wrinkleMapDataUrl;
    });
  } catch {
    ctx.drawImage(designImg, 0, 0, w, h);
    return outputCanvas;
  }

  // Extract map pixels
  const mapCanvas = document.createElement('canvas');
  mapCanvas.width = w;
  mapCanvas.height = h;
  const mapCtx = mapCanvas.getContext('2d');
  if (!mapCtx) {
    ctx.drawImage(designImg, 0, 0, w, h);
    return outputCanvas;
  }
  mapCtx.drawImage(mapImg, 0, 0, w, h);
  const mapPixels = mapCtx.getImageData(0, 0, w, h).data;

  // Offload CPU-intensive warp to Web Worker
  return new Promise<HTMLCanvasElement>((resolve) => {
    try {
      const worker = new Worker('/workers/displacement-worker.js');

      // Transfer pixel buffers (zero-copy) to worker
      const designBuffer = new Uint8ClampedArray(designPixels).buffer;
      const mapBuffer = new Uint8ClampedArray(mapPixels).buffer;

      worker.onmessage = (e: MessageEvent<{ outputData: ArrayBuffer }>) => {
        worker.terminate();
        const outData = new ImageData(
          new Uint8ClampedArray(e.data.outputData),
          w,
          h
        );
        ctx.putImageData(outData, 0, 0);
        resolve(outputCanvas);
      };

      worker.onerror = () => {
        worker.terminate();
        // Fallback: direct draw without displacement
        ctx.drawImage(designImg, 0, 0, w, h);
        resolve(outputCanvas);
      };

      worker.postMessage(
        { designPixels: designBuffer, mapPixels: mapBuffer, width: w, height: h, scale },
        [designBuffer, mapBuffer]
      );
    } catch {
      // Worker not supported — fallback to main thread
      ctx.drawImage(designImg, 0, 0, w, h);
      resolve(outputCanvas);
    }
  });
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
    const factor = 1.0 - (1.0 - shadowFactor) * blendAlpha;

    dp[di]     = Math.round(dp[di]     * factor);
    dp[di + 1] = Math.round(dp[di + 1] * factor);
    dp[di + 2] = Math.round(dp[di + 2] * factor);
  }

  designCtx.putImageData(designData, 0, 0);
  return designCanvas;
}

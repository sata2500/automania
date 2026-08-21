/**
 * Displacement Worker
 * ====================
 * CPU-intensive pixel operations run off the main thread via Web Worker.
 * Receives: { designPixels, mapPixels, width, height, scale }
 * Posts back: { outputData } (transferable ArrayBuffer)
 */



/** Fast approximate Gaussian blur using repeated box blurs */
function gaussianBlur(src, w, h, radius) {
  let current = src;
  const r = Math.max(1, Math.round(radius));

  for (let pass = 0; pass < 2; pass++) {
    const next = new Float32Array(w * h);
    const temp = new Float32Array(w * h);

    // Horizontal pass
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

self.onmessage = function (e) {
  const { designPixels, mapPixels, width: w, height: h, scale } = e.data;

  const outData = new Uint8ClampedArray(w * h * 4);

  if (scale <= 0) {
    // No displacement — copy design pixels directly
    outData.set(designPixels);
    self.postMessage({ outputData: outData.buffer }, [outData.buffer]);
    return;
  }

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

  // Maximum displacement in pixels
  const maxShiftPixels = Math.min(8, Math.max(1, (scale / 40) * 5));

  const sData = designPixels;

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

      // Bilinear Interpolation Sampling
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
        outData[outIdx]     = Math.round(sData[i00]     * w00 + sData[i10]     * w10 + sData[i01]     * w01 + sData[i11]     * w11);
        outData[outIdx + 1] = Math.round(sData[i00 + 1] * w00 + sData[i10 + 1] * w10 + sData[i01 + 1] * w01 + sData[i11 + 1] * w11);
        outData[outIdx + 2] = Math.round(sData[i00 + 2] * w00 + sData[i10 + 2] * w10 + sData[i01 + 2] * w01 + sData[i11 + 2] * w11);
        outData[outIdx + 3] = Math.round(sData[i00 + 3] * w00 + sData[i10 + 3] * w10 + sData[i01 + 3] * w01 + sData[i11 + 3] * w11);
      } else {
        // Out of bounds — transparent
        outData[idx * 4 + 3] = 0;
      }
    }
  }

  // Transfer the ArrayBuffer back to the main thread (zero-copy)
  self.postMessage({ outputData: outData.buffer }, [outData.buffer]);
};

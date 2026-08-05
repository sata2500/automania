/**
 * Image Optimizer Service
 * Compress and optimize uploaded mockups and design PNGs on client-side canvas
 * without visual quality loss, and persist them via server upload API.
 */

export interface OptimizedImageResult {
  dataUrl: string;
  url: string;
  width: number;
  height: number;
  originalSize: number;
  optimizedSize: number;
}

/**
 * Uploads a file or Base64 data URL to server binary storage endpoint (/api/upload).
 * Returns the public URL (e.g. /api/uploads/filename.webp).
 */
export async function uploadMediaToServer(
  dataUrlOrFile: string | File,
  mimeType?: string
): Promise<string> {
  if (
    typeof dataUrlOrFile === 'string' &&
    (dataUrlOrFile.startsWith('/api/uploads/') || dataUrlOrFile.startsWith('http'))
  ) {
    return dataUrlOrFile;
  }

  try {
    let res: Response;
    if (dataUrlOrFile instanceof File) {
      const formData = new FormData();
      formData.append('file', dataUrlOrFile);
      res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
    } else {
      res = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataUrl: dataUrlOrFile, mimeType }),
      });
    }

    if (res.ok) {
      const data = await res.json();
      if (data.success && data.url) {
        return data.url;
      }
    }
  } catch (err) {
    console.warn('Failed to upload image binary to server API, fallback to local URL:', err);
  }

  return typeof dataUrlOrFile === 'string'
    ? dataUrlOrFile
    : URL.createObjectURL(dataUrlOrFile);
}

/**
 * Optimizes mockup garment/background photos.
 * Converts heavy JPEGs/PNGs into compressed WebP/JPEG (max 2000px dimension).
 */
export async function optimizeMockupImage(
  fileOrDataUrl: File | string,
  maxDimension = 2000,
  quality = 0.90
): Promise<OptimizedImageResult> {
  const { img, originalSize } = await loadImageSource(fileOrDataUrl);

  let width = img.naturalWidth || img.width;
  let height = img.naturalHeight || img.height;

  // Downscale if larger than maxDimension while preserving aspect ratio
  if (width > maxDimension || height > maxDimension) {
    if (width > height) {
      height = Math.round((height * maxDimension) / width);
      width = maxDimension;
    } else {
      width = Math.round((width * maxDimension) / height);
      height = maxDimension;
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Canvas context could not be created.');
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, width, height);

  let mime = 'image/webp';
  let optimizedDataUrl = canvas.toDataURL(mime, quality);
  if (!optimizedDataUrl.startsWith('data:image/webp')) {
    mime = 'image/jpeg';
    optimizedDataUrl = canvas.toDataURL(mime, quality);
  }

  const optimizedSize = Math.round((optimizedDataUrl.length * 3) / 4);

  // Upload optimized binary image to server API
  const serverUrl = await uploadMediaToServer(optimizedDataUrl, mime);

  return {
    dataUrl: optimizedDataUrl,
    url: serverUrl,
    width,
    height,
    originalSize,
    optimizedSize,
  };
}

/**
 * Optimizes PNG designs while 100% preserving alpha channel transparency.
 */
export async function optimizeDesignImage(
  fileOrDataUrl: File | string,
  maxDimension = 2000
): Promise<OptimizedImageResult> {
  const { img, originalSize } = await loadImageSource(fileOrDataUrl);

  let width = img.naturalWidth || img.width;
  let height = img.naturalHeight || img.height;

  // Downscale if larger than maxDimension while preserving aspect ratio
  if (width > maxDimension || height > maxDimension) {
    if (width > height) {
      height = Math.round((height * maxDimension) / width);
      width = maxDimension;
    } else {
      width = Math.round((width * maxDimension) / height);
      height = maxDimension;
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Canvas context could not be created.');
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, width, height);

  // Use PNG format to guarantee full transparency preservation
  const optimizedDataUrl = canvas.toDataURL('image/png');
  const optimizedSize = Math.round((optimizedDataUrl.length * 3) / 4);

  // Upload optimized binary PNG design to server API
  const serverUrl = await uploadMediaToServer(optimizedDataUrl, 'image/png');

  return {
    dataUrl: optimizedDataUrl,
    url: serverUrl,
    width,
    height,
    originalSize,
    optimizedSize,
  };
}

/**
 * Internal helper to load Image from File or string Data URL.
 */
function loadImageSource(
  source: File | string
): Promise<{ img: HTMLImageElement; originalSize: number }> {
  return new Promise((resolve, reject) => {
    let originalSize = 0;

    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => resolve({ img, originalSize });
    img.onerror = (err) => reject(err);

    if (typeof source === 'string') {
      originalSize = Math.round((source.length * 3) / 4);
      img.src = source;
    } else {
      originalSize = source.size;
      const reader = new FileReader();
      reader.onload = (e) => {
        img.src = e.target?.result as string;
      };
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(source);
    }
  });
}

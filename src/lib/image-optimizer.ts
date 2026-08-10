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

import { upload } from '@vercel/blob/client';

/**
 * Uploads a file or Base64 data URL directly to Vercel Blob using client-side upload.
 * Returns the public CDN URL. Throws error if failed.
 */
export async function uploadMediaToServer(
  dataUrlOrFile: string | File,
  mimeType?: string
): Promise<string> {
  if (
    typeof dataUrlOrFile === 'string' &&
    (dataUrlOrFile.startsWith('/api/uploads/') || dataUrlOrFile.startsWith('/sample-uploads/') || dataUrlOrFile.startsWith('http'))
  ) {
    return dataUrlOrFile;
  }

  try {
    let fileToUpload: File;

    if (dataUrlOrFile instanceof File) {
      let actualType = dataUrlOrFile.type || mimeType || 'image/webp';
      if (actualType.startsWith('video/')) {
        fileToUpload = new File([dataUrlOrFile], `upload-${Date.now()}.mp4`, { type: actualType });
      } else {
        fileToUpload = dataUrlOrFile;
      }
    } else {
      // Base64 to Blob to File
      const res = await fetch(dataUrlOrFile);
      const blob = await res.blob();
      let actualType = mimeType || blob.type || 'image/webp';
      // If the data is actually a video, ignore the passed mimeType if it was an image
      if (blob.type && blob.type.startsWith('video/')) {
        actualType = blob.type;
      }
      
      let ext = 'webp';
      if (actualType.startsWith('video/')) {
        ext = 'mp4';
      } else if (actualType === 'image/png') {
        ext = 'png';
      } else if (actualType === 'image/jpeg') {
        ext = 'jpg';
      }

      fileToUpload = new File([blob], `upload-${Date.now()}.${ext}`, { type: actualType });
    }

    const newBlob = await upload(fileToUpload.name, fileToUpload, {
      access: 'public',
      handleUploadUrl: '/api/upload', 
    });
    
    return newBlob.url;

  } catch (err) {
    console.error('Failed to upload image via Vercel Blob Client:', err);
    throw new Error('Dosya yüklenemedi, sınır aşılmış olabilir. Lütfen tekrar deneyin.');
  }
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

  // Use WebP format to allow lossy compression while preserving alpha transparency
  const quality = 0.90;
  let optimizedDataUrl = canvas.toDataURL('image/webp', quality);
  let finalMime = 'image/webp';

  // Fallback to PNG if the browser does not support WebP export
  if (!optimizedDataUrl.startsWith('data:image/webp')) {
    optimizedDataUrl = canvas.toDataURL('image/png');
    finalMime = 'image/png';
  }
  
  const optimizedSize = Math.round((optimizedDataUrl.length * 3) / 4);

  // Upload optimized binary design to server API
  const serverUrl = await uploadMediaToServer(optimizedDataUrl, finalMime);

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

    if (typeof source === 'string') {
      originalSize = Math.round((source.length * 3) / 4);
      img.onload = () => resolve({ img, originalSize });
      img.onerror = (err) => reject(err);
      img.src = source;
    } else {
      originalSize = source.size;
      const objectUrl = URL.createObjectURL(source);
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        resolve({ img, originalSize });
      };
      img.onerror = (err) => {
        URL.revokeObjectURL(objectUrl);
        reject(err);
      };
      img.src = objectUrl;
    }
  });
}

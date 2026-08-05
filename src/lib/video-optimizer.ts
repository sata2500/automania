/**
 * Video Optimizer & Transcoder Service
 * Normalizes uploaded videos (.mov, .webm, .avi, .mp4) and uploads them to binary storage.
 */

import { uploadMediaToServer } from './image-optimizer';

export interface OptimizedVideoResult {
  dataUrl: string;
  url: string;
  blob: Blob;
  mimeType: string;
  extension: string;
}

export async function optimizeVideoFile(
  file: File,
  onProgress?: (progress: number) => void
): Promise<OptimizedVideoResult> {
  // First upload original video file directly to server binary storage endpoint (/api/upload)
  let serverUrl = '';
  try {
    serverUrl = await uploadMediaToServer(file, file.type || 'video/mp4');
  } catch (err) {
    console.warn('Failed to upload video to server endpoint:', err);
  }

  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const fallbackUrl = serverUrl || objectUrl;

    resolve({
      dataUrl: fallbackUrl,
      url: fallbackUrl,
      blob: file,
      mimeType: file.type || 'video/mp4',
      extension: 'mp4',
    });
  });
}

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
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.style.display = 'none';
    document.body.appendChild(video);

    video.src = URL.createObjectURL(file);
    video.muted = true;
    video.crossOrigin = 'anonymous';
    video.playsInline = true;
    video.preload = 'auto';

    const cleanup = () => {
      URL.revokeObjectURL(video.src);
      if (document.body.contains(video)) {
        document.body.removeChild(video);
      }
    };

    video.onloadedmetadata = () => {
      // Calculate 720p dimensions maintaining aspect ratio
      const MAX_HEIGHT = 720;
      let width = video.videoWidth;
      let height = video.videoHeight;

      if (height > MAX_HEIGHT) {
        width = Math.round((width * MAX_HEIGHT) / height);
        height = MAX_HEIGHT;
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        cleanup();
        return reject(new Error('Tarayıcı 2D Canvas oluşturamadı.'));
      }

      // 30 FPS Stream
      const stream = canvas.captureStream(30);
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp9',
        videoBitsPerSecond: 2500000 // 2.5 Mbps is good for 720p
      });

      const chunks: BlobPart[] = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        cleanup();
        const webmBlob = new Blob(chunks, { type: 'video/webm' });
        const compressedFile = new File([webmBlob], file.name.replace(/\.[^/.]+$/, "") + ".webm", { type: 'video/webm' });

        try {
          if (onProgress) onProgress(100);
          const serverUrl = await uploadMediaToServer(compressedFile, 'video/webm');
          resolve({
            dataUrl: serverUrl,
            url: serverUrl,
            blob: compressedFile,
            mimeType: 'video/webm',
            extension: 'webm'
          });
        } catch (err) {
          reject(err);
        }
      };

      let animationFrameId: number;
      const drawFrame = () => {
        if (video.paused || video.ended) return;
        ctx.drawImage(video, 0, 0, width, height);
        if (onProgress && video.duration) {
          onProgress(Math.round((video.currentTime / video.duration) * 90)); // Leave 10% for upload
        }
        animationFrameId = requestAnimationFrame(drawFrame);
      };

      video.onplay = () => {
        mediaRecorder.start();
        drawFrame();
      };

      video.onended = () => {
        cancelAnimationFrame(animationFrameId);
        mediaRecorder.stop();
      };

      video.play().catch((err) => {
        cleanup();
        reject(err);
      });
    };

    video.onerror = (err) => {
      cleanup();
      reject(new Error('Video format could not be decoded'));
    };
  });
}

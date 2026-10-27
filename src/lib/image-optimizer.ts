/**
 * Image Optimizer Service
 * Compress and optimize uploaded mockups and design PNGs on client-side canvas
 * without visual quality loss, and persist them via server upload API (Cloudflare R2).
 */

export interface OptimizedImageResult {
  dataUrl: string;
  url: string;
  width: number;
  height: number;
  originalSize: number;
  optimizedSize: number;
  mimeType: string;
}

export function blobToDataUrl(blob: Blob | File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(blob);
  });
}

/**
 * Uploads a file or Base64 data URL directly to the server (Cloudflare R2 / Storage API).
 * Uses direct FormData server upload first, with Base64 JSON fallbacks.
 * Returns the public or local URL.
 */
export interface UploadMediaOptions {
  requireDurable?: boolean;
  /** Sunucuda sıkıştırma: 'design' kayıpsız sıkıştırılmış PNG (baskı dosyası), 'photo' yüksek kaliteli WebP. */
  optimize?: 'design' | 'photo';
}

/** Vercel'in tek istek sınırının (~4,5 MB) altında kalan parça boyutu; daha büyük dosyalar parçalı yüklenir. */
const CHUNK_BYTES = 3.5 * 1024 * 1024;

/** Büyük dosyayı parçalar halinde yükler (bkz. /api/upload/chunk ve /complete). */
type UploadInfo = { url: string; durable: boolean; size?: number; mimeType?: string; width?: number; height?: number };

async function uploadInChunks(file: File, options: UploadMediaOptions): Promise<UploadInfo | null> {
  const uploadId = crypto.randomUUID();
  const total = Math.ceil(file.size / CHUNK_BYTES);
  for (let index = 0; index < total; index++) {
    const part = file.slice(index * CHUNK_BYTES, (index + 1) * CHUNK_BYTES);
    let res: Response | null = null;
    // Mobil bağlantı kopmalarına karşı her parça bir kez yeniden denenir.
    for (let attempt = 0; attempt < 2 && !res?.ok; attempt++) {
      res = await fetch(`/api/upload/chunk?uploadId=${uploadId}&index=${index}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: part,
      }).catch(() => null);
    }
    if (!res?.ok) return null;
  }
  const res = await fetch('/api/upload/complete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ uploadId, total, filename: file.name, mimeType: file.type, optimize: options.optimize }),
  });
  if (!res.ok) return null;
  return readUploadInfo(await res.json());
}

function readUploadInfo(json: Record<string, unknown>): UploadInfo | null {
  if (typeof json.url !== 'string') return null;
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
  return {
    url: json.url,
    durable: json.durable === true,
    size: num(json.size),
    mimeType: typeof json.mimeType === 'string' ? json.mimeType : undefined,
    width: num(json.width),
    height: num(json.height),
  };
}

/**
 * Dosyayı olduğu gibi (tarayıcıda yeniden kodlamadan) kalıcı depoya yükler, sıkıştırmayı sunucuya bırakır.
 * Sunucu kullanılamıyorsa (misafir, depolama yok) null döner.
 */
async function uploadOriginalForServerOptimization(file: File, optimize: 'design' | 'photo'): Promise<UploadInfo | null> {
  try {
    if (file.size > CHUNK_BYTES) return await uploadInChunks(file, { optimize });
    const formData = new FormData();
    formData.append('file', file);
    formData.append('optimize', optimize);
    const res = await fetch('/api/upload', { method: 'POST', body: formData });
    if (!res.ok) return null;
    const info = readUploadInfo(await res.json());
    return info?.durable ? info : null;
  } catch {
    return null;
  }
}

export async function uploadMediaToServer(
  dataUrlOrFile: string | File,
  mimeType?: string,
  options: UploadMediaOptions = {},
): Promise<string> {
  if (
    typeof dataUrlOrFile === 'string' &&
    (dataUrlOrFile.startsWith('/api/uploads/') ||
      dataUrlOrFile.startsWith('/sample-uploads/') ||
      dataUrlOrFile.startsWith('http://') ||
      dataUrlOrFile.startsWith('https://'))
  ) {
    return dataUrlOrFile;
  }

  let fileToUpload: File | null = null;
  let rawDataUrl: string | null = null;

  try {
    if (dataUrlOrFile instanceof File) {
      const actualType = dataUrlOrFile.type || mimeType || 'image/webp';
      if (actualType.startsWith('video/')) {
        fileToUpload = new File([dataUrlOrFile], `upload-${Date.now()}.mp4`, { type: actualType });
      } else {
        fileToUpload = dataUrlOrFile;
      }
      try {
        rawDataUrl = await blobToDataUrl(fileToUpload);
      } catch (readErr) {
        console.warn('[uploadMediaToServer] Failed to read file as data URL:', readErr);
      }
    } else {
      rawDataUrl = dataUrlOrFile;
      // Base64 or blob URL to File
      const res = await fetch(dataUrlOrFile);
      const blob = await res.blob();
      // data:/blob: URL'nin kendi türü belirleyicidir; çağıranın verdiği değer yalnızca yedektir
      // (yanlış değer — ör. dosya adı — yüklemenin 415/400 ile reddedilmesine yol açar).
      const hintedType = mimeType && /^[a-z]+\/[\w.+-]+$/i.test(mimeType) ? mimeType : undefined;
      const actualType = blob.type || hintedType || 'image/webp';

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

    // Method 0: Büyük dosyalar parçalı yüklenir (tek istek sınırı ~4,5 MB).
    if (fileToUpload.size > CHUNK_BYTES) {
      try {
        const chunked = await uploadInChunks(fileToUpload, options);
        if (chunked && (!options.requireDurable || chunked.durable)) return chunked.url;
      } catch (chunkErr) {
        console.warn('[uploadMediaToServer] Chunked upload failed, trying direct upload:', chunkErr);
      }
    }

    // Method 1: Direct FormData Upload to /api/upload (Cloudflare R2 / Server Storage)
    try {
      const formData = new FormData();
      formData.append('file', fileToUpload);
      if (options.optimize) formData.append('optimize', options.optimize);
      const uploadRes = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (uploadRes.ok) {
        const json = await uploadRes.json();
        if (json.url && (!options.requireDurable || json.durable === true)) return json.url;
      }
    } catch (formErr) {
      console.warn('[uploadMediaToServer] FormData direct upload failed, trying fallback:', formErr);
    }

    // Method 2: Base64 JSON upload fallback
    if (rawDataUrl && rawDataUrl.startsWith('data:')) {
      try {
        const jsonRes = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            dataUrl: rawDataUrl,
            filename: fileToUpload.name,
            mimeType: fileToUpload.type,
            optimize: options.optimize,
          }),
        });
        if (jsonRes.ok) {
          const json = await jsonRes.json();
          if (json.url && (!options.requireDurable || json.durable === true)) return json.url;
        }
      } catch (jsonErr) {
        console.warn('[uploadMediaToServer] Base64 fallback upload failed:', jsonErr);
      }
    }

    if (options.requireDurable) {
      throw new Error('Kalıcı medya depolaması kullanılamıyor. R2 bağlantısını kontrol edip tekrar deneyin.');
    }

    // Method 3: Safety Net (Offline/Local preview fallback so user never loses their data)
    if (rawDataUrl) {
      return rawDataUrl;
    }
    if (typeof dataUrlOrFile === 'string') {
      return dataUrlOrFile;
    }
    return URL.createObjectURL(fileToUpload);
  } catch (err: unknown) {
    console.error('[uploadMediaToServer] Critical upload error:', err instanceof Error ? err.message : 'unknown error');
    if (options.requireDurable) {
      throw err instanceof Error ? err : new Error('Kalıcı medya depolaması kullanılamıyor.');
    }
    if (rawDataUrl) {
      return rawDataUrl;
    }
    if (typeof dataUrlOrFile === 'string') {
      return dataUrlOrFile;
    }
    throw new Error(err instanceof Error ? err.message : 'Dosya kaydedilemedi.');
  }
}

/**
 * Optimizes mockup garment/background photos.
 * Converts heavy JPEGs/PNGs into compressed WebP/JPEG (max 2000px dimension).
 */
export async function optimizeMockupImage(
  fileOrDataUrl: File | string,
  maxDimension = 2000,
  quality = 0.9
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

  // Upload optimized binary image to server API (or fallback to local dataUrl if guest/offline)
  const serverUrl = await uploadMediaToServer(optimizedDataUrl, mime);

  return {
    dataUrl: optimizedDataUrl,
    url: serverUrl,
    width,
    height,
    originalSize,
    optimizedSize,
    mimeType: mime,
  };
}

/**
 * Tasarım (baskı dosyası) yükleme. Giriş yapılmışsa dosya tarayıcıda yeniden kodlanmadan sunucuya gider,
 * sunucu kayıpsız ve en yüksek sıkıştırmalı PNG olarak saklar (çözünürlük korunur, en uzun kenar en fazla 4500 px).
 * Sunucu kullanılamıyorsa (misafir) tarayıcıda PNG'ye çevrilip yerelde saklanır.
 */
export async function optimizeDesignImage(
  fileOrDataUrl: File | string,
  maxDimension = 4096
): Promise<OptimizedImageResult> {
  if (fileOrDataUrl instanceof File && /^image\/(png|jpeg|webp)$/.test(fileOrDataUrl.type)) {
    const info = await uploadOriginalForServerOptimization(fileOrDataUrl, 'design');
    if (info) {
      let { width, height } = info;
      if (!width || !height) {
        const { img } = await loadImageSource(fileOrDataUrl);
        width = img.naturalWidth;
        height = img.naturalHeight;
      }
      return {
        dataUrl: '',
        url: info.url,
        width,
        height,
        originalSize: fileOrDataUrl.size,
        optimizedSize: info.size ?? fileOrDataUrl.size,
        mimeType: info.mimeType ?? fileOrDataUrl.type,
      };
    }
  }

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

  // Yerel (misafir) yedek: kayıpsız PNG, saydamlık korunur.
  const optimizedDataUrl = canvas.toDataURL('image/png');
  const finalMime = 'image/png';

  const optimizedSize = Math.round((optimizedDataUrl.length * 3) / 4);
  const serverUrl = await uploadMediaToServer(optimizedDataUrl, finalMime, { optimize: 'design' });

  return {
    dataUrl: optimizedDataUrl,
    url: serverUrl,
    width,
    height,
    originalSize,
    optimizedSize,
    mimeType: finalMime,
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

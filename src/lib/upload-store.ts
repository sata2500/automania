/**
 * Yüklenen dosyanın doğrulanıp depolanması (R2, yoksa yerel klasör). Tek parça (/api/upload) ve parçalı
 * (/api/upload/complete) yükleme aynı kodu kullanır.
 */
import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { isR2Configured, uploadToR2 } from '@/lib/r2';
import { optimizeImageForStorage, type OptimizeKind } from '@/lib/media-optimizer';
import {
  createOwnedUploadName,
  detectMimeFromMagicBytes,
  isAllowedUploadMime,
  validateUploadSize,
} from '@/lib/upload-security';

const DATA_DIR = path.join(process.cwd(), '.data');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');

async function saveFileLocally(filename: string, buffer: Buffer): Promise<string> {
  await fs.mkdir(UPLOADS_DIR, { recursive: true });
  const filePath = path.join(UPLOADS_DIR, path.basename(filename));
  await fs.writeFile(filePath, buffer, { mode: 0o600 });
  return `/api/uploads/${encodeURIComponent(path.basename(filename))}`;
}

/**
 * Doğrulanmış dosyayı depolar. `optimize` verildiyse görsel önce sunucuda sıkıştırılır
 * (tasarım: neredeyse kayıpsız WebP, fotoğraf: yüksek kaliteli WebP; bkz. media-optimizer).
 */
export async function persistUpload(userId: string, originalName: string, mimeType: string, buffer: Buffer, optimize?: OptimizeKind, sizeLimit?: number) {
  if (!isAllowedUploadMime(mimeType)) {
    return NextResponse.json({ error: 'Desteklenmeyen dosya türü.' }, { status: 415 });
  }

  const sizeError = sizeLimit
    ? (buffer.byteLength > 0 && buffer.byteLength <= sizeLimit ? null : 'Dosya boyutu izin verilen sınırı aşıyor.')
    : validateUploadSize(buffer.byteLength, mimeType);
  if (sizeError) return NextResponse.json({ error: sizeError }, { status: 413 });

  const detectedMime = detectMimeFromMagicBytes(buffer);
  if (detectedMime !== mimeType && !(mimeType === 'video/webm' && detectedMime === null)) {
    return NextResponse.json({ error: 'Dosya içeriği ile MIME türü eşleşmiyor.' }, { status: 415 });
  }

  let width: number | undefined;
  let height: number | undefined;
  if (optimize && mimeType.startsWith('image/')) {
    try {
      const result = await optimizeImageForStorage(buffer, mimeType, optimize);
      buffer = result.buffer;
      mimeType = result.mimeType;
      width = result.width;
      height = result.height;
    } catch (error) {
      // Sıkıştırılamayan (ör. bozuk meta verili) görsel olduğu gibi saklanır.
      console.warn('[Upload Route] Image optimization skipped:', error instanceof Error ? error.message : 'unknown error');
    }
  }

  const filename = createOwnedUploadName(userId, originalName, mimeType);

  if (isR2Configured()) {
    try {
      const result = await uploadToR2(buffer, filename, mimeType);
      return NextResponse.json({ success: true, url: result.url, storageProvider: 'r2', durable: true, mimeType, size: buffer.byteLength, width, height });
    } catch (error) {
      console.error('[Upload Route] R2 upload failed; using local fallback.', error instanceof Error ? error.message : 'unknown error');
    }
  }

  const localUrl = await saveFileLocally(filename, buffer);
  return NextResponse.json({ success: true, url: localUrl, storageProvider: 'local', durable: false, mimeType, size: buffer.byteLength, width, height });
}

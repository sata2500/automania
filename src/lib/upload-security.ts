import { createHash, randomUUID } from 'node:crypto';
import path from 'node:path';

export const MAX_IMAGE_UPLOAD_BYTES = 10 * 1024 * 1024;
export const MAX_VIDEO_UPLOAD_BYTES = 50 * 1024 * 1024;

export const ALLOWED_UPLOADS = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'video/mp4': '.mp4',
  'video/webm': '.webm',
} as const;

export type AllowedUploadMime = keyof typeof ALLOWED_UPLOADS;

export function getUserStoragePrefix(userId: string): string {
  const digest = createHash('sha256').update(userId).digest('hex').slice(0, 16);
  return `user-${digest}-`;
}

export function getUploadLimit(mimeType: string): number {
  return mimeType.startsWith('video/') ? MAX_VIDEO_UPLOAD_BYTES : MAX_IMAGE_UPLOAD_BYTES;
}

export function getAllowedExtension(mimeType: string): string | null {
  return Object.prototype.hasOwnProperty.call(ALLOWED_UPLOADS, mimeType)
    ? ALLOWED_UPLOADS[mimeType as AllowedUploadMime]
    : null;
}

export function createOwnedUploadName(userId: string, originalName: string, mimeType: string): string {
  const extension = getAllowedExtension(mimeType);
  if (!extension) throw new Error('Unsupported upload type.');
  const baseName = path.basename(originalName || 'upload').replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 80);
  return `${getUserStoragePrefix(userId)}${randomUUID()}-${baseName.replace(/\.[^.]+$/, '')}${extension}`;
}

export function isOwnedUploadName(userId: string, filename: string): boolean {
  return path.basename(filename) === filename && filename.startsWith(getUserStoragePrefix(userId));
}

export function isAllowedUploadMime(mimeType: string): mimeType is AllowedUploadMime {
  return Object.prototype.hasOwnProperty.call(ALLOWED_UPLOADS, mimeType);
}

export function validateUploadSize(size: number, mimeType: string): string | null {
  if (!Number.isFinite(size) || size <= 0) return 'Dosya boş olamaz.';
  if (size > getUploadLimit(mimeType)) return 'Dosya boyutu izin verilen sınırı aşıyor.';
  return null;
}

export function detectMimeFromMagicBytes(buffer: Uint8Array): string | null {
  if (buffer.length >= 8 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return 'image/png';
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (buffer.length >= 12 && String.fromCharCode(...buffer.slice(0, 4)) === 'RIFF' && String.fromCharCode(...buffer.slice(8, 12)) === 'WEBP') return 'image/webp';
  if (buffer.length >= 6 && (String.fromCharCode(...buffer.slice(0, 6)) === 'GIF87a' || String.fromCharCode(...buffer.slice(0, 6)) === 'GIF89a')) return 'image/gif';
  if (buffer.length >= 12 && String.fromCharCode(...buffer.slice(4, 8)) === 'ftyp') return 'video/mp4';
  if (buffer.length >= 4 && String.fromCharCode(...buffer.slice(0, 4)) === '\x1A\x45\xDF\xA3') return 'video/webm';
  return null;
}

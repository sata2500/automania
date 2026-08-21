import { describe, expect, it } from 'vitest';
import {
  createOwnedUploadName,
  detectMimeFromMagicBytes,
  getUserStoragePrefix,
  isOwnedUploadName,
  isAllowedUploadMime,
  validateUploadSize,
} from './upload-security';

describe('upload security', () => {
  it('creates names that are scoped to the user prefix', () => {
    const name = createOwnedUploadName('user-1', '../../design.png', 'image/png');
    expect(name.startsWith(getUserStoragePrefix('user-1'))).toBe(true);
    expect(name).not.toContain('..');
    expect(isOwnedUploadName('user-1', name)).toBe(true);
    expect(isOwnedUploadName('user-2', name)).toBe(false);
  });

  it('accepts only the upload allowlist and enforces size limits', () => {
    expect(isAllowedUploadMime('image/png')).toBe(true);
    expect(isAllowedUploadMime('image/svg+xml')).toBe(false);
    expect(validateUploadSize(1024, 'image/png')).toBeNull();
    expect(validateUploadSize(10 * 1024 * 1024 + 1, 'image/png')).not.toBeNull();
  });

  it('detects common magic bytes', () => {
    expect(detectMimeFromMagicBytes(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe('image/png');
    expect(detectMimeFromMagicBytes(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg');
    expect(detectMimeFromMagicBytes(Uint8Array.from([...Buffer.from('RIFFxxxxWEBP')]))).toBe('image/webp');
    expect(detectMimeFromMagicBytes(Uint8Array.from(Buffer.from('not-a-file')))).toBeNull();
  });
});

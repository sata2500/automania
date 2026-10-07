import { afterEach, describe, expect, it, vi } from 'vitest';
import { classifyMediaSource, isAllowedRemoteHost, loadImageForUser, MediaSourceError } from './media-source';
import { getUserStoragePrefix } from './upload-security';

describe('classifyMediaSource', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('maps relative R2 proxy paths to storage keys', () => {
    expect(classifyMediaSource('/api/r2/user-abc-file.png')).toEqual({ kind: 'r2', key: 'user-abc-file.png' });
  });

  it('treats same-origin absolute URLs like relative paths', () => {
    expect(classifyMediaSource('https://app.example/api/uploads/user-abc-x.png', 'https://app.example'))
      .toEqual({ kind: 'local-upload', filename: 'user-abc-x.png' });
  });

  it('maps the configured R2 public domain to storage keys', () => {
    vi.stubEnv('R2_PUBLIC_URL', 'https://media.example.com');
    expect(classifyMediaSource('https://media.example.com/user-abc-file.webp'))
      .toEqual({ kind: 'r2', key: 'user-abc-file.webp' });
  });

  it('rejects internal and non-allowlisted remote URLs', () => {
    expect(() => classifyMediaSource('http://169.254.169.254/latest/meta-data')).toThrow(MediaSourceError);
    expect(() => classifyMediaSource('https://attacker.example/steal.png')).toThrow(MediaSourceError);
    expect(() => classifyMediaSource('https://localhost/x.png')).toThrow(MediaSourceError);
  });

  it('allows the Etsy CDN over HTTPS only', () => {
    expect(classifyMediaSource('https://i.etsystatic.com/1/r/il/abc.jpg').kind).toBe('remote');
    expect(() => classifyMediaSource('http://i.etsystatic.com/1/r/il/abc.jpg')).toThrow(MediaSourceError);
  });

  it('rejects path traversal in demo assets and unknown relative paths', () => {
    expect(() => classifyMediaSource('/demo/../../.env')).toThrow(MediaSourceError);
    expect(() => classifyMediaSource('/api/admin/settings')).toThrow(MediaSourceError);
  });

  it('decodes data URLs', () => {
    expect(classifyMediaSource('data:image/png;base64,AAAA')).toEqual({ kind: 'data', mimeType: 'image/png', base64: 'AAAA' });
  });
});

describe('isAllowedRemoteHost', () => {
  it('supports wildcard subdomains without matching the bare suffix', () => {
    expect(isAllowedRemoteHost('abc.public.blob.vercel-storage.com', ['*.public.blob.vercel-storage.com'])).toBe(true);
    expect(isAllowedRemoteHost('public.blob.vercel-storage.com', ['*.public.blob.vercel-storage.com'])).toBe(false);
    expect(isAllowedRemoteHost('evil-i.etsystatic.com', ['i.etsystatic.com'])).toBe(false);
  });
});

describe('loadImageForUser', () => {
  it('refuses to read another user\'s storage objects', async () => {
    const otherKey = `${getUserStoragePrefix('someone-else')}file.png`;
    await expect(loadImageForUser('me', `/api/r2/${otherKey}`)).rejects.toMatchObject({ status: 403 });
    await expect(loadImageForUser('me', `/api/uploads/${otherKey}`)).rejects.toMatchObject({ status: 403 });
  });

  it('enforces the size limit for data URLs', async () => {
    const big = Buffer.alloc(32).toString('base64');
    await expect(loadImageForUser('me', `data:image/png;base64,${big}`, { maxBytes: 16 })).rejects.toMatchObject({ status: 413 });
  });

  it('reads bundled demo assets', async () => {
    const buffer = await loadImageForUser('me', '/demo/design-sun.svg');
    expect(buffer.byteLength).toBeGreaterThan(0);
  });
});

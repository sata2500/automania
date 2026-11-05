import { describe, expect, it } from 'vitest';
import { parsePreviewWidth, previewKeysFor, previewSrc, sourceKeyOfPreview } from './media-preview';
import { findOrphanKeys } from './orphan-detection';

describe('media previews', () => {
  it('adds the width only to stored images', () => {
    expect(previewSrc('/api/r2/u1_abc.png', 512)).toBe('/api/r2/u1_abc.png?w=512');
    expect(previewSrc('/api/r2/u1_clip.mp4', 512)).toBe('/api/r2/u1_clip.mp4');
    expect(previewSrc('blob:http://x/1', 256)).toBe('blob:http://x/1');
    expect(previewSrc('data:image/png;base64,AA', 256)).toBe('data:image/png;base64,AA');
    expect(previewSrc(undefined, 256)).toBe('');
  });

  it('accepts only known widths and maps preview keys back to their source', () => {
    expect(parsePreviewWidth('512')).toBe(512);
    expect(parsePreviewWidth('9999')).toBeNull();
    expect(previewKeysFor('u1_abc.png')).toEqual(['u1_abc.png.w256.webp', 'u1_abc.png.w512.webp', 'u1_abc.png.w1024.webp', 'u1_abc.png.w2048.webp']);
    expect(previewKeysFor('u1_abc.png.w512.webp')).toEqual([]);
    expect(sourceKeyOfPreview('u1_abc.png.w512.webp')).toBe('u1_abc.png');
  });

  it('keeps a preview while its source file is referenced', () => {
    const old = new Date(0);
    const orphans = findOrphanKeys(
      [{ key: 'u1_a.png.w512.webp', lastModified: old }, { key: 'u1_b.png.w512.webp', lastModified: old }],
      ['/api/r2/u1_a.png'],
      Date.now(),
    );
    expect(orphans).toEqual(['u1_b.png.w512.webp']);
  });
});

import { describe, expect, it } from 'vitest';
import { collectWorkspaceReferences, findOrphanKeys, ORPHAN_GRACE_PERIOD_MS } from './orphan-detection';

const now = Date.UTC(2026, 9, 7);
const old = new Date(now - ORPHAN_GRACE_PERIOD_MS - 1);

describe('orphan detection', () => {
  it('keeps referenced, recent and URL-encoded objects', () => {
    const refs = new Set<string>();
    collectWorkspaceReferences({
      mockups: JSON.stringify([{ src: '/api/r2/user-a-mockup.png' }]),
      designs: [{ src: 'https://media.example.com/user-a-design%20one.png' }],
      etsy_generated_mockups: [{ previewUrl: '/api/r2/user-a-preview.webp' }],
    }, refs);
    refs.add('https://media.example.com/user-a-auto-run.png');

    const orphans = findOrphanKeys([
      { key: 'user-a-mockup.png', lastModified: old },
      { key: 'user-a-design one.png', lastModified: old },
      { key: 'user-a-preview.webp', lastModified: old },
      { key: 'user-a-auto-run.png', lastModified: old },
      { key: 'user-a-fresh-upload.png', lastModified: new Date(now - 1000) },
      { key: 'user-a-unused.png', lastModified: old },
    ], refs, now);

    expect(orphans).toEqual(['user-a-unused.png']);
  });
});

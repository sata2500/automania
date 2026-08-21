import { describe, expect, it } from 'vitest';
import { validateEtsyDraftPreflight } from './etsy-preflight';

describe('etsy draft preflight', () => {
  const validInput = {
    state: 'draft',
    title: 'Test POD listing',
    description: 'A test description',
    tags: ['pod', 'shirt'],
    taxonomyId: 482,
    variations: [{ size: 'M', color: 'Black' }],
    images: [{ url: '/api/uploads/user-prefix-image.jpg', isVideo: false }],
  };

  it('accepts a valid draft payload', () => {
    expect(validateEtsyDraftPreflight(validInput)).toEqual([]);
  });

  it('rejects an active publish request', () => {
    expect(validateEtsyDraftPreflight({ ...validInput, state: 'active' }).join(' ')).toContain('yalnızca draft');
  });

  it('rejects tag, taxonomy, variation, and media violations', () => {
    const errors = validateEtsyDraftPreflight({
      ...validInput,
      tags: Array.from({ length: 14 }, () => 'this-tag-is-too-long'),
      taxonomyId: 'not-a-number',
      variations: Array.from({ length: 4901 }, () => ({})),
      images: [
        ...Array.from({ length: 21 }, (_, index) => ({ url: `image-${index}.jpg` })),
        { url: 'video-1.mp4', isVideo: true },
        { url: 'video-2.mp4', isVideo: true },
        { url: 'video-3.mp4', isVideo: true },
      ],
    });

    expect(errors.join(' ')).toContain('etiket');
    expect(errors.join(' ')).toContain('taxonomy');
    expect(errors.join(' ')).toContain('Variation');
    expect(errors.join(' ')).toContain('fotoğraf');
    expect(errors.join(' ')).toContain('video');
  });
});

import { describe, expect, it } from 'vitest';
import { buildPublishChecklist, validateEtsyDraftPreflight } from './etsy-preflight';

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

  it('rejects an active publish request unless explicitly allowed', () => {
    expect(validateEtsyDraftPreflight({ ...validInput, state: 'active' }).join(' ')).toContain('geçersiz');
  });

  it('accepts an active payload only when explicitly allowed and photo-backed', () => {
    expect(validateEtsyDraftPreflight(
      { ...validInput, state: 'active' },
      { allowActive: true, requirePhoto: true },
    )).toEqual([]);
  });

  it('rejects an active payload without a photo', () => {
    const errors = validateEtsyDraftPreflight(
      { ...validInput, state: 'active', images: [] },
      { allowActive: true, requirePhoto: true },
    );
    expect(errors.join(' ')).toContain('en az bir fotoğraf');
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

describe('buildPublishChecklist', () => {
  const ready = {
    title: 'Funny Cat Shirt',
    description: 'A shirt.',
    tags: Array.from({ length: 13 }, (_, i) => `tag ${i}`),
    taxonomyId: 482,
    shippingProfileId: '1',
    readinessStateId: '2',
    media: [{}, { isVideo: true }],
    whoMade: 'i_did',
    whenMade: 'made_to_order',
  };

  it('passes a complete listing', () => {
    expect(buildPublishChecklist(ready).every((item) => item.status === 'ok')).toBe(true);
  });

  it('flags missing shipping, readiness and photos as errors', () => {
    const items = buildPublishChecklist({ ...ready, shippingProfileId: '', readinessStateId: '', media: [{ isVideo: true }] });
    const errors = items.filter((item) => item.status === 'error').map((item) => item.id);
    expect(errors).toEqual(['shipping', 'readiness', 'photos']);
  });

  it('warns but does not block on extra media and few tags', () => {
    const items = buildPublishChecklist({ ...ready, tags: ['cat'], media: Array.from({ length: 22 }, () => ({})) });
    expect(items.find((item) => item.id === 'photos')?.status).toBe('warning');
    expect(items.find((item) => item.id === 'tags')?.status).toBe('warning');
  });
});

import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/prompt-settings', () => ({ loadPrompt: vi.fn() }));
vi.mock('@/lib/ai-text', () => ({ generateReasoningJson: vi.fn() }));

const { parseListingReview } = await import('./listing-ai-review');
const { listingTextHash } = await import('./etsy-seo-evaluator');

describe('parseListingReview', () => {
  const input = { title: 'Retro Cat Shirt', tags: ['retro cat', 'cat mom gift'], description: 'Soft tee.' };

  it('clamps scores, binds the review to the text and keeps only real tags', () => {
    const review = parseListingReview({
      scores: { relevance: 12, title: '7', tags: -3, description: 8.6 },
      notes: { title: ' Kısa ve net. ', tags: '' },
      irrelevantTags: ['Cat Mom Gift', 'invented tag'],
    }, input, 'model-x');
    expect(review.scores).toEqual({ relevance: 10, title: 7, tags: 0, description: 9 });
    expect(review.notes.title).toBe('Kısa ve net.');
    expect(review.notes.tags).toBeUndefined();
    expect(review.irrelevantTags).toEqual(['Cat Mom Gift']);
    expect(review.textHash).toBe(listingTextHash(input.title, input.tags, input.description));
    expect(review.model).toBe('model-x');
  });

  it('returns zero scores for an empty response', () => {
    const review = parseListingReview(null, input);
    expect(review.scores).toEqual({ relevance: 0, title: 0, tags: 0, description: 0 });
    expect(review.irrelevantTags).toEqual([]);
  });
});

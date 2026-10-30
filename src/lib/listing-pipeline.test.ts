import { beforeEach, describe, expect, it, vi } from 'vitest';

const generate = vi.fn();
const review = vi.fn();
const poolRows: Array<Record<string, unknown>> = [];

vi.mock('@/lib/db', () => ({ default: vi.fn(async () => poolRows) }));
vi.mock('@/lib/listing-generator', () => ({ generateListingContent: generate }));
vi.mock('@/lib/listing-ai-review', () => ({ reviewListingWithAi: review }));
vi.mock('@/lib/keyword-pool', () => ({
  normalizeKeywords: (k: string[]) => k.map((x) => x.toLowerCase()),
  scoreKeywords: vi.fn(async () => ({ evaluated: [], competitorTags: [], pending: [], scraped: 0 })),
}));
vi.mock('@/lib/app-settings', () => ({ loadSettingRows: vi.fn(async () => []) }));
vi.mock('@/lib/scraper-credentials', () => ({ loadScraperCredentials: vi.fn(async () => null) }));

const { generateBestListing, revisionFeedbackFrom } = await import('./listing-pipeline');
const { listingTextHash } = await import('./etsy-seo-evaluator');

const tags13 = ['retro cat lover', 'vintage kitten top', 'cat mom gift', 'cottagecore animal', 'whimsical feline art', 'japanese neko style', 'cat lady present', 'pet owner apparel', 'kawaii kitty', 'cozy reading nook', 'black kitty art', 'mothers day idea', 'graphic tee'];
const description = 'This retro cat lover shirt features a vintage kitten illustration made for cat moms who love cozy feline art. Soft cotton fabric, relaxed fit. Sizing: see the size chart photo. Care: machine wash cold inside out.';
const listing = (title: string, tags: string[]) => ({ listing: { title, description, selectedTags: tags }, modelUsed: 'm' });
const reviewFor = (title: string, tags: string[], value: number) => ({
  textHash: listingTextHash(title, tags, description),
  scores: { relevance: value, title: value, tags: value, description: value },
  notes: { overall: 'Başlık daha net olmalı.' },
  irrelevantTags: [],
  reviewedAt: new Date().toISOString(),
});

const input = { keywords: ['retro cat'], design: { description: 'cat' }, storeFacts: 'None provided' };

describe('generateBestListing', () => {
  beforeEach(() => {
    generate.mockReset();
    review.mockReset();
    poolRows.length = 0;
    poolRows.push({ keyword: 'retro cat lover', opportunity_score: 90, last_evaluated_at: new Date().toISOString() });
  });

  it('keeps the first draft when it reaches the target score', async () => {
    const title = 'Retro Cat Lover Shirt, Vintage Kitten Tee for Cat Moms';
    generate.mockResolvedValueOnce(listing(title, tags13));
    review.mockImplementationOnce(async (r: { title: string; tags: string[] }) => reviewFor(r.title, r.tags, 10));
    const result = await generateBestListing('u1', input);
    expect(result.attempts).toBe(1);
    expect(generate).toHaveBeenCalledTimes(1);
    expect(result.evaluation.partial).toBe(false);
    expect(result.evaluation.score).toBeGreaterThanOrEqual(85);
  });

  it('revises a weak draft with feedback and keeps the better one', async () => {
    const weakTitle = 'Shirt';
    const weakTags = ['cat shirt', 'cute cat shirt', 'funny cat shirt', 'cat tee'];
    const goodTitle = 'Retro Cat Lover Shirt, Vintage Kitten Tee for Cat Moms';
    generate.mockResolvedValueOnce(listing(weakTitle, weakTags)).mockResolvedValueOnce(listing(goodTitle, tags13));
    review.mockImplementation(async (r: { title: string; tags: string[] }) => reviewFor(r.title, r.tags, r.title === goodTitle ? 9 : 3));
    const result = await generateBestListing('u1', input);
    expect(result.attempts).toBe(2);
    expect(result.listing.title).toBe(goodTitle);
    const secondCall = generate.mock.calls[1]![1] as { revisionFeedback: string[]; currentListing: { title: string } };
    expect(secondCall.currentListing.title).toBe(weakTitle);
    expect(secondCall.revisionFeedback.some((f) => /etiket eksik/.test(f))).toBe(true);
    // Web araması yalnızca ilk taslakta (admin ayarı varsayılan açık).
    expect((generate.mock.calls[0]![1] as { webSearch?: boolean }).webSearch).toBe(true);
    expect((secondCall as { webSearch?: boolean }).webSearch).toBe(false);
  });

  it('still scores the listing when the AI review fails', async () => {
    generate.mockResolvedValue(listing('Retro Cat Lover Shirt, Vintage Kitten Tee', tags13));
    review.mockRejectedValue(new Error('quota'));
    const result = await generateBestListing('u1', input, { revise: false });
    expect(result.aiReview).toBeNull();
    expect(result.evaluation.partial).toBe(true);
  });
});

describe('revisionFeedbackFrom', () => {
  it('orders critical issues first and adds unused high-scoring keywords', async () => {
    const { evaluateEtsyListingSeo } = await import('./etsy-seo-evaluator');
    const evaluation = evaluateEtsyListingSeo({
      title: 'Cat', description: 'x', tags: ['cat'],
      keywordPoolRows: [{ keyword: 'cat lover gift', opportunity_score: 92, last_evaluated_at: new Date().toISOString() }],
    });
    const feedback = revisionFeedbackFrom(evaluation);
    expect(feedback[0]).toMatch(/TAGS|TITLE|DESCRIPTION/);
    expect(feedback.some((f) => f.includes('cat lover gift'))).toBe(true);
  });
});

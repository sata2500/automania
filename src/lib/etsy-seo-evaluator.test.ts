import { describe, it, expect } from 'vitest';
import { evaluateEtsyListingSeo, listingTextHash, repeatedTagWords, wordRoot, type ListingAiReview } from './etsy-seo-evaluator';

const fresh = new Date().toISOString();
const old = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString();

const goodTags = [
  'retro cat lover', 'vintage kitten top', 'cat mom gift', 'cottagecore animal', 'whimsical feline art',
  'japanese neko style', 'cat lady present', 'pet owner apparel', 'kawaii kitty', 'cozy reading nook',
  'black kitty art', 'mothers day idea', 'graphic tee',
];
const goodTitle = 'Retro Cat Lover Shirt, Vintage Kitten Graphic Tee for Cat Moms';
const goodDescription = 'This retro cat lover shirt features a vintage kitten illustration made for cat moms and anyone who loves cozy feline art. '
  + 'Product details: soft 100% cotton fabric with a relaxed fit. Sizing: unisex sizes, see the size chart in the photos. '
  + 'Care: machine wash cold inside out, tumble dry low. Shipping: free shipping in the US.';

describe('evaluateEtsyListingSeo v2', () => {
  it('uses only fresh pool scores and reports a partial score without AI review', () => {
    const result = evaluateEtsyListingSeo({
      title: goodTitle,
      description: goodDescription,
      tags: goodTags,
      keywordPoolRows: [
        { keyword: 'retro cat lover', opportunity_score: 88, last_evaluated_at: fresh },
        { keyword: 'cat mom gift', opportunity_score: 92, last_evaluated_at: fresh },
        { keyword: 'vintage kitten top', opportunity_score: 95, last_evaluated_at: old },
      ],
    });
    expect(result.version).toBe(2);
    expect(result.partial).toBe(true);
    expect(result.breakdown.ai).toBeNull();
    expect(result.confidence).toEqual({ scoredTags: 2, totalTags: 13, aiReviewed: false });
    const oldTag = result.tagBreakdown.find((t) => t.keyword === 'vintage kitten top')!;
    expect(oldTag.status).toBe('unknown');
    expect(oldTag.opportunityScore).toBe(0);
    expect(result.breakdown.rules).toBe(25);
    // Başlık en güçlü ifadeyle başlıyor + ortalama 90 → 23 + 10
    expect(result.breakdown.demand).toBe(33);
    expect(result.score).toBe(Math.round((58 / 60) * 100));
  });

  it('flags repeated words across tags and in the title', () => {
    const tags = ['cute cat shirt', 'funny cat shirt', 'cat lover shirt', 'cat mom tee', 'black cat t-shirt'];
    const result = evaluateEtsyListingSeo({
      title: 'Cat Shirt Cat Tee Cat Gift',
      description: 'short',
      tags,
    });
    expect(result.repeatedWords[0]).toEqual({ word: 'cat', count: 5 });
    expect(result.repeatedWords.find((r) => r.word === 'shirt')?.count).toBe(5);
    expect(result.issues.some((i) => i.field === 'tags' && /tekrarlanıyor/.test(i.message))).toBe(true);
    expect(result.issues.some((i) => i.field === 'title' && /3\+ kez/.test(i.message))).toBe(true);
    expect(result.breakdown.demand).toBeNull();
    expect(result.breakdown.rules).toBeLessThan(10);
  });

  it('applies the AI review only when it belongs to the current text', () => {
    const review: ListingAiReview = {
      textHash: listingTextHash(goodTitle, goodTags, goodDescription),
      scores: { relevance: 9, title: 8, tags: 7, description: 9 },
      notes: { tags: 'Etiketler çoğunlukla iyi.' },
      irrelevantTags: ['graphic tee'],
      reviewedAt: fresh,
    };
    const base = { title: goodTitle, description: goodDescription, tags: goodTags, keywordPoolRows: [{ keyword: 'retro cat lover', opportunity_score: 80, last_evaluated_at: fresh }] };
    const reviewed = evaluateEtsyListingSeo({ ...base, aiReview: review });
    expect(reviewed.partial).toBe(false);
    expect(reviewed.breakdown.ai).toBe(33);
    expect(reviewed.tagBreakdown.find((t) => t.keyword === 'graphic tee')?.irrelevant).toBe(true);

    const stale = evaluateEtsyListingSeo({ ...base, title: `${goodTitle} New`, aiReview: review });
    expect(stale.breakdown.ai).toBeNull();
    expect(stale.aiReview).toBeNull();
  });

  it('treats product word spellings as one root', () => {
    expect(wordRoot('T-Shirt')).toBe('shirt');
    expect(wordRoot('tees')).toBe('shirt');
    expect(wordRoot('puppies')).toBe('puppy');
    expect(repeatedTagWords(['retro tee', 'funny t-shirt', 'cat shirt'])).toEqual([{ word: 'shirt', count: 3 }]);
  });

  it('penalizes missing tags, over-long tags and long titles without failing', () => {
    const result = evaluateEtsyListingSeo({
      title: 'x'.repeat(150),
      description: '',
      tags: ['this tag is way too long for etsy', 'ok tag'],
    });
    expect(result.score).toBeLessThan(40);
    expect(result.issues.some((i) => i.severity === 'critical' && i.field === 'tags')).toBe(true);
    expect(result.issues.some((i) => /140/.test(i.message))).toBe(true);
  });
});

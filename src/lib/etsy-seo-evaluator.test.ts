import { describe, it, expect } from 'vitest';
import { evaluateEtsyListingSeo } from './etsy-seo-evaluator';

describe('evaluateEtsyListingSeo', () => {
  it('calculates accurate mathematical grade and tag breakdown with keyword pool data', () => {
    const tags = [
      'retro cat shirt',
      'vintage kitten tee',
      'cat mom gift',
      'funny animal shirt',
      'cottagecore tee',
      'aesthetic cat top',
      'retro graphic tee',
      'cat lover apparel',
      'cute kitten shirt',
      'japanese cat shirt',
      'cat lady gift tee',
      'whimsical cat top',
      'pet lover tshirt'
    ];

    const keywordPoolRows = [
      {
        keyword: 'retro cat shirt',
        opportunity_score: 88,
        total_listings: 1200,
        competition_level: 'Düşük (<5K İlan)',
        bestseller_count: 3,
        is_etsy_suggested: true,
        last_evaluated_at: new Date().toISOString(),
      },
      {
        keyword: 'vintage kitten tee',
        opportunity_score: 75,
        total_listings: 800,
        competition_level: 'Altın Niş (<1K İlan)',
        bestseller_count: 1,
        is_etsy_suggested: true,
        last_evaluated_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        keyword: 'cat mom gift',
        opportunity_score: 92,
        total_listings: 3400,
        competition_level: 'Düşük (<5K İlan)',
        bestseller_count: 4,
        is_etsy_suggested: true,
        last_evaluated_at: new Date().toISOString(),
      }
    ];

    const result = evaluateEtsyListingSeo({
      title: 'Retro Cat Shirt Vintage Kitten Tee Aesthetic Cat Mom Gift Cute Japanese Graphic Apparel',
      description: 'Super soft retro cat shirt and vintage kitten tee. Made with 100% ring-spun cotton. Check sizing chart and care instructions in the description below.',
      tags,
      keywordPoolRows,
    });

    expect(result.score).toBeGreaterThanOrEqual(75);
    expect(['A+', 'A', 'B']).toContain(result.grade);
    expect(result.tagBreakdown).toHaveLength(13);

    const firstTag = result.tagBreakdown[0];
    expect(firstTag.keyword).toBe('retro cat shirt');
    expect(firstTag.opportunityScore).toBe(88);
    expect(firstTag.bestsellerCount).toBe(3);
    expect(firstTag.isFresh).toBe(true);
    expect(firstTag.inPool).toBe(true);
    expect(firstTag.isValidLength).toBe(true);
  });

  it('penalizes listings with missing tags or short titles without failing', () => {
    const result = evaluateEtsyListingSeo({
      title: 'Cat',
      description: 'Short',
      tags: ['cat'],
      keywordPoolRows: [],
    });

    expect(result.score).toBeLessThan(45);
    expect(['D', 'F']).toContain(result.grade);
    expect(result.tagBreakdown).toHaveLength(1);
    expect(result.issues.length).toBeGreaterThan(0);
  });
});

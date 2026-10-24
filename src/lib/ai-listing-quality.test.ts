import { describe, expect, it } from 'vitest';
import { containsWord, detectPrimarySubject, filterContaminatedTerms } from './listing-subject';
import { isTrademarkViolator, sanitizeTrademarkText, filterSafeKeywords } from './trademark-shield';
import { evaluateEtsyListingSeo, gradeForSeoScore } from './etsy-seo-evaluator';

describe('subject detection', () => {
  it('matches whole words only', () => {
    expect(containsWord('summer vacation tee', 'cat')).toBe(false);
    expect(containsWord('delicate education print', 'cat')).toBe(false);
    expect(containsWord('Funny Cat Lover', 'cat')).toBe(true);
    expect(containsWord('two cats napping', 'cat')).toBe(true);
  });

  it('detects the animal subject with synonyms', () => {
    expect(detectPrimarySubject('cute bunny in a garden')?.subject).toBe('rabbit');
    expect(detectPrimarySubject('vacation vibes beach')).toBeNull();
    expect(detectPrimarySubject('sleepy kitten')?.subject).toBe('cat');
  });
});

describe('filterContaminatedTerms', () => {
  const tags = ['vacation tee', 'cat lover gift', 'christmas gift', 'beach vibes'];

  it('keeps tags that only contain a forbidden word as a substring', () => {
    const result = filterContaminatedTerms(tags, (t) => t, { subjectText: 'beach sunset design' });
    expect(result).toContain('vacation tee');
    expect(result).not.toContain('cat lover gift');
  });

  it('keeps active seasonal themes', () => {
    const result = filterContaminatedTerms(tags, (t) => t, { subjectText: 'beach sunset', allowedTerms: ['christmas'] });
    expect(result).toContain('christmas gift');
  });

  it('keeps terms the design itself is about', () => {
    expect(filterContaminatedTerms(tags, (t) => t, { subjectText: 'funny cat' })).toContain('cat lover gift');
  });
});

describe('trademark shield', () => {
  it('removes multi-word marks before their shorter parts', () => {
    expect(sanitizeTrademarkText('Winnie the Pooh honey shirt').cleanText).toBe('honey shirt');
  });

  it('does not flag common words without brand context', () => {
    expect(isTrademarkViolator('world champion dad').isViolator).toBe(false);
    expect(isTrademarkViolator('peanuts lover tee').isViolator).toBe(false);
    expect(isTrademarkViolator('yeti monster hoodie').isViolator).toBe(false);
    expect(sanitizeTrademarkText('Camper vans life').cleanText).toBe('Camper vans life');
  });

  it('still flags them in a brand context', () => {
    expect(isTrademarkViolator('champion hoodie').isViolator).toBe(true);
    expect(isTrademarkViolator('yeti tumbler').matchedTerm).toBe('yeti');
    expect(sanitizeTrademarkText('Yeti tumbler wrap').cleanText).toBe('stainless tumbler tumbler wrap');
  });

  it('filters keyword lists', () => {
    expect(filterSafeKeywords(['disney castle', 'cozy cabin']).safe).toEqual(['cozy cabin']);
  });
});

describe('single SEO grade scale', () => {
  it('uses the same thresholds everywhere', () => {
    expect(gradeForSeoScore(92)).toBe('A+');
    expect(gradeForSeoScore(72)).toBe('B');
    expect(gradeForSeoScore(10)).toBe('F');
  });

  it('only suggests pool keywords related to the listing', () => {
    const result = evaluateEtsyListingSeo({
      title: 'Funny Cat Mom Shirt',
      description: 'A shirt for cat moms.',
      tags: ['cat mom'],
      keywordPoolRows: [
        { keyword: 'cat lover gift', opportunity_score: 90 },
        { keyword: 'fishing dad', opportunity_score: 95 },
      ],
    });
    const suggested = result.missingPoolKeywords.map((k) => k.keyword);
    expect(suggested).toContain('cat lover gift');
    expect(suggested).not.toContain('fishing dad');
  });
});

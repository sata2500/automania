import { describe, expect, it } from 'vitest';
import type { MockupItem } from '@/types/pod';
import {
  buildAutomationKeywords,
  buildDesignPrompt,
  deriveRunOutcome,
  nextPendingStep,
  selectAutomationMockups,
  topicSearchTerms,
} from './automation-plan';

const mockup = (id: string, extra: Partial<MockupItem> = {}): MockupItem => ({
  id,
  name: id,
  src: `/api/r2/user-1-${id}.png`,
  apparelType: 'light',
  printAreas: [{ id: 'a', x: 10, y: 10, width: 30, height: 30 }],
  width: 1000,
  height: 1000,
  ...extra,
} as MockupItem);

describe('selectAutomationMockups', () => {
  const mockups = [
    mockup('light1'),
    mockup('dark1', { apparelType: 'dark' }),
    mockup('any1', { apparelType: 'any' }),
    mockup('chart', { hasPrintArea: false, printAreas: [] }),
    mockup('vid', { isVideo: true, printAreas: [] }),
  ];

  it('renders every selected print-area mockup that matches the fabric filter', () => {
    const result = selectAutomationMockups(mockups, {
      printAreaMockupIds: ['light1', 'dark1', 'any1', 'missing'],
      staticMockupIds: ['chart'],
      videoMockupIds: ['vid'],
      fabricType: 'light',
    });
    expect(result.render.map((m) => m.id)).toEqual(['light1', 'any1']);
    expect(result.statics.map((m) => m.id)).toEqual(['chart']);
    expect(result.video?.id).toBe('vid');
  });

  it('caps photos at the Etsy limit', () => {
    const many = Array.from({ length: 25 }, (_, i) => mockup(`m${i}`));
    const result = selectAutomationMockups([...many, mockup('chart', { hasPrintArea: false, printAreas: [] })], {
      printAreaMockupIds: many.map((m) => m.id),
      staticMockupIds: ['chart'],
      fabricType: 'all',
    });
    expect(result.render).toHaveLength(20);
    expect(result.statics).toHaveLength(0);
  });
});

describe('design prompt and keywords', () => {
  const hints = { primaryNiche: 'Funny Cat', targetAudience: 'cat moms', productType: 'T-Shirt', customNotes: 'no violence' };

  it('keeps niche and audience when notes are present', () => {
    const prompt = buildDesignPrompt(hints, 3);
    expect(prompt).toContain('Funny Cat');
    expect(prompt).toContain('cat moms');
    expect(prompt).toContain('no violence');
    expect(buildDesignPrompt(hints, 4)).not.toBe(prompt);
  });

  it('builds unique keyword candidates including pool keywords', () => {
    const keywords = buildAutomationKeywords(hints, ['cat lover gift', 'funny cat']);
    expect(keywords[0]).toBe('funny cat');
    expect(keywords).toContain('cat moms gift');
    expect(keywords).toContain('cat lover gift');
    expect(new Set(keywords).size).toBe(keywords.length);
    expect(topicSearchTerms(hints)).toEqual(['funny', 'cat', 'moms']);
  });
});

describe('run progress', () => {
  it('finds the next unfinished step and derives the outcome', () => {
    expect(nextPendingStep({ designGeneration: { status: 'completed' }, backgroundRemoval: { status: 'completed' } })).toBe('mockupRender');
    expect(deriveRunOutcome({ videoGeneration: { status: 'failed', error: 'veo' } }).status).toBe('completed');
    expect(deriveRunOutcome({ listingCreation: { status: 'failed', error: 'Etsy reddetti' } })).toEqual({ status: 'failed', errorMessage: 'Etsy reddetti' });
  });
});

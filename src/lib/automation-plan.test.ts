import { describe, expect, it } from 'vitest';
import type { MockupItem } from '@/types/pod';
import {
  buildAutomationKeywords,
  buildDesignConcept,
  fillVideoPromptTemplate,
  deriveRunOutcome,
  inferAudienceGroup,
  variantFabricFor,
  nextPendingStep,
  selectAutomationMockups,
  topicSearchTerms,
} from './automation-plan';
import { DEFAULT_GENERATE_VIDEO_PROMPT } from './default-prompts';

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

  it('builds the design concept data from niche, audience, product and notes', () => {
    expect(buildDesignConcept(hints)).toBe('Niche: Funny Cat\nTarget audience: cat moms\nProduct: T-Shirt\nNotes: no violence');
    expect(buildDesignConcept({})).toBe('Niche: a trending gift theme\nTarget audience: a broad Etsy audience\nProduct: apparel\nNotes: none');
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

describe('folder-linked templates and video prompt', () => {
  const folderMockups = [
    { id: 'w', name: 'White', src: '/w.png', folderId: 'f1', apparelType: 'light', printAreas: [{ id: 'a', x: 1, y: 1, width: 10, height: 10 }], opacity: 1, width: 10, height: 10 },
    { id: 'b', name: 'Black', src: '/b.png', folderId: 'f1', apparelType: 'dark', printAreas: [{ id: 'a', x: 1, y: 1, width: 10, height: 10 }], opacity: 1, width: 10, height: 10 },
    { id: 'chart', name: 'Chart', src: '/c.png', folderId: 'f1', apparelType: 'any', printAreas: [], hasPrintArea: false, opacity: 1, width: 10, height: 10 },
    { id: 'other', name: 'Other', src: '/o.png', folderId: 'f2', apparelType: 'light', printAreas: [{ id: 'a', x: 1, y: 1, width: 10, height: 10 }], opacity: 1, width: 10, height: 10 },
  ] as MockupItem[];

  it('uses the current folder contents instead of the saved id snapshot', () => {
    const plan = selectAutomationMockups(folderMockups, { folderId: 'f1', printAreaMockupIds: ['stale'], staticMockupIds: [], videoMockupIds: [], fabricType: 'all', multiPrintAreaSupport: false });
    expect(plan.render.map((m) => m.id)).toEqual(['w', 'b']);
    expect(plan.statics.map((m) => m.id)).toEqual(['chart']);
  });

  it('marks dark garments for the light-ink design variant', () => {
    // Eski otomasyonlar (ayar yok) açık kumaş için sayılır: koyu mockup'lara versiyon basılır.
    expect(variantFabricFor({ apparelType: 'dark' }, undefined)).toBe('dark');
    expect(variantFabricFor({ apparelType: 'light' }, undefined)).toBeNull();
    expect(variantFabricFor({ apparelType: 'any' }, 'light')).toBeNull();
    expect(variantFabricFor({ apparelType: 'light' }, 'dark')).toBe('light');
    expect(variantFabricFor({ apparelType: 'dark' }, 'universal')).toBeNull();
  });

  it('guesses the audience from the mockup folder name', () => {
    expect(inferAudienceGroup('Erkek Tişört')).toBe('men');
    expect(inferAudienceGroup("Women's tees")).toBe('women');
    expect(inferAudienceGroup('Bebek body')).toBe('baby');
    expect(inferAudienceGroup('Çocuk')).toBe('kids');
    expect(inferAudienceGroup('Unisex Comfort Colors')).toBe('unisex');
    expect(inferAudienceGroup('Yeni klasör')).toBeUndefined();
  });

  it('fills the admin video prompt; the default keeps the product faithful', () => {
    const prompt = fillVideoPromptTemplate(DEFAULT_GENERATE_VIDEO_PROMPT, { title: 'Cat Tee', designPrompt: 'cat', product: 't-shirt', niche: 'cats', garment: 'Comfort Colors 1717' });
    expect(prompt).toMatch(/exact Comfort Colors 1717 t-shirt from the reference images/);
    expect(prompt).toMatch(/exactly as in the reference images/);
    expect(fillVideoPromptTemplate('{{title}} | {{niche}} | {{userPrompt}}', { title: 'Cat Tee', designPrompt: 'cat', product: 't-shirt', niche: 'cats' })).toBe('Cat Tee | cats | cat');
  });
});

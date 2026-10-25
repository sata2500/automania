import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db', () => ({ sql: vi.fn(async () => []) }));
vi.mock('@/lib/app-settings', () => ({ loadSettings: vi.fn(async () => ({})) }));
vi.mock('@/lib/google-genai-client', () => ({ createGoogleClient: vi.fn(), loadGoogleConnection: vi.fn(async () => null) }));

import { buildResearchPrompt, parseResearchResponse, upcomingUsEvents } from './niche-research';

describe('upcomingUsEvents', () => {
  it('lists the US occasions in the next months with correct dates', () => {
    const events = upcomingUsEvents(new Date('2026-08-25T12:00:00Z'), 120);
    const names = events.map((e) => e.name);
    expect(names[0]).toBe('Labor Day');
    expect(events.find((e) => e.name === 'Labor Day')?.date).toBe('2026-09-07');
    expect(events.find((e) => e.name === 'Halloween')?.daysAway).toBe(67);
    expect(events.find((e) => e.name === 'Thanksgiving')?.date).toBe('2026-11-26');
    expect(names).not.toContain('Christmas'); // 122 gün sonra
  });

  it('wraps into the next year', () => {
    const events = upcomingUsEvents(new Date('2026-12-20T00:00:00Z'), 60);
    expect(events.map((e) => e.name)).toEqual(['Christmas', "New Year's", "Valentine's Day"]);
  });
});

describe('buildResearchPrompt', () => {
  it('includes the decision inputs and asks for English design text', () => {
    const prompt = buildResearchPrompt({
      today: new Date('2026-08-25T00:00:00Z'),
      productType: 'T-shirt',
      categoryPath: 'Clothing > T-shirts',
      focus: 'pet humor',
      upcomingEvents: [{ name: 'Halloween', date: '2026-10-31', daysAway: 67 }],
      topListings: [{ title: 'Cat Mom Shirt', favorites: 40, views: 900, tags: ['cat mom'] }],
      poolKeywords: [{ keyword: 'dog dad', score: 81, listings: 1200 }],
      recentNiches: ['vampire halloween'],
    });
    expect(prompt).toMatch(/Halloween: 2026-10-31 \(in 67 days\)/);
    expect(prompt).toMatch(/Cat Mom Shirt/);
    expect(prompt).toMatch(/"dog dad" score 81\/100/);
    expect(prompt).toMatch(/"vampire halloween"/);
    expect(prompt).toMatch(/pet humor/);
    expect(prompt).toMatch(/Google Search/);
    expect(prompt).toMatch(/must be in English/);
  });

  it('fills empty data sections with "none" and uses a custom admin template', () => {
    const ctx = { today: new Date('2026-08-25T00:00:00Z'), productType: 'Mug', upcomingEvents: [], topListings: [], poolKeywords: [], recentNiches: [] };
    expect(buildResearchPrompt(ctx)).toMatch(/Upcoming US occasions:\nnone/);
    expect(buildResearchPrompt(ctx, 'Niche for {{productType}} on {{today}}, focus {{focus}}')).toBe('Niche for Mug on 2026-08-25, focus none');
  });
});

describe('parseResearchResponse', () => {
  it('extracts the JSON object even when wrapped in text', () => {
    const parsed = parseResearchResponse('Here you go:\n```json\n{"niche":"Retro Camping Dad","targetAudience":"dads","style":"vintage","designBrief":"Tent at sunset","occasion":"Father\'s Day","keywords":["Camping Dad Shirt"],"reasoning":"Neden"}\n```');
    expect(parsed).toMatchObject({ niche: 'Retro Camping Dad', occasion: "Father's Day", keywords: ['camping dad shirt'] });
  });

  it('returns null without a niche or valid JSON', () => {
    expect(parseResearchResponse('{"targetAudience":"x"}')).toBeNull();
    expect(parseResearchResponse('no json')).toBeNull();
  });
});

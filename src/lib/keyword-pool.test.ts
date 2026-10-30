import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db', () => ({ default: vi.fn() }));
vi.mock('@/lib/etsy-scraper', () => ({ scrapeEtsyKeywordData: vi.fn() }));

const { isFreshPoolRow, normalizeKeywords, publicRow } = await import('./keyword-pool');

const DAY = 24 * 60 * 60 * 1000;
const now = Date.now();

describe('keyword pool', () => {
  it('treats real scores younger than 7 days as fresh', () => {
    expect(isFreshPoolRow({ last_evaluated_at: new Date(now - 2 * DAY), opportunity_score: 40, competition_level: 'Orta' }, now)).toBe(true);
    expect(isFreshPoolRow({ last_evaluated_at: new Date(now - 8 * DAY), opportunity_score: 40, competition_level: 'Orta' }, now)).toBe(false);
    expect(isFreshPoolRow({ last_evaluated_at: new Date(now - DAY), opportunity_score: 0, competition_level: 'Orta' }, now)).toBe(false);
    expect(isFreshPoolRow({ last_evaluated_at: new Date(now - DAY), opportunity_score: 30, competition_level: 'Engellendi / Hata' }, now)).toBe(false);
    expect(isFreshPoolRow(undefined, now)).toBe(false);
  });

  it('normalizes keywords to Etsy tag rules', () => {
    expect(normalizeKeywords(['  Cat  Mom ', 'cat mom', 'a very long keyword over twenty chars', ''])).toEqual(['cat mom']);
  });

  it('hides scores older than 14 days', () => {
    const old = publicRow({ id: '1', keyword: 'cat', opportunity_score: 50, etsy_score: 50, competition_level: 'Düşük', last_evaluated_at: new Date(now - 20 * DAY) });
    expect(old).toMatchObject({ opportunity_score: 0, competition_level: 'Taranacak' });
    const recent = publicRow({ id: '2', keyword: 'dog', opportunity_score: 50, competition_level: 'Düşük', last_evaluated_at: new Date(now - 10 * DAY), usage_count: 4 });
    expect(recent).toMatchObject({ opportunity_score: 50 });
    expect(recent).not.toHaveProperty('usage_count');
  });
});

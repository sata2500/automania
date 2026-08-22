import { beforeEach, describe, expect, it, vi } from 'vitest';

const { ensureTableMock, getSessionMock, getTokenMock, sqlMock } = vi.hoisted(() => ({
  ensureTableMock: vi.fn(),
  getSessionMock: vi.fn(),
  getTokenMock: vi.fn(),
  sqlMock: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  default: sqlMock,
  ensureUserEtsyListingsTable: ensureTableMock,
}));
vi.mock('@/lib/auth-server', () => ({ getAuthoritativeSession: getSessionMock }));
vi.mock('@/lib/etsy-token-manager', () => ({ getValidEtsyToken: getTokenMock }));
vi.mock('@/lib/etsy-seo-evaluator', () => ({ evaluateEtsyListingSeo: vi.fn() }));

import { GET } from './route';

const session = { id: 'user-test-1', role: 'user' };

function taggedQueryText(call: unknown[]): string {
  const strings = call[0];
  return Array.isArray(strings) ? strings.join(' ').replace(/\s+/g, ' ').trim() : '';
}

describe('GET /api/etsy/listings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ensureTableMock.mockResolvedValue(undefined);
    getSessionMock.mockResolvedValue(session);
    getTokenMock.mockResolvedValue({ success: false, error: 'not connected' });
  });

  it('returns 401 before querying listings when unauthenticated', async () => {
    getSessionMock.mockResolvedValue(null);

    const response = await GET(new Request('http://localhost/api/etsy/listings'));

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ success: false });
    expect(sqlMock).not.toHaveBeenCalled();
  });

  it('uses the lightweight projection and computes list stats and filters', async () => {
    sqlMock.mockResolvedValue([
      {
        id: 'row-1', user_id: session.id, listing_id: '100', title: 'Sunrise Tee', tags: ['sunrise', 'tee'],
        price: '24.00', currency_code: 'USD', quantity: 3, state: 'active', url: 'https://etsy.test/100',
        views: 120, num_favorers: 9, primary_image_url: 'https://cdn.test/100.png', taxonomy_id: 1,
        vision_analysis: JSON.stringify({ analyzedAt: '2026-08-22T08:00:00.000Z' }), seo_score: 92,
        ai_optimized_title: null, ai_optimized_at: null, etsy_updated_timestamp: '2026-08-22T08:00:00.000Z',
        last_synced_at: new Date().toISOString(), created_at: '2026-08-20T08:00:00.000Z', updated_at: '2026-08-22T08:00:00.000Z',
      },
      {
        id: 'row-2', user_id: session.id, listing_id: '200', title: 'Ocean Mug', tags: ['ocean'],
        price: '18.00', currency_code: 'USD', quantity: 4, state: 'draft', url: 'https://etsy.test/200',
        views: 30, num_favorers: 2, primary_image_url: 'https://cdn.test/200.png', taxonomy_id: 2,
        vision_analysis: {}, seo_score: 68, ai_optimized_title: null, ai_optimized_at: null,
        etsy_updated_timestamp: '2026-08-21T08:00:00.000Z', last_synced_at: new Date().toISOString(),
        created_at: '2026-08-19T08:00:00.000Z', updated_at: '2026-08-21T08:00:00.000Z',
      },
    ]);

    const response = await GET(new Request('http://localhost/api/etsy/listings?sort=score_desc&scoreFilter=excellent'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.stats).toMatchObject({ total: 2, active: 1, draft: 1, inactive: 0, avgScore: 80, analyzedCount: 1 });
    expect(body.listings).toHaveLength(1);
    expect(body.listings[0].listing_id).toBe('100');
    expect(taggedQueryText(sqlMock.mock.calls[0])).toContain('SELECT id');
    expect(taggedQueryText(sqlMock.mock.calls[0])).not.toContain('SELECT *');
  });

  it('loads a single cached listing detail and leaves inventory null without an Etsy token', async () => {
    const detail = { listing_id: '100', user_id: session.id, title: 'Sunrise Tee', description: 'detail' };
    sqlMock.mockResolvedValue([detail]);

    const response = await GET(new Request('http://localhost/api/etsy/listings?listing_id=100'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ success: true, listing: detail, inventory: null });
    expect(getTokenMock).toHaveBeenCalledWith(session.id);
    expect(taggedQueryText(sqlMock.mock.calls[0])).toContain('SELECT * FROM user_etsy_listings');
  });
});

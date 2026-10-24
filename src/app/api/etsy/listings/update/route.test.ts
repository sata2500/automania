import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { sqlMock } = vi.hoisted(() => ({ sqlMock: vi.fn(async () => [] as unknown[]) }));

vi.mock('@/lib/auth-server', () => ({ getAuthoritativeSession: vi.fn(async () => ({ id: 'user-1' })) }));
vi.mock('@/lib/request-rate-limit', () => ({ checkRateLimit: vi.fn(async () => ({ allowed: true, retryAfterSeconds: 0 })) }));
vi.mock('@/lib/etsy-token-manager', () => ({
  getValidEtsyToken: vi.fn(async () => ({ success: true, access_token: 'tok', shop_id: '99', api_key: 'key', shared_secret: 's' })),
}));
vi.mock('@/lib/db', () => ({ default: sqlMock }));

import { PATCH } from './route';

function patch(body: unknown) {
  return PATCH(new Request('http://localhost/api/etsy/listings/update', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }));
}

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  fetchMock = vi.fn(async () => new Response('{}', { status: 200 }));
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe('PATCH /api/etsy/listings/update', () => {
  it('updates content of an active listing without touching its state', async () => {
    const res = await patch({ listingId: '123', title: 'New title', tags: ['cats & dogs', 'gift'] });
    expect(res.status).toBe(200);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/shops/99/listings/123');
    expect(init.headers).toMatchObject({ 'Content-Type': 'application/x-www-form-urlencoded' });
    const body = new URLSearchParams(String(init.body));
    expect(body.get('title')).toBe('New title');
    expect(body.get('tags')).toBe('cats dogs,gift');
    expect(body.has('state')).toBe(false);
  });

  it('rejects moving a listing to draft (Etsy does not allow it)', async () => {
    const res = await patch({ listingId: '123', state: 'draft' });
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('requires confirmation to deactivate', async () => {
    expect((await patch({ listingId: '123', state: 'inactive' })).status).toBe(400);
    expect((await patch({ listingId: '123', state: 'inactive', confirmStateChange: true })).status).toBe(200);
  });

  it('refuses to activate while live publishing is disabled', async () => {
    const res = await patch({ listingId: '123', state: 'active', confirmLivePublish: true, confirmationPhrase: 'YAYINLA' });
    expect(res.status).toBe(403);
  });

  it('passes Etsy’s error message to the user', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ error: 'Title contains invalid characters' }), { status: 400 }));
    const res = await patch({ listingId: '123', title: 'x' });
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.error).toContain('Title contains invalid characters');
  });
});

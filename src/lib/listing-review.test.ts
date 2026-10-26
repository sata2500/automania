import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Bellek içi sahte veritabanı ─────────────────────────────────────────────
const state = vi.hoisted(() => ({
  run: null as Record<string, unknown> | null,
  template: { id: 't1', userId: 'u1', automationSchedule: {} } as Record<string, unknown> | null,
  claimable: true,
}));

vi.mock('@/db/schema', () => ({
  automationRuns: { __t: 'runs' },
  podTemplates: { __t: 'templates' },
}));
vi.mock('drizzle-orm', () => ({ and: (...a: unknown[]) => a, eq: (...a: unknown[]) => a, desc: (a: unknown) => a, sql: () => ({}) }));
vi.mock('@/lib/db', () => {
  const db = {
    select: () => ({
      from: (t: { __t: string }) => ({
        where: async () => (t.__t === 'runs' ? [state.run] : [state.template]).filter(Boolean),
      }),
    }),
    update: () => ({
      set: (patch: Record<string, unknown>) => ({
        where: async () => { state.run = { ...state.run!, ...patch }; },
      }),
    }),
  };
  // Yalnızca yayın kilidi (UPDATE ... RETURNING id) ham sql ile yapılır.
  const sql = vi.fn(async () => {
    if (!state.claimable) return [];
    state.claimable = false;
    return [{ id: state.run?.id }];
  });
  return { db, sql };
});
const buildListingRequest = vi.hoisted(() => vi.fn(async () => ({
  credentials: { etsyAccessToken: 't', etsyShopId: '42', etsyApiKey: 'k' },
  input: { title: 'x' },
})));
vi.mock('@/lib/automation-runner', () => ({ buildListingRequest }));
const createDraft = vi.hoisted(() => vi.fn(async () => ({
  listingId: 900, listingUrl: 'https://etsy/draft/900', variationsUpdated: true, imagesUploaded: 2, imageItems: ['a', 'b'], videoItems: [], uploadErrors: [] as string[],
})));
vi.mock('@/lib/etsy-listing-service', () => ({ createEtsyDraftListing: createDraft }));
const etsyFetch = vi.hoisted(() => vi.fn(async () => ({ ok: true, status: 200 })));
vi.mock('@/lib/etsy-api', () => ({ etsyFetch, readEtsyError: vi.fn(async () => 'Etsy hata') }));
vi.mock('@/lib/etsy-token-manager', () => ({ getValidEtsyToken: vi.fn(async () => ({ success: true, access_token: 't', shop_id: '42', api_key: 'k' })) }));
vi.mock('@/lib/audit-log', () => ({ writeAuditLog: vi.fn() }));

import { applyReviewAction, publishReviewItem, updateReviewItem } from './listing-review';

const review = (status: string, extra: Record<string, unknown> = {}) => ({
  listingCreation: { status: 'completed', output: { review: { status, updatedAt: '2026-01-01T00:00:00Z', ...extra } } },
});
const reviewOf = () => (state.run?.steps as ReturnType<typeof review>).listingCreation.output.review as Record<string, unknown>;

beforeEach(() => {
  vi.clearAllMocks();
  state.claimable = true;
  state.run = {
    id: 'run1', userId: 'u1', templateId: 't1', status: 'completed', etsyListingId: null,
    steps: review('awaiting'),
    generatedSeo: { title: 'Cat Shirt', description: 'Desc', tags: ['cat'], imageAltTexts: ['alt a', 'alt b'] },
    generatedMockupUrls: ['/a.jpg', '/b.jpg'],
  };
});

describe('publishReviewItem', () => {
  it('creates the listing and activates it on Etsy', async () => {
    const result = await publishReviewItem('u1', 'run1');
    expect(result.status).toBe('published');
    expect(createDraft).toHaveBeenCalledTimes(1);
    const [url, init] = etsyFetch.mock.calls[0] as unknown as [string, { method: string; body: URLSearchParams }];
    expect(url).toContain('/shops/42/listings/900');
    expect(init.method).toBe('PATCH');
    expect(init.body.get('state')).toBe('active');
    expect(state.run?.etsyListingId).toBe('900');
    expect(reviewOf().status).toBe('published');
  });

  it('refuses to publish twice when the lock is already taken', async () => {
    state.claimable = false;
    await expect(publishReviewItem('u1', 'run1')).rejects.toThrow(/yayınlanamaz/);
    expect(createDraft).not.toHaveBeenCalled();
  });

  it('keeps the draft and reports failure when images did not upload; a retry only activates', async () => {
    createDraft.mockResolvedValueOnce({ listingId: 900, listingUrl: 'https://etsy/draft/900', variationsUpdated: true, imagesUploaded: 1, imageItems: ['a', 'b'], videoItems: [], uploadErrors: ['Görsel 2 yüklenemedi'] });
    const failed = await publishReviewItem('u1', 'run1');
    expect(failed.status).toBe('failed');
    expect(failed.error).toMatch(/Görsel 2/);
    expect(etsyFetch).not.toHaveBeenCalled();
    expect(state.run?.etsyListingId).toBe('900');

    state.claimable = true;
    const retried = await publishReviewItem('u1', 'run1');
    expect(retried.status).toBe('published');
    expect(createDraft).toHaveBeenCalledTimes(1); // ikinci taslak açılmadı
    expect(etsyFetch).toHaveBeenCalledTimes(1);
  });

  it('marks the item failed when Etsy refuses activation', async () => {
    etsyFetch.mockResolvedValueOnce({ ok: false, status: 400 });
    const result = await publishReviewItem('u1', 'run1');
    expect(result.status).toBe('failed');
    expect(result.error).toMatch(/Etsy hata/);
  });
});

describe('review actions and edits', () => {
  it('schedules, unschedules, rejects and restores', async () => {
    const scheduled = await applyReviewAction('u1', 'run1', { type: 'approve', scheduledAt: '2030-05-01T09:00:00Z' });
    expect(scheduled).toMatchObject({ status: 'scheduled', scheduledAt: '2030-05-01T09:00:00.000Z' });
    expect((await applyReviewAction('u1', 'run1', { type: 'unschedule' })).status).toBe('awaiting');
    expect((await applyReviewAction('u1', 'run1', { type: 'reject' })).status).toBe('rejected');
    await expect(applyReviewAction('u1', 'run1', { type: 'approve' })).rejects.toThrow();
    expect((await applyReviewAction('u1', 'run1', { type: 'restore' })).status).toBe('awaiting');
  });

  it('saves edited text, photo order and alt texts', async () => {
    await updateReviewItem('u1', 'run1', {
      title: '  New  Title ', tags: ['cat tee', 'cat tee', 'gift'], photos: ['/b.jpg', '/x.jpg'], includeVideo: false,
      imageAltTexts: { '/b.jpg': 'new alt b' },
    });
    const seo = state.run?.generatedSeo as { title: string; tags: string[]; imageAltTexts: string[] };
    expect(seo.title).toBe('New Title');
    expect(seo.tags).toEqual(['cat tee', 'gift']);
    expect(seo.imageAltTexts).toEqual(['alt a', 'new alt b']);
    expect(reviewOf()).toMatchObject({ photos: ['/b.jpg'], includeVideo: false });
  });

  it('rejects invalid edits and published items', async () => {
    await expect(updateReviewItem('u1', 'run1', { tags: ['this tag is way too long for etsy'] })).rejects.toThrow(/20 karakter/);
    await expect(updateReviewItem('u1', 'run1', { photos: ['/nope.jpg'] })).rejects.toThrow(/fotoğraf/);
    state.run = { ...state.run!, steps: review('published') };
    await expect(updateReviewItem('u1', 'run1', { title: 'x' })).rejects.toThrow(/düzenlenemez/);
  });
});

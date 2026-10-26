import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db', () => ({ default: vi.fn(async () => [{ id: 482 }]) }));
vi.mock('@/lib/r2', () => ({ isR2Configured: () => false, getR2Client: vi.fn(), getBucketName: vi.fn(), extractKeyFromUrlOrKey: vi.fn() }));
vi.mock('@/lib/upload-security', () => ({ isOwnedUploadName: () => true }));
const etsyFetch = vi.hoisted(() => vi.fn());
vi.mock('@/lib/etsy-api', () => ({ etsyFetch, readEtsyError: vi.fn(async () => 'error') }));

import { createEtsyDraftListing } from './etsy-listing-service';

const creds = { etsyAccessToken: 't', etsyShopId: 42, etsyApiKey: 'k' };
const base = { title: 'Shirt', description: 'Desc', validTags: ['tee'], price: 25, quantity: 999, taxonomyId: 482 };
const PNG = `data:image/png;base64,${Buffer.from('png').toString('base64')}`;

beforeEach(() => {
  etsyFetch.mockReset();
  etsyFetch.mockImplementation(async (url: string) => ({ ok: true, status: 201, json: async () => (url.endsWith('/listings') ? { listing_id: 9 } : {}) }));
});

describe('createEtsyDraftListing', () => {
  it('sends weight, dimensions, auto-renew and production partners', async () => {
    await createEtsyDraftListing('u1', creds, {
      ...base, should_auto_renew: true, production_partner_id: ['7'],
      item_weight: 6, item_weight_unit: 'oz', item_length: 10, item_width: 8, item_height: 1, item_dimensions_unit: 'in',
    });
    const body = etsyFetch.mock.calls[0]![1].body as URLSearchParams;
    expect(body.get('should_auto_renew')).toBe('true');
    expect(body.getAll('production_partner_ids')).toEqual(['7']);
    expect([body.get('item_weight'), body.get('item_weight_unit')]).toEqual(['6', 'oz']);
    expect([body.get('item_length'), body.get('item_width'), body.get('item_height'), body.get('item_dimensions_unit')]).toEqual(['10', '8', '1', 'in']);
  });

  it('omits incomplete dimensions and unitless weight', async () => {
    await createEtsyDraftListing('u1', creds, { ...base, item_weight: 6, item_length: 10, item_dimensions_unit: 'cm' });
    const body = etsyFetch.mock.calls[0]![1].body as URLSearchParams;
    expect(body.has('item_weight')).toBe(false);
    expect(body.has('item_length')).toBe(false);
  });

  it('uploads each photo with its alt text', async () => {
    await createEtsyDraftListing('u1', creds, {
      ...base,
      images: [{ url: PNG, isVideo: false, altText: `  Black tee\nwith a cat ${'x'.repeat(300)}` }, { url: PNG, isVideo: false }],
    });
    const uploads = etsyFetch.mock.calls.filter(([url]) => String(url).endsWith('/images')).map(([, init]) => init.body as FormData);
    expect(uploads).toHaveLength(2);
    const alt = uploads[0]!.get('alt_text') as string;
    expect(alt.startsWith('Black tee with a cat')).toBe(true);
    expect(alt.length).toBeLessThanOrEqual(250);
    expect(uploads[1]!.has('alt_text')).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { isFreeShippingProfile } from './etsy-shipping';

const cost = (amount: number) => ({ amount, divisor: 100, currency_code: 'USD' });

describe('isFreeShippingProfile', () => {
  it('uses the US destination when present', () => {
    expect(isFreeShippingProfile({ shipping_profile_id: 1, title: 'x', shipping_profile_destinations: [
      { destination_country_iso: 'US', primary_cost: cost(0) },
      { destination_country_iso: 'CA', primary_cost: cost(1500) },
    ] })).toBe(true);
    expect(isFreeShippingProfile({ shipping_profile_id: 1, title: 'x', shipping_profile_destinations: [
      { destination_country_iso: 'US', primary_cost: cost(499) },
    ] })).toBe(false);
  });

  it('falls back to the everywhere destination and returns null when unknown', () => {
    expect(isFreeShippingProfile({ shipping_profile_id: 1, title: 'x', shipping_profile_destinations: [
      { destination_country_iso: null, destination_region: 'none', primary_cost: cost(0) },
    ] })).toBe(true);
    expect(isFreeShippingProfile({ shipping_profile_id: 1, title: 'x' })).toBeNull();
  });
});

describe('listingCopyFacts', async () => {
  const { listingCopyFacts, normalizeListingCopy } = await import('./listing-defaults');

  it('states free shipping only when known and skips empty fields', () => {
    const copy = normalizeListingCopy({ productInfo: 'Comfort Colors 1717', freeShipping: null });
    expect(listingCopyFacts(copy, true)).toContain('FREE shipping');
    expect(listingCopyFacts(copy, false)).toContain('NOT free');
    expect(listingCopyFacts(copy, null)).not.toMatch(/shipping/i);
    expect(listingCopyFacts(normalizeListingCopy({}), null)).toBe('None provided');
    // Kullanıcının seçimi profilden anlaşılandan önce gelir.
    expect(listingCopyFacts(normalizeListingCopy({ freeShipping: false }), true)).toContain('NOT free');
  });
});

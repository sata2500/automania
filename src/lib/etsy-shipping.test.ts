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
  const { listingCopyFacts, normalizeListingCopy, processingTimeText } = await import('./listing-defaults');

  it('states free shipping only when known and skips empty fields', () => {
    const copy = normalizeListingCopy({ productInfo: 'Comfort Colors 1717', freeShipping: true, extraNotes: 'old' });
    expect(copy).toEqual({ productInfo: 'Comfort Colors 1717' });
    expect(listingCopyFacts(copy, { freeShipping: true })).toContain('FREE shipping');
    expect(listingCopyFacts(copy, { freeShipping: false })).toContain('NOT free');
    expect(listingCopyFacts(copy, { freeShipping: null })).not.toMatch(/shipping/i);
    expect(listingCopyFacts(normalizeListingCopy({}))).toBe('None provided');
  });

  it('builds the processing time from the Etsy readiness state', () => {
    expect(processingTimeText({ readiness_state: 'made_to_order', min_processing_time: 1, max_processing_time: 3, processing_time_unit: 'business_days' }))
      .toBe('Made to order, ships in 1-3 business days');
    expect(processingTimeText({ readiness_state: 'ready_to_ship', min_processing_time: 1, max_processing_time: 1 })).toBe('Ready to ship, ships in 1 business day');
    expect(processingTimeText(null)).toBeNull();
    expect(listingCopyFacts(normalizeListingCopy({}), { processing: 'Made to order, ships in 1-3 business days' })).toContain('Production & shipping time');
  });
});

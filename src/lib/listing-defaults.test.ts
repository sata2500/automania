import { describe, expect, it } from 'vitest';
import { EMPTY_LISTING_DEFAULTS, missingListingSettings, normalizeListingDefaults, variationRowsFromDefaults } from './listing-defaults';

describe('listing defaults', () => {
  it('fills missing fields and drops prices for sizes that are not offered', () => {
    const normalized = normalizeListingDefaults({
      productType: '  Hoodie ',
      etsy: { shippingProfileId: '11', readinessStateId: '5', price: 'x' },
      variations: { sizes: ['S', 'M', 'M', ' '], colors: ['Black'], basePrice: 30, sizePrices: { M: 32, XL: 40 }, quantity: 5 },
    });
    expect(normalized.productType).toBe('Hoodie');
    expect(normalized.etsy.price).toBe(30);
    expect(normalized.variations).toMatchObject({ sizes: ['S', 'M'], colors: ['Black'], sizePrices: { M: 32 }, quantity: 5 });
    expect(missingListingSettings(normalized)).toEqual([]);
    expect(missingListingSettings(normalizeListingDefaults(null))).toEqual(['kargo profili', 'hazırlık süresi']);
  });

  it('builds one enabled row per size and colour with size-specific prices', () => {
    const rows = variationRowsFromDefaults({ sizes: ['M', '2XL'], colors: ['White', 'Black'], basePrice: 25, sizePrices: { '2XL': 28 }, quantity: 999 });
    expect(rows).toHaveLength(4);
    expect(rows.find((r) => r.size === '2XL' && r.color === 'Black')).toMatchObject({ price: 28, enabled: true, quantity: 999 });
    expect(rows.find((r) => r.size === 'M')?.price).toBe(25);
    expect(variationRowsFromDefaults(EMPTY_LISTING_DEFAULTS.variations)).toHaveLength(30);
  });
});

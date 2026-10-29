import { describe, expect, it } from 'vitest';
import { EMPTY_LISTING_DEFAULTS, missingListingSettings, normalizeListingDefaults, variationDefaultsFromRows, variationRowsFromDefaults } from './listing-defaults';

describe('listing defaults', () => {
  it('fills missing fields and drops prices for sizes that are not offered', () => {
    const normalized = normalizeListingDefaults({
      etsy: { shippingProfileId: '11', readinessStateId: '5', price: 'x' },
      variations: { sizes: ['S', 'M', 'M', ' '], colors: ['Black'], basePrice: 30, sizePrices: { M: 32, XL: 40 }, quantity: 5 },
    });
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

describe('saved variation templates', () => {
  const rows = [
    { id: 'a', size: 'M', color: 'White', price: 25, quantity: 999, sku: '', enabled: true },
    { id: 'b', size: 'M', color: 'Black', price: 25, quantity: 999, sku: 'X1', enabled: false },
    { id: 'c', size: '2XL', color: 'White', price: 28, quantity: 999, sku: '', enabled: true },
    { id: 'd', size: '2XL', color: 'Black', price: 28, quantity: 999, sku: '', enabled: true },
  ];

  it('turns template rows into sizes, colours and size prices', () => {
    expect(variationDefaultsFromRows(rows)).toEqual({ sizes: ['M', '2XL'], colors: ['White', 'Black'], basePrice: 25, sizePrices: { '2XL': 28 }, quantity: 999, colorSpecificPrices: false });
  });

  it('flags templates whose prices differ by colour', () => {
    const mixed = rows.map((r) => (r.id === 'd' ? { ...r, price: 30 } : r));
    expect(variationDefaultsFromRows(mixed).colorSpecificPrices).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';
import { rowsFromEtsyInventory } from './etsy-inventory-rows';

const product = (size: string, color: string, amount: number, extra: Record<string, unknown> = {}) => ({
  property_values: [
    { property_id: 100, property_name: 'Size', values: [size] },
    { property_id: 200, property_name: 'Primary color', values: [color] },
  ],
  offerings: [{ price: { amount, divisor: 100 }, quantity: 50, is_enabled: true }],
  ...extra,
});

describe('rowsFromEtsyInventory', () => {
  it('maps size, color, price, stock and status', () => {
    const rows = rowsFromEtsyInventory({ products: [product('S', 'Black', 2499), product('2XL', 'White', 2699, { offerings: [{ price: { amount: 2699, divisor: 100 }, quantity: 3, is_enabled: false }] })] });
    expect(rows).toEqual([
      { id: 's-black', size: 'S', color: 'Black', price: 24.99, quantity: 50, sku: '', enabled: true },
      { id: '2xl-white', size: '2XL', color: 'White', price: 26.99, quantity: 3, sku: '', enabled: false },
    ]);
  });

  it('skips deleted products and duplicates; falls back to property order for unknown names', () => {
    const rows = rowsFromEtsyInventory({
      products: [
        product('S', 'Black', 2000),
        product('S', 'Black', 2000),
        product('M', 'Red', 2000, { is_deleted: true }),
        { property_values: [{ property_name: 'Style', values: ['Tee'] }, { property_name: 'Print', values: ['Front'] }], offerings: [{ price: { amount: 1500, divisor: 100 }, quantity: 1 }] },
      ],
    });
    expect(rows.map((r) => [r.size, r.color, r.price])).toEqual([['S', 'Black', 20], ['Tee', 'Front', 15]]);
  });

  it('returns no rows for an empty or invalid inventory', () => {
    expect(rowsFromEtsyInventory(null)).toEqual([]);
    expect(rowsFromEtsyInventory({ products: [] })).toEqual([]);
  });
});

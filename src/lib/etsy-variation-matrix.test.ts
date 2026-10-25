import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/etsy-api', () => ({ etsyFetch: vi.fn() }));
vi.mock('@/lib/media-source', () => ({ loadImageForUser: vi.fn() }));

import { completeVariationMatrix } from './etsy-listing-service';

describe('completeVariationMatrix', () => {
  it('fills missing size × color combinations as disabled rows (Etsy requires the full matrix)', () => {
    const rows = completeVariationMatrix([
      { size: 'CC1717 S', color: 'White', price: 25, quantity: 999, enabled: true },
      { size: 'CC1717 S', color: 'Black', price: 26, quantity: 999, enabled: true },
      { size: 'Youth M', color: 'White', price: 20, quantity: 999, enabled: true },
    ], 24.99);
    expect(rows).toHaveLength(4);
    const missing = rows.find((r) => r.size === 'Youth M' && r.color === 'Black');
    expect(missing).toMatchObject({ enabled: false, price: 20 });
    expect(rows.filter((r) => r.enabled !== false)).toHaveLength(3);
  });

  it('keeps the first row for duplicate combinations', () => {
    const rows = completeVariationMatrix([
      { size: 'M', color: 'Red', price: 10, enabled: true },
      { size: 'M', color: 'Red', price: 99, enabled: true },
    ], 5);
    expect(rows).toEqual([{ size: 'M', color: 'Red', price: 10, enabled: true }]);
  });
});

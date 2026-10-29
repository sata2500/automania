import { describe, expect, it } from 'vitest';
import { generateListingSku, sanitizeSku, skuPrefix } from './sku';

describe('listing sku', () => {
  it('builds PRODUCT-YYMMDD-XXXX with an unambiguous suffix', () => {
    const sku = generateListingSku('Comfort Colors T-shirt', new Date(2026, 9, 29), () => 0.5);
    expect(sku).toMatch(/^TSH-261029-[2-9A-Z]{4}$/);
    expect(sku).not.toMatch(/[IOLU01]$/);
  });

  it('maps product types to short prefixes', () => {
    expect(skuPrefix('Unisex Hoodie')).toBe('HOD');
    expect(skuPrefix('Crewneck Sweatshirt')).toBe('SWT');
    expect(skuPrefix('Kahve Kupası')).toBe('MUG');
    expect(skuPrefix(undefined)).toBe('POD');
  });

  it('is unique enough across many listings on the same day', () => {
    const seen = new Set(Array.from({ length: 500 }, () => generateListingSku('tee')));
    expect(seen.size).toBeGreaterThan(490);
  });

  it('sanitizes user input to Etsy-safe SKU characters', () => {
    expect(sanitizeSku('  tsh 261029 k7qd! ')).toBe('TSH-261029-K7QD');
    expect(sanitizeSku('x'.repeat(40))).toHaveLength(32);
  });
});

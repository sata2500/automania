import { describe, expect, it } from 'vitest';
import { runSkuOf } from './run-sku';

describe('runSkuOf', () => {
  it('prefers the SKU edited in review, then the automation SKU, then the studio SKU', () => {
    const automation = { designGeneration: { status: 'completed', output: { sku: 'TSH-1' } }, backgroundRemoval: { status: 'completed', output: { sku: 'TSH-1' } } };
    expect(runSkuOf(automation)).toBe('TSH-1');
    expect(runSkuOf({ ...automation, listingCreation: { status: 'completed', output: { review: { status: 'awaiting', sku: 'EDITED-2', updatedAt: '' } } } })).toBe('EDITED-2');
    expect(runSkuOf({ listingCreation: { status: 'completed', output: { manualListing: { sku: 'STUDIO-3' } } } })).toBe('STUDIO-3');
    expect(runSkuOf(null)).toBeNull();
  });
});

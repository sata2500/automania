import { describe, expect, it } from 'vitest';
import { folderListingFields, mergeFolderEtsy, missingFolderEtsy, normalizeFolderEtsy } from './folder-listing';

describe('folder listing settings', () => {
  it('keeps only known Etsy store fields and drops empty values', () => {
    expect(normalizeFolderEtsy({ whoMade: 'robot', shippingProfileId: 123, readinessStateId: '', shouldAutoRenew: true, itemWeight: 5 }))
      .toEqual({ shippingProfileId: '123', shouldAutoRenew: true });
  });

  it('lets the folder override the fallback settings field by field', () => {
    const merged = mergeFolderEtsy({ shippingProfileId: 'old', readinessStateId: 'r1', taxonomyId: 482 }, { shippingProfileId: 'sp2' });
    expect(merged).toEqual({ shippingProfileId: 'sp2', readinessStateId: 'r1', taxonomyId: 482 });
    expect(missingFolderEtsy({ shippingProfileId: 'sp2' })).toEqual(['hazırlık süresi']);
  });

  it('cleans audience, garments and product info', () => {
    const fields = folderListingFields({ audienceGroup: 'women', garments: [' Gildan 18500 ', ''], productInfo: '  50/50   blend ' });
    expect(fields).toEqual({ audienceGroup: 'women', garments: ['Gildan 18500'], productInfo: '50/50 blend', etsy: {} });
    expect(folderListingFields({ audienceGroup: 'aliens' as never }).audienceGroup).toBeUndefined();
  });
});

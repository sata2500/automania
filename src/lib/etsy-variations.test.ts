import { describe, expect, it } from 'vitest';
import { validateBulkVariations } from './etsy-variations';
import { sanitizeEtsyTags } from './etsy-format';
import { selectEtsyPublishMedia, validateWhoMade } from './etsy-preflight';

describe('validateBulkVariations', () => {
  it('rejects missing prices and stock instead of sending 0', () => {
    const result = validateBulkVariations([{ size: 'M', color: 'Black', price: undefined, quantity: 5 }]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('M / Black: fiyat');
  });

  it('requires at least one enabled variation', () => {
    const result = validateBulkVariations([{ size: 'M', price: 20, quantity: 1, enabled: false }]);
    expect(result.ok).toBe(false);
  });

  it('builds products and only uses SKU properties when SKUs exist', () => {
    const result = validateBulkVariations([
      { size: 'S', color: 'N/A', price: 19.99, quantity: 10 },
      { size: 'M', color: 'N/A', price: '21', quantity: '10' },
    ]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.usedProperties).toEqual([513]);
      expect(result.hasSku).toBe(false);
      expect(result.products[1].offerings[0]).toEqual({ price: 21, quantity: 10, is_enabled: true });
    }
  });
});

describe('sanitizeEtsyTags', () => {
  it('removes characters Etsy rejects and de-duplicates', () => {
    expect(sanitizeEtsyTags(['cats & dogs', 'Cats  dogs', 'mom, gift', "mom's tee", 'this tag is far too long for etsy'])).toEqual([
      'cats dogs',
      'mom gift',
      "mom's tee",
    ]);
  });

  it('keeps at most 13 tags', () => {
    expect(sanitizeEtsyTags(Array.from({ length: 20 }, (_, i) => `tag ${i}`))).toHaveLength(13);
  });
});

describe('selectEtsyPublishMedia', () => {
  it('limits to 20 photos and 1 video and reports what was skipped', () => {
    const items = [
      ...Array.from({ length: 22 }, (_, i) => ({ id: `p${i}`, isVideo: false })),
      { id: 'v1', isVideo: true },
      { id: 'v2', isVideo: true },
    ];
    const media = selectEtsyPublishMedia(items);
    expect(media.photos).toHaveLength(20);
    expect(media.videos.map((v) => v.id)).toEqual(['v1']);
    expect(media.skippedPhotos).toBe(2);
    expect(media.skippedVideos).toBe(1);
  });
});

describe('validateWhoMade', () => {
  it('rejects "someone else made it" for new finished products', () => {
    expect(validateWhoMade({ whoMade: 'someone_else', isSupply: false, whenMade: 'made_to_order' })).toContain('Ben yaptım');
  });

  it('allows the print-on-demand declaration and vintage or supply items', () => {
    expect(validateWhoMade({ whoMade: 'i_did', isSupply: false, whenMade: 'made_to_order' })).toBeNull();
    expect(validateWhoMade({ whoMade: 'someone_else', isSupply: true, whenMade: 'made_to_order' })).toBeNull();
    expect(validateWhoMade({ whoMade: 'someone_else', isSupply: false, whenMade: '1990s' })).toBeNull();
  });
});

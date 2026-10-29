import { describe, expect, it } from 'vitest';
import type { AutomationRunSteps } from '@/types/templates';
import { hasManualVariations, manualSettingsOf, withManualSettings, type ManualListingSettings } from './manual-listing';

const settings = (variations: ManualListingSettings['variations']): ManualListingSettings => ({
  etsy: { shippingProfileId: '1', readinessStateId: '2', taxonomyId: 482, price: 20, whoMade: 'i_did', whenMade: 'made_to_order' } as ManualListingSettings['etsy'],
  variations,
});
const row = (enabled: boolean) => ({ id: 'a', size: 'M', color: 'Black', price: 25, quantity: 5, sku: '', enabled });

describe('manual listing settings', () => {
  it('requires at least one enabled variation before publishing', () => {
    expect(hasManualVariations(null)).toBe(false);
    expect(hasManualVariations(settings([]))).toBe(false);
    expect(hasManualVariations(settings([row(false)]))).toBe(false);
    expect(hasManualVariations(settings([row(false), row(true)]))).toBe(true);
  });

  it('writes the chosen template back where the settings were stored', () => {
    const production = { mockupRender: { status: 'completed', output: { listingSettings: settings([]), photos: ['x'] } } } as unknown as AutomationRunSteps;
    const updated = withManualSettings(production, { ...settings([row(true)]), variationTemplateId: 'vt1', variationTemplateName: 'Unisex' });
    expect(manualSettingsOf(updated)).toMatchObject({ variationTemplateId: 'vt1', variations: [row(true)] });
    expect(updated.mockupRender?.output?.photos).toEqual(['x']);

    const studio = { listingCreation: { status: 'completed', output: { manualListing: settings([]) } } } as unknown as AutomationRunSteps;
    expect(manualSettingsOf(withManualSettings(studio, settings([row(true)])))?.variations).toHaveLength(1);
  });
});

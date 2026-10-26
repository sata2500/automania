import { describe, expect, it } from 'vitest';
import { selectableTaxonomyProperties, validateTaxonomyPropertyValues, type EtsyTaxonomyProperty } from './etsy-taxonomy-properties';

const props: EtsyTaxonomyProperty[] = [
  { property_id: 1, name: 'Sleeve length', possible_values: [{ value_id: 10, name: 'Short sleeve' }, { value_id: 11, name: 'Long sleeve' }] },
  { property_id: 2, name: 'Holiday', is_multivalued: true, max_values_allowed: 2, possible_values: [{ value_id: 20, name: 'Christmas' }, { value_id: 21, name: 'Halloween' }, { value_id: 22, name: 'Easter' }] },
  { property_id: 200, name: 'Primary color', possible_values: [{ value_id: 1, name: 'Black' }] },
  { property_id: 100, name: 'Size', scales: [{}], possible_values: [{ value_id: 5, name: 'M' }] },
  { property_id: 3, name: 'Custom note', possible_values: [] },
];

describe('etsy taxonomy properties', () => {
  it('offers only attributes the AI can fill (no size/color, no scales, with values)', () => {
    expect(selectableTaxonomyProperties(props).map((p) => p.property_id)).toEqual([1, 2]);
  });

  it('keeps only known property and value ids and respects value limits', () => {
    const selectable = selectableTaxonomyProperties(props);
    const result = validateTaxonomyPropertyValues([
      { property_id: 1, value_ids: [10, 11] }, // tek değerli → yalnız ilki
      { property_id: 2, value_ids: [20, 21, 22, 99] }, // en fazla 2, bilinmeyen 99 atılır
      { property_id: 200, value_ids: [1] }, // renk sunulmadı → atılır
      { property_id: 7, value_ids: [70] }, // bilinmeyen özellik
    ], selectable);
    expect(result).toEqual({ '1': [10], '2': [20, 21] });
    expect(validateTaxonomyPropertyValues(null, selectable)).toEqual({});
  });
});

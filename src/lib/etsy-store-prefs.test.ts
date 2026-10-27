import { beforeEach, describe, expect, it } from 'vitest';
import { pickPreferredId, prefsFromTemplates, readStorePrefs, saveStorePrefs } from './etsy-store-prefs';

const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  globalThis.localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, v); },
  } as Storage;
});

describe('etsy store prefs', () => {
  it('merges new choices without erasing earlier ones', () => {
    saveStorePrefs({ shippingProfileId: '11', whoMade: 'someone_else' });
    saveStorePrefs({ shippingProfileId: '', readinessStateId: '5' });
    expect(readStorePrefs()).toEqual({ shippingProfileId: '11', whoMade: 'someone_else', readinessStateId: '5' });
  });

  it('prefers the remembered id only while it still exists', () => {
    const items = [{ id: 1 }, { id: 2 }];
    expect(pickPreferredId(items, (i) => i.id, '2')).toBe('2');
    expect(pickPreferredId(items, (i) => i.id, '9')).toBe('');
    expect(pickPreferredId([{ id: 4 }], (i) => i.id, '9')).toBe('4');
  });

  it('takes the latest automation template that has Etsy settings', () => {
    const prefs = prefsFromTemplates([
      { automationSchedule: { etsy: { shippingProfileId: '1', readinessStateId: '2' } } },
      { automationSchedule: { etsy: { shippingProfileId: '3', productionPartnerIds: ['77'] } } },
      { automationSchedule: null },
    ]);
    expect(prefs).toMatchObject({ shippingProfileId: '3', productionPartnerId: '77' });
  });
});

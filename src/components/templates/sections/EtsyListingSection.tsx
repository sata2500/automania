'use client';

/**
 * Bağlı Etsy mağazasının ilan seçenekleri (kargo profilleri, hazırlık süreleri, iade politikaları, bölümler,
 * üretim ortakları) ve şablonların varsayılan Etsy ayarları. Seçimler mockup klasörünün Klasör ayarları'nda yapılır.
 */
import type { PodTemplateEtsyListingSettings } from '@/types/templates';
import type { EtsyReadinessState, EtsyReturnPolicy, EtsyShippingProfile, EtsyShopSection } from '@/types/etsy';

const STORE_OPTIONS_TTL_MS = 5 * 60_000;
let storeOptionsCache: { at: number; promise: Promise<StoreOptions> } | null = null;

/**
 * Bağlı Etsy mağazasının seçenekleri (kargo profilleri, hazırlık süreleri, iade politikaları, bölümler, üretim
 * ortakları). Sekmeler arası geçişte yeniden beklenmesin diye birkaç dakika önbellekte tutulur.
 */
export function loadEtsyStoreOptions(force = false): Promise<StoreOptions> {
  if (!force && storeOptionsCache && Date.now() - storeOptionsCache.at < STORE_OPTIONS_TTL_MS) return storeOptionsCache.promise;
  const empty: StoreOptions = { connected: false, profiles: [], readinessStates: [], returnPolicies: [], sections: [], partners: [] };
  const promise = (async () => {
    const data = await fetch('/api/etsy/shipping-profiles').then((r) => r.json());
    if (!data.connected) return empty;
    const [policies, sections, partners] = await Promise.all([
      fetch('/api/etsy/return-policies').then((r) => r.json()).catch(() => ({})),
      fetch('/api/etsy/shop-sections').then((r) => r.json()).catch(() => ({})),
      fetch('/api/etsy/production-partners').then((r) => r.json()).catch(() => ({})),
    ]);
    return {
      connected: true,
      profiles: data.profiles || [],
      readinessStates: data.readinessStates || [],
      returnPolicies: policies.returnPolicies || [],
      sections: sections.sections || [],
      partners: partners.partners || [],
    };
  })().catch(() => {
    storeOptionsCache = null;
    return empty;
  });
  storeOptionsCache = { at: Date.now(), promise };
  return promise;
}

export const DEFAULT_ETSY_LISTING_SETTINGS: PodTemplateEtsyListingSettings = {
  shippingProfileId: '',
  readinessStateId: '',
  taxonomyId: 482,
  price: 24.99,
  whoMade: 'i_did',
  whenMade: 'made_to_order',
};

export type StoreOptions = {
  connected: boolean;
  profiles: EtsyShippingProfile[];
  readinessStates: EtsyReadinessState[];
  returnPolicies: EtsyReturnPolicy[];
  sections: EtsyShopSection[];
  partners: ProductionPartner[];
};

type ProductionPartner = { production_partner_id: number; partner_name: string; location?: string };

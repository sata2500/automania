/**
 * Etsy mağaza ayarlarının (kargo profili, hazırlık süresi, iade politikası, üretim bilgileri) hatırlanması.
 * İlan Stüdyosu her açıldığında son kullanılan ayarlar seçili gelir; cihazda kayıt yoksa otomasyon
 * şablonlarındaki Etsy ayarları başlangıç değeri olarak kullanılır.
 */
export type EtsyStorePrefs = {
  shippingProfileId?: string;
  readinessStateId?: string;
  returnPolicyId?: string;
  shouldAutoRenew?: boolean;
  whoMade?: string;
  whenMade?: string;
  productionPartnerId?: string;
};

const KEY = 'automania_etsy_store_prefs_v1';

export function readStorePrefs(): EtsyStorePrefs {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || '{}');
    return parsed && typeof parsed === 'object' ? parsed as EtsyStorePrefs : {};
  } catch {
    return {};
  }
}

/** Boş seçimler önceki kaydı silmez (listeler henüz yüklenmemiş olabilir); üretim ortağı elle silinebilir. */
export function saveStorePrefs(next: EtsyStorePrefs): EtsyStorePrefs {
  const merged: EtsyStorePrefs = { ...readStorePrefs() };
  for (const [key, value] of Object.entries(next) as [keyof EtsyStorePrefs, unknown][]) {
    if (value === undefined || (value === '' && key !== 'productionPartnerId')) continue;
    (merged as Record<string, unknown>)[key] = value;
  }
  try { localStorage.setItem(KEY, JSON.stringify(merged)); } catch {}
  return merged;
}

/** Kayıtlı kimlik listede hâlâ varsa onu, yoksa tek seçenek varsa onu döner; aksi halde boş. */
export function pickPreferredId<T>(items: T[], idOf: (item: T) => string | number, preferred?: string): string {
  if (preferred && items.some((item) => String(idOf(item)) === preferred)) return preferred;
  return items.length === 1 ? String(idOf(items[0]!)) : '';
}

type TemplateLike = { automationSchedule?: { etsy?: { shippingProfileId?: string; readinessStateId?: string; returnPolicyId?: string; whoMade?: string; whenMade?: string; productionPartnerIds?: string[]; shouldAutoRenew?: boolean } } | null };

/** Otomasyon şablonlarından (en son güncellenen önce) Etsy ayarı dolu ilkini tercih olarak çıkarır. */
export function prefsFromTemplates(templates: TemplateLike[]): EtsyStorePrefs {
  const etsy = [...templates].reverse().map((t) => t.automationSchedule?.etsy).find((e) => e?.shippingProfileId);
  if (!etsy) return {};
  return {
    shippingProfileId: etsy.shippingProfileId || undefined,
    readinessStateId: etsy.readinessStateId || undefined,
    returnPolicyId: etsy.returnPolicyId || undefined,
    whoMade: etsy.whoMade,
    whenMade: etsy.whenMade,
    productionPartnerId: etsy.productionPartnerIds?.[0],
    shouldAutoRenew: etsy.shouldAutoRenew,
  };
}

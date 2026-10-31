/**
 * Mockup klasörünün ilan ayarları (saf modül; istemci ve sunucuda). Klasör = bir Etsy ilanı: ürün kategorisi,
 * varsayılan varyasyon, kitle, ürün modelleri, ürün bilgisi ve Etsy mağaza ayarları klasörde tutulur; manuel
 * ilanlar ve otomasyonlar bunları kullanır. Klasörde olmayan mağaza ayarı için eski kayıtlar (Ayarlar'daki
 * ilan varsayılanları, otomasyon şablonu) yedek olarak kullanılır.
 */
import type { FolderEtsySettings, MockupFolder } from '@/types/pod';
import type { AudienceGroup, PodTemplateEtsyListingSettings } from '@/types/templates';

export const AUDIENCE_OPTIONS: { id: AudienceGroup; label: string }[] = [
  { id: 'men', label: 'Erkek' },
  { id: 'women', label: 'Kadın' },
  { id: 'unisex', label: 'Unisex' },
  { id: 'kids', label: 'Çocuk' },
  { id: 'baby', label: 'Bebek' },
];

const AUDIENCE_IDS = new Set(AUDIENCE_OPTIONS.map((o) => o.id));
const WHO_MADE = new Set(['i_did', 'someone_else', 'collective']);

const text = (value: unknown, max: number) => (typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '');
const id = (value: unknown) => (typeof value === 'string' || typeof value === 'number' ? String(value).trim().slice(0, 40) : '');

/** Klasörün Etsy ayarlarını temizler (boş alanlar yazılmaz: yedek değer kullanılsın). */
export function normalizeFolderEtsy(input: unknown): FolderEtsySettings {
  const raw = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const out: FolderEtsySettings = {};
  if (WHO_MADE.has(String(raw.whoMade))) out.whoMade = raw.whoMade as FolderEtsySettings['whoMade'];
  if (id(raw.shippingProfileId)) out.shippingProfileId = id(raw.shippingProfileId);
  if (id(raw.readinessStateId)) out.readinessStateId = id(raw.readinessStateId);
  if (id(raw.returnPolicyId)) out.returnPolicyId = id(raw.returnPolicyId);
  const partners = Array.isArray(raw.productionPartnerIds) ? raw.productionPartnerIds.map(id).filter(Boolean).slice(0, 10) : [];
  if (partners.length > 0) out.productionPartnerIds = partners;
  if (typeof raw.shouldAutoRenew === 'boolean') out.shouldAutoRenew = raw.shouldAutoRenew;
  return out;
}

/** Klasörün metin/kitle ayarları (sunucu, istemciden gelen veriye güvenmeden okur). */
export function folderListingFields(folder: Partial<MockupFolder> | null | undefined): {
  audienceGroup?: AudienceGroup; garments: string[]; productInfo: string; etsy: FolderEtsySettings;
} {
  const audience = folder?.audienceGroup;
  return {
    audienceGroup: audience && AUDIENCE_IDS.has(audience) ? audience : undefined,
    garments: (Array.isArray(folder?.garments) ? folder!.garments : []).map((g) => text(g, 100)).filter(Boolean).slice(0, 10),
    productInfo: text(folder?.productInfo, 300),
    etsy: normalizeFolderEtsy(folder?.etsy),
  };
}

/** Klasörün mağaza ayarlarını yedek ayarların üzerine uygular (klasörde boş olan alan yedekten kalır). */
export function mergeFolderEtsy<T extends Partial<PodTemplateEtsyListingSettings>>(base: T, folderEtsy: FolderEtsySettings | null | undefined): T {
  return { ...base, ...normalizeFolderEtsy(folderEtsy) };
}

/** İlan açmak için klasörde (ve yedeklerde) eksik zorunlu mağaza ayarları. */
export function missingFolderEtsy(etsy: Partial<PodTemplateEtsyListingSettings>): string[] {
  return [
    !etsy.shippingProfileId && 'kargo profili',
    !etsy.readinessStateId && 'hazırlık süresi',
  ].filter(Boolean) as string[];
}

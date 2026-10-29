/**
 * Kullanıcının ilan varsayılanları (Ayarlar sekmesi): Etsy mağaza ayarları ve varyasyonlar. Kategori ve
 * ürün tipi mağazanın tamamı için değil, mockup klasörünün otomasyonunda belirlenir.
 * Manuel üretimden açılan ilanlar bunlarla hazırlanır; otomasyon şablonunda eksik kalan Etsy ayarları ve
 * varyasyonlar da buradan tamamlanır. Saf modül (istemci ve sunucuda kullanılır).
 */
import type { PodTemplateEtsyListingSettings } from '@/types/templates';
import type { EtsyVariationRow } from '@/types/pod';

export type VariationDefaults = {
  sizes: string[];
  colors: string[];
  /** Beden fiyatı belirtilmemişse kullanılan fiyat */
  basePrice: number;
  /** Bedene özel fiyat (ör. 2XL daha pahalı) */
  sizePrices: Record<string, number>;
  quantity: number;
};

export type ListingDefaults = {
  etsy: PodTemplateEtsyListingSettings;
  variations: VariationDefaults;
};

export const DEFAULT_SIZES = ['S', 'M', 'L', 'XL', '2XL', '3XL'];
export const DEFAULT_COLORS = ['White', 'Black', 'Sand', 'Navy', 'Sport Grey'];

export const EMPTY_LISTING_DEFAULTS: ListingDefaults = {
  etsy: {
    shippingProfileId: '',
    readinessStateId: '',
    taxonomyId: 482,
    price: 24.99,
    whoMade: 'i_did',
    whenMade: 'made_to_order',
    shouldAutoRenew: false,
  },
  variations: { sizes: DEFAULT_SIZES, colors: DEFAULT_COLORS, basePrice: 24.99, sizePrices: { '2XL': 26.99, '3XL': 28.99 }, quantity: 999 },
};

/** Etsy, bir ilanda en fazla bu kadar varyasyon kombinasyonuna izin verir. */
export const MAX_VARIATION_COMBINATIONS = 400;

const cleanList = (values: unknown, max: number) =>
  Array.from(new Set((Array.isArray(values) ? values : []).map((v) => String(v ?? '').replace(/\s+/g, ' ').trim()).filter(Boolean))).slice(0, max);

const money = (value: unknown, fallback: number) => {
  const n = Math.round(Number(value) * 100) / 100;
  return Number.isFinite(n) && n >= 0.2 && n <= 50_000 ? n : fallback;
};

/** Eksik/bozuk alanları güvenli varsayılanlarla tamamlar. */
export function normalizeListingDefaults(input: unknown): ListingDefaults {
  const raw = (input && typeof input === 'object' ? input : {}) as Partial<ListingDefaults>;
  const base = EMPTY_LISTING_DEFAULTS;
  const etsy = { ...base.etsy, ...(raw.etsy ?? {}) } as PodTemplateEtsyListingSettings;
  const v = (raw.variations ?? {}) as Partial<VariationDefaults>;
  const sizes = raw.variations ? cleanList(v.sizes, 30) : base.variations.sizes;
  const colors = raw.variations ? cleanList(v.colors, 60) : base.variations.colors;
  const basePrice = money(v.basePrice, money(etsy.price, base.variations.basePrice));
  const sizePrices: Record<string, number> = {};
  for (const [size, price] of Object.entries(raw.variations ? v.sizePrices ?? {} : base.variations.sizePrices)) {
    if (sizes.includes(size)) sizePrices[size] = money(price, basePrice);
  }
  return {
    etsy: { ...etsy, price: money(etsy.price, basePrice), taxonomyId: Number(etsy.taxonomyId) || base.etsy.taxonomyId },
    variations: {
      sizes,
      colors,
      basePrice,
      sizePrices,
      quantity: Math.max(1, Math.min(999, Math.trunc(Number(v.quantity) || base.variations.quantity))),
    },
  };
}

/** Beden × renk kombinasyonlarından Etsy varyasyon satırları (beden fiyatı yoksa temel fiyat). */
export function variationRowsFromDefaults(variations: VariationDefaults): EtsyVariationRow[] {
  const rows: EtsyVariationRow[] = [];
  for (const size of variations.sizes) {
    for (const color of variations.colors) {
      if (rows.length >= MAX_VARIATION_COMBINATIONS) return rows;
      rows.push({
        id: `${size}-${color}`.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        size,
        color,
        price: variations.sizePrices[size] ?? variations.basePrice,
        quantity: variations.quantity,
        sku: '',
        enabled: true,
      });
    }
  }
  return rows;
}

/** İlan açmak için eksik zorunlu mağaza ayarları (kullanıcıya gösterilecek adlarla). */
export function missingListingSettings(defaults: ListingDefaults): string[] {
  return [
    !defaults.etsy.shippingProfileId && 'kargo profili',
    !defaults.etsy.readinessStateId && 'hazırlık süresi',
  ].filter(Boolean) as string[];
}

/**
 * Kayıtlı varyasyon şablonunu (beden × renk satırları) düzenleyici biçimine çevirir: temel fiyat en düşük
 * fiyat, bedene özel fiyat o bedenin ilk açık satırının fiyatıdır. Renge göre farklı fiyat varsa
 * `colorSpecificPrices` ile bildirilir (düzenleyici beden bazlı fiyat kullanır).
 */
export function variationDefaultsFromRows(rows: EtsyVariationRow[]): VariationDefaults & { colorSpecificPrices: boolean } {
  const sizes = Array.from(new Set(rows.map((r) => r.size).filter(Boolean)));
  const colors = Array.from(new Set(rows.map((r) => r.color).filter(Boolean)));
  const priced = rows.filter((r) => r.enabled !== false && Number(r.price) > 0);
  // Temel fiyat en düşük fiyattır (büyük bedenler genelde daha pahalıdır).
  const basePrice = priced.length > 0 ? Math.min(...priced.map((r) => Number(r.price))) : EMPTY_LISTING_DEFAULTS.variations.basePrice;
  const sizePrices: Record<string, number> = {};
  let colorSpecificPrices = false;
  for (const size of sizes) {
    const prices = new Set(priced.filter((r) => r.size === size).map((r) => Number(r.price)));
    if (prices.size > 1) colorSpecificPrices = true;
    const first = priced.find((r) => r.size === size);
    if (first && Number(first.price) !== basePrice) sizePrices[size] = Number(first.price);
  }
  const maxQuantity = Math.max(0, ...rows.map((r) => Math.trunc(Number(r.quantity) || 0)));
  const quantity = maxQuantity > 0 ? Math.min(999, maxQuantity) : EMPTY_LISTING_DEFAULTS.variations.quantity;
  return { sizes, colors, basePrice, sizePrices, quantity, colorSpecificPrices };
}

/**
 * Düzenleyicideki varyasyonları kayıtlı şablon satırlarına çevirir. Aynı beden/renk satırı önceki şablonda
 * varsa satışa kapalılık ve SKU bilgisi korunur.
 */
export function templateRowsFromDefaults(variations: VariationDefaults, previous: EtsyVariationRow[] = []): EtsyVariationRow[] {
  const byKey = new Map(previous.map((r) => [`${r.size}\u0000${r.color}`, r]));
  return variationRowsFromDefaults(variations).map((row) => {
    const old = byKey.get(`${row.size}\u0000${row.color}`);
    return old ? { ...row, id: old.id || row.id, enabled: old.enabled !== false, sku: old.sku ?? '' } : row;
  });
}

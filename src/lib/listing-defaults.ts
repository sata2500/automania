/**
 * Kullanıcının ilan varsayılanları (Ayarlar sekmesi): Etsy mağaza ayarları ve varyasyonlar. Kategori ve
 * ürün tipi mağazanın tamamı için değil, mockup klasörünün otomasyonunda belirlenir.
 * Manuel üretimden açılan ilanlar bunlarla hazırlanır; otomasyon şablonunda eksik kalan Etsy ayarları ve
 * varyasyonlar da buradan tamamlanır. Saf modül (istemci ve sunucuda kullanılır).
 */
import type { PodTemplateEtsyListingSettings } from '@/types/templates';
import type { EtsyVariationRow } from '@/types/pod';
import type { EtsyReadinessState } from '@/types/etsy';

export type VariationDefaults = {
  sizes: string[];
  colors: string[];
  /** Beden fiyatı belirtilmemişse kullanılan fiyat */
  basePrice: number;
  /** Bedene özel fiyat (ör. 2XL daha pahalı) */
  sizePrices: Record<string, number>;
  quantity: number;
};

/**
 * İlan metni bilgisi: yapay zekâ açıklamayı yazarken ürün bilgisi olarak yalnızca bunu kullanır (model ürün
 * özelliği uydurmaz). Kargo ücreti ve hazırlık süresi Etsy ayarlarından otomatik alınır; bakım talimatını
 * yapay zekâ ürün bilgisinden yazar.
 */
export type ListingCopySettings = {
  /** Baskı yapılan ürün: marka/model, kumaş, kalıp (ör. "Comfort Colors 1717, 100% ring-spun cotton, relaxed fit") */
  productInfo: string;
};

export type ListingDefaults = {
  etsy: PodTemplateEtsyListingSettings;
  variations: VariationDefaults;
  copy: ListingCopySettings;
};

export const EMPTY_LISTING_COPY: ListingCopySettings = { productInfo: '' };

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
  copy: EMPTY_LISTING_COPY,
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
    copy: normalizeListingCopy(raw.copy),
  };
}

const text = (value: unknown, max: number) => (typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '');

export function normalizeListingCopy(input: unknown): ListingCopySettings {
  const raw = (input && typeof input === 'object' ? input : {}) as Partial<ListingCopySettings>;
  return { productInfo: text(raw.productInfo, 300) };
}

/** Etsy hazırlık süresi tanımından açıklamaya yazılacak süre (ör. "Made to order, ships in 1-3 business days"). */
export function processingTimeText(state: Partial<EtsyReadinessState> | null | undefined): string | null {
  if (!state) return null;
  const min = Number(state.min_processing_time);
  const max = Number(state.max_processing_time);
  const unit = state.processing_time_unit === 'weeks' ? 'weeks' : 'business days';
  const range = min > 0 && max > 0 ? (min === max ? `${min}` : `${min}-${max}`) : max > 0 ? `${max}` : null;
  const label = range ? `${range} ${range === '1' ? unit.replace(/s$/, '') : unit}` : state.processing_days_display_label?.trim() || null;
  if (!label) return null;
  return state.readiness_state === 'ready_to_ship' ? `Ready to ship, ships in ${label}` : `Made to order, ships in ${label}`;
}

/**
 * Yapay zekâya verilecek mağaza bilgileri: ürün bilgisi (Ayarlar), kargo ücreti (kargo profilinden) ve hazırlık
 * süresi (Etsy'den). Bilinmeyenler yazılmaz; kargo durumu biliniyorsa açıkça belirtilir.
 */
export function listingCopyFacts(copy: ListingCopySettings, auto: { freeShipping?: boolean | null; processing?: string | null } = {}): string {
  const lines = [
    copy.productInfo && `Product (garment brand/model, fabric, fit): ${copy.productInfo}`,
    auto.processing && `Production & shipping time: ${auto.processing}`,
    auto.freeShipping === true ? 'Shipping: FREE shipping (mention it in the description)' : auto.freeShipping === false ? 'Shipping: shipping is NOT free (do not claim free shipping)' : '',
  ].filter(Boolean);
  return lines.length > 0 ? lines.join('\n') : 'None provided';
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

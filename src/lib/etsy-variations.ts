/**
 * Toplu envanter (varyasyon) güncellemesi için doğrulama ve Etsy ürün yükü üretimi.
 */

export type VariationInput = {
  size?: string;
  color?: string;
  sku?: string;
  price?: number | string;
  quantity?: number | string;
  enabled?: boolean;
};

/** Canlı ilanların envanterini değiştirmeden önce kullanıcının yazması gereken onay ifadesi. */
export const BULK_INVENTORY_CONFIRMATION = 'UYGULA';

/** Etsy'nin kabul ettiği en düşük fiyat (USD). */
export const MIN_ETSY_PRICE = 0.2;
export const MAX_ETSY_QUANTITY = 999;

const SIZE_PROPERTY_ID = 513;
const COLOR_PROPERTY_ID = 514;

export type EtsyInventoryProduct = {
  sku?: string;
  property_values: Array<{ property_id: number; property_name: string; values: string[] }>;
  offerings: Array<{ price: number; quantity: number; is_enabled: boolean }>;
};

type ValidationResult =
  | { ok: true; products: EtsyInventoryProduct[]; usedProperties: number[]; hasSku: boolean }
  | { ok: false; error: string };

/**
 * Varyasyonları doğrular. Eksik/geçersiz fiyat veya stok sessizce 0'a çevrilmez (Etsy reddeder ya da
 * ürün 0 fiyat/stokla görünür); bunun yerine hangi satırın hatalı olduğu bildirilir.
 */
export function validateBulkVariations(variations: unknown): ValidationResult {
  if (!Array.isArray(variations) || variations.length === 0) {
    return { ok: false, error: 'Uygulanacak varyasyonlar eksik.' };
  }

  const rows = variations as VariationInput[];
  const hasSize = rows.some((v) => v.size && v.size !== 'N/A');
  const hasColor = rows.some((v) => v.color && v.color !== 'N/A');
  const usedProperties = [
    ...(hasSize ? [SIZE_PROPERTY_ID] : []),
    ...(hasColor ? [COLOR_PROPERTY_ID] : []),
  ];

  if (!rows.some((v) => v.enabled !== false)) {
    return { ok: false, error: 'En az bir varyasyon satışa açık (etkin) olmalıdır.' };
  }

  const problems: string[] = [];
  const products = rows.map((v, index) => {
    const label = [v.size, v.color].filter((part) => part && part !== 'N/A').join(' / ') || `Satır ${index + 1}`;
    const price = Number(v.price);
    const quantity = Number(v.quantity);
    if (!Number.isFinite(price) || price < MIN_ETSY_PRICE) problems.push(`${label}: fiyat en az ${MIN_ETSY_PRICE} olmalı`);
    if (!Number.isInteger(quantity) || quantity < 0 || quantity > MAX_ETSY_QUANTITY) problems.push(`${label}: stok 0-${MAX_ETSY_QUANTITY} arasında bir tam sayı olmalı`);

    const propertyValues: EtsyInventoryProduct['property_values'] = [];
    if (hasSize) propertyValues.push({ property_id: SIZE_PROPERTY_ID, property_name: 'Size', values: [v.size && v.size !== 'N/A' ? v.size : 'One Size'] });
    if (hasColor) propertyValues.push({ property_id: COLOR_PROPERTY_ID, property_name: 'Color', values: [v.color && v.color !== 'N/A' ? v.color : 'Default'] });

    return {
      ...(v.sku ? { sku: String(v.sku) } : {}),
      property_values: propertyValues,
      offerings: [{ price, quantity, is_enabled: v.enabled !== false }],
    };
  });

  if (problems.length > 0) {
    const shown = problems.slice(0, 5).join('; ');
    return { ok: false, error: `Geçersiz varyasyonlar: ${shown}${problems.length > 5 ? ` (+${problems.length - 5} daha)` : ''}.` };
  }

  return { ok: true, products, usedProperties, hasSku: rows.some((v) => Boolean(v.sku)) };
}

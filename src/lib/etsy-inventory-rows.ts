/**
 * Etsy ilan envanterini (GET /listings/{id}/inventory) varyasyon şablonu satırlarına çevirir. Beden ve renk
 * özellikleri adlarından tanınır (Size / Color, Primary color…); tanınmazsa ilk özellik beden, ikincisi renk
 * sütununa yazılır. Silinmiş ürünler atlanır, aynı beden/renk iki kez eklenmez. Saf modül.
 */
import type { EtsyVariationRow } from '@/types/pod';

type InventoryValue = { property_id?: number; property_name?: string; values?: string[] };
type InventoryOffering = { price?: { amount?: number; divisor?: number } | number; quantity?: number; is_enabled?: boolean; is_deleted?: boolean };
type InventoryProduct = { is_deleted?: boolean; sku?: string; property_values?: InventoryValue[]; offerings?: InventoryOffering[] };

const SIZE_NAME = /size|beden|boyut/i;
const COLOR_NAME = /colou?r|renk/i;

function offeringPrice(offering: InventoryOffering | undefined): number {
  const price = offering?.price;
  if (typeof price === 'number') return price;
  if (price && typeof price.amount === 'number') return price.amount / (price.divisor || 100);
  return 0;
}

export function rowsFromEtsyInventory(inventory: unknown): EtsyVariationRow[] {
  const products = ((inventory as { products?: InventoryProduct[] } | null)?.products ?? []).filter((p) => !p.is_deleted);
  const rows: EtsyVariationRow[] = [];
  const seen = new Set<string>();
  for (const product of products) {
    const values = product.property_values ?? [];
    const sizeProp = values.find((v) => SIZE_NAME.test(v.property_name ?? ''));
    const colorProp = values.find((v) => v !== sizeProp && COLOR_NAME.test(v.property_name ?? ''));
    const others = values.filter((v) => v !== sizeProp && v !== colorProp);
    const size = (sizeProp ?? others.shift())?.values?.[0]?.trim() ?? '';
    const color = (colorProp ?? others.shift())?.values?.[0]?.trim() ?? '';
    const key = `${size}\u0000${color}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const offering = (product.offerings ?? []).find((o) => !o.is_deleted) ?? product.offerings?.[0];
    rows.push({
      id: `${size}-${color}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `row-${rows.length + 1}`,
      size,
      color,
      price: Math.round(offeringPrice(offering) * 100) / 100,
      quantity: Math.max(0, Math.min(999, Math.trunc(offering?.quantity ?? 999))),
      sku: '',
      enabled: offering?.is_enabled !== false,
    });
  }
  return rows;
}

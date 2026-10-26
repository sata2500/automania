/**
 * Etsy kategori özellikleri ("All attributes": kol boyu, yaka, malzeme özelliği, giyim stili, vesile,
 * tatil, grafik…): Etsy'den çekilir, yapay zekâya seçenekleriyle verilir ve seçilen değerler doğrulanıp
 * ilana yazılır.
 */
import { etsyFetch } from '@/lib/etsy-api';

export type EtsyTaxonomyProperty = {
  property_id: number;
  name: string;
  display_name?: string;
  scales?: unknown[];
  supports_attributes?: boolean;
  is_multivalued?: boolean;
  max_values_allowed?: number | null;
  possible_values?: Array<{ value_id: number; name: string }>;
};

/**
 * Varyasyonlarla (beden × renk) yönetilen özellikler yapay zekâya verilmez: ilan tüm renk ve
 * bedenlerde satıldığı için tek bir değer seçmek alıcı filtrelerinde yanıltıcı olur.
 */
const VARIATION_PROPERTY = /^(size|color|primary color|secondary color|unisex shirt size|clothing size|women's clothing size|men's clothing size|children's clothing size|baby clothing size)$/i;

export async function fetchTaxonomyProperties(
  credentials: { apiKey: string; sharedSecret?: string; accessToken: string },
  taxonomyId: number,
): Promise<EtsyTaxonomyProperty[]> {
  const res = await etsyFetch(`https://openapi.etsy.com/v3/application/seller-taxonomy/nodes/${taxonomyId}/properties`, {
    headers: {
      'x-api-key': `${credentials.apiKey}:${credentials.sharedSecret || ''}`,
      Authorization: `Bearer ${credentials.accessToken}`,
    },
  });
  if (!res.ok) throw new Error(`Etsy kategori özellikleri alınamadı (HTTP ${res.status}).`);
  const data = await res.json() as { results?: EtsyTaxonomyProperty[] };
  return Array.isArray(data.results) ? data.results : [];
}

/** Yapay zekânın doldurabileceği özellikler: değer listesi olan, ölçek gerektirmeyen, varyasyon dışı. */
export function selectableTaxonomyProperties(properties: EtsyTaxonomyProperty[]): EtsyTaxonomyProperty[] {
  return properties.filter((p) =>
    p.supports_attributes !== false
    && (p.possible_values?.length ?? 0) > 0
    && (p.scales?.length ?? 0) === 0
    && !VARIATION_PROPERTY.test((p.display_name || p.name || '').trim()));
}

/**
 * Yapay zekânın `taxonomy_properties_values` yanıtını doğrular: yalnızca bu kategoride var olan
 * özellik ve değer kimlikleri kalır; tek değerli özelliklere bir değer, çok değerlilere en fazla
 * izin verilen sayıda değer yazılır. Sonuç `{ property_id: [value_id, …] }`.
 */
export function validateTaxonomyPropertyValues(raw: unknown, properties: EtsyTaxonomyProperty[]): Record<string, number[]> {
  const byId = new Map(properties.map((p) => [p.property_id, p]));
  const entries: Array<{ property_id?: unknown; value_ids?: unknown }> = Array.isArray(raw)
    ? raw
    : raw && typeof raw === 'object'
      ? Object.entries(raw as Record<string, unknown>).map(([property_id, value_ids]) => ({ property_id, value_ids }))
      : [];
  const result: Record<string, number[]> = {};
  for (const entry of entries) {
    const property = byId.get(Number(entry.property_id));
    if (!property) continue;
    const allowed = new Set((property.possible_values ?? []).map((v) => v.value_id));
    const ids = (Array.isArray(entry.value_ids) ? entry.value_ids : [entry.value_ids])
      .map(Number)
      .filter((id, i, all) => allowed.has(id) && all.indexOf(id) === i);
    const limit = property.is_multivalued ? Math.max(1, property.max_values_allowed ?? ids.length) : 1;
    if (ids.length > 0) result[String(property.property_id)] = ids.slice(0, limit);
  }
  return result;
}

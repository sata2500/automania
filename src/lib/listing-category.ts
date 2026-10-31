/**
 * İlanın Etsy kategorisi: ürünü tasarım değil mockup'lar belirler (aynı ilanda tişört, sweatshirt ve hoodie
 * olabilir). Görsel modeli ilanın mockup fotoğraflarına bakıp admin panelinde aktif kategorilerden ilana en
 * uygun tek kategoriyi seçer. Tek aktif kategori varsa yapay zekâya sorulmaz.
 */
import sql from '@/lib/db';
import { generateVisionJson, type AiImage } from '@/lib/ai-text';
import { loadImageForUser } from '@/lib/media-source';
import type { EtsyVariationRow, EtsyVariationTemplate, FolderEtsySettings, MockupFolder } from '@/types/pod';
import type { AudienceGroup } from '@/types/templates';
import { folderListingFields } from '@/lib/folder-listing';

export type ListingCategory = { taxonomyId: number; name: string; productType: string };

type CategoryRow = { id: number; name: string; path: string | null };

/** En fazla bu kadar mockup gönderilir (karışık ilanlarda farklı ürünler görünsün diye sıradan eşit aralıkla). */
const MAX_PHOTOS = 4;

/** Fotoğraf listesinden eşit aralıklı en fazla `max` öğe (sıra korunur). */
export function spreadPick<T>(items: T[], max: number): T[] {
  if (items.length <= max) return items;
  const step = items.length / max;
  return Array.from({ length: max }, (_, i) => items[Math.floor(i * step)]!);
}

export function buildCategoryPrompt(categories: CategoryRow[]): string {
  return `You are an Etsy catalog expert. The attached photos are the mockups of ONE Etsy listing (product photos with a printed design).
Look at the garments/products in the photos (ignore the printed artwork itself) and choose the single Etsy category that fits this listing best.
If the photos show different product types (e.g. sweatshirts and hoodies), choose the category that covers them together, otherwise the one that most photos show.

Choose taxonomyId ONLY from this list:
${categories.map((c) => `- ID: ${c.id} (${c.name}${c.path ? `, ${c.path}` : ''})`).join('\n')}

Return ONLY a JSON object: {"taxonomyId": 482, "productType": "short product name in English, e.g. T-shirt, Sweatshirt, Hoodie, Sweatshirt & Hoodie"}`;
}

/** Model yanıtını doğrular: yalnızca listedeki kategori kabul edilir. Saf fonksiyon. */
export function parseCategoryAnswer(data: unknown, categories: CategoryRow[]): ListingCategory | null {
  const raw = (data && typeof data === 'object' ? data : {}) as { taxonomyId?: unknown; productType?: unknown };
  const category = categories.find((c) => c.id === Number(raw.taxonomyId));
  if (!category) return null;
  const productType = typeof raw.productType === 'string' && raw.productType.trim() ? raw.productType.trim().slice(0, 60) : category.name;
  return { taxonomyId: category.id, name: category.name, productType };
}

async function thumbnail(userId: string, url: string): Promise<AiImage | null> {
  try {
    const source = await loadImageForUser(userId, url);
    const sharp = (await import('sharp')).default;
    return { buffer: await sharp(source).resize(768, 768, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 80 }).toBuffer(), mimeType: 'image/jpeg' };
  } catch {
    return null;
  }
}

/**
 * İlanın kategorisi mockup fotoğraflarından. `photos`: ilandaki ürün fotoğrafları (bilgi görselleri hariç).
 * Aktif kategori yoksa, fotoğraf okunamazsa veya model listede olmayan bir şey derse null (çağıran varsayılanı kullanır).
 */
export async function pickListingCategory(userId: string, photos: string[]): Promise<ListingCategory | null> {
  const categories = await sql`SELECT id, name, path FROM etsy_taxonomy_cache WHERE is_active = true ORDER BY id`
    .then((rows) => rows.map((r) => ({ id: Number(r.id), name: String(r.name), path: r.path ? String(r.path) : null })))
    .catch(() => [] as CategoryRow[]);
  if (categories.length === 0) return null;
  if (categories.length === 1) return { taxonomyId: categories[0]!.id, name: categories[0]!.name, productType: categories[0]!.name };
  const images = (await Promise.all(spreadPick(photos, MAX_PHOTOS).map((url) => thumbnail(userId, url)))).filter((i): i is AiImage => i !== null);
  if (images.length === 0) return null;
  const { data } = await generateVisionJson(buildCategoryPrompt(categories), images, { label: 'listing category', temperature: 0, maxOutputTokens: 1024 });
  return parseCategoryAnswer(data, categories);
}

export type FolderListingSettings = {
  category: { taxonomyId: number; name: string } | null;
  /** Klasörün varsayılan varyasyon şablonu (güncel satırlarıyla); seçili değilse veya şablon silindiyse null */
  variations: { templateId: string; templateName: string; rows: EtsyVariationRow[] } | null;
  audienceGroup?: AudienceGroup;
  garments: string[];
  productInfo: string;
  /** Klasörün Etsy mağaza ayarları (boş alanlar yazılmaz; yedek ayar kullanılır) */
  etsy: FolderEtsySettings;
};

/**
 * Mockup klasörünün ilan ayarları (Mockup'lar › klasör menüsü › Klasör ayarları): ürün kategorisi, varsayılan
 * varyasyon şablonu, kitle, ürün modelleri, ürün bilgisi ve Etsy mağaza ayarları. Klasör = bir Etsy ilanı;
 * manuel ilanlar ve otomasyonlar bunları kullanır.
 */
export async function loadFolderListingSettings(userId: string, folderId: string | null | undefined): Promise<FolderListingSettings> {
  const empty: FolderListingSettings = { category: null, variations: null, garments: [], productInfo: '', etsy: {} };
  if (!folderId) return empty;
  const rows = await sql`
    SELECT f AS folder, etsy_variation_templates AS templates
    FROM user_workspaces, jsonb_array_elements(COALESCE(folders, '[]'::jsonb)) AS f
    WHERE user_id = ${userId} AND f->>'id' = ${folderId}
    LIMIT 1
  `.catch(() => []);
  const folder = (rows[0]?.folder ?? null) as MockupFolder | null;
  if (!folder) return empty;
  const taxonomyId = Number(folder.taxonomyId);
  const templates = (Array.isArray(rows[0]?.templates) ? rows[0]!.templates : []) as EtsyVariationTemplate[];
  const template = folder.variationTemplateId ? templates.find((t) => t.id === folder.variationTemplateId) : undefined;
  return {
    category: Number.isInteger(taxonomyId) && taxonomyId > 0 ? { taxonomyId, name: String(folder.categoryName || '') } : null,
    variations: template?.variations?.length ? { templateId: template.id, templateName: template.name, rows: template.variations } : null,
    ...folderListingFields(folder),
  };
}

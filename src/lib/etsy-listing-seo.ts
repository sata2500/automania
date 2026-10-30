/**
 * Etsy'deki (yayında/taslak) ilanların SEO işlemleri, iki adım:
 *  1. "Analiz et": kapak görseli yapay zekâyla analiz edilir, etiketler Etsy'den puanlanır (kelime havuzu) ve
 *     metin yapay zekâyla değerlendirilir; tam SEO puanı (kurallar + Etsy verisi + yapay zekâ) yazılır.
 *  2. "Yapay zekâ ile iyileştir" (yalnızca analiz edilmiş ilanda): yeni ilanlarla aynı üretim akışı, önce/sonra
 *     puanıyla öneri. Etsy'ye hiçbir şey kendiliğinden gönderilmez; öneri kullanıcı onayıyla gönderilir.
 */
import sql, { type DbRow } from '@/lib/db';
import { analyzeDesignImage } from '@/lib/design-vision';
import { loadVisionImage } from '@/lib/media-source';
import { evaluateEtsyListingSeo, storedAiReview, type ListingAiReview, type SeoEvaluationResult, type VisionAnalysisData } from '@/lib/etsy-seo-evaluator';
import { reviewListingWithAi } from '@/lib/listing-ai-review';
import { generateBestListing, poolRowsForTags } from '@/lib/listing-pipeline';
import { loadStoreCopyFacts } from '@/lib/listing-copy';
import { loadScraperCredentials } from '@/lib/scraper-credentials';
import { KEYWORD_MAX_SCORE_AGE_DAYS } from '@/lib/keyword-pool';

export function parseListingTags(row: DbRow): string[] {
  const tags = Array.isArray(row.tags) ? row.tags : typeof row.tags === 'string' ? JSON.parse(row.tags) : [];
  return (tags as unknown[]).map((t) => String(t).trim()).filter(Boolean);
}

function parseJson<T>(value: unknown, fallback: T): T {
  if (!value) return fallback;
  if (typeof value === 'string') {
    try { return JSON.parse(value) as T; } catch { return fallback; }
  }
  return value as T;
}

function listingImageUrl(row: DbRow): string | null {
  const images = Array.isArray(row.images) ? row.images as Array<Record<string, string>> : [];
  return row.primary_image_url || images[0]?.url_570xN || images[0]?.url_fullxfull || images[0]?.url_170x135 || null;
}

async function scrapeOptions(userId: string) {
  const c = await loadScraperCredentials(userId).catch(() => null);
  return {
    etsyAccessToken: c?.etsyAccessToken, etsyApiKey: c?.etsyApiKey, etsySharedSecret: c?.etsySharedSecret,
    userId, apiKey: c?.scrapingApiKey, provider: c?.scrapingProvider, workerUrl: c?.workerUrl,
  };
}

/** Kapak görselini yapay zekâyla analiz eder (tasarım analiziyle aynı talimat) ve satıra yazar. */
export async function analyzeListingVision(userId: string, row: DbRow): Promise<VisionAnalysisData> {
  const imageUrl = listingImageUrl(row);
  if (!imageUrl) throw new Error('Kapak görseli bulunamadı.');
  const vision = await analyzeDesignImage(await loadVisionImage(userId, String(imageUrl)));
  const data: VisionAnalysisData = {
    primarySubject: vision.primarySubject,
    primaryAesthetic: vision.primaryAesthetic,
    productType: vision.productType,
    description: vision.description,
    keywords: vision.keywords,
    analyzedAt: new Date().toISOString(),
  };
  await sql`UPDATE user_etsy_listings SET vision_analysis = ${JSON.stringify(data)}::jsonb, updated_at = CURRENT_TIMESTAMP WHERE user_id = ${userId} AND listing_id = ${String(row.listing_id)}`;
  return data;
}

/** Kayıtlı görsel analizi; yoksa analiz edilir. */
export async function ensureListingVision(userId: string, row: DbRow): Promise<VisionAnalysisData> {
  const stored = parseJson<VisionAnalysisData>(row.vision_analysis, {});
  return stored.description || stored.primarySubject ? stored : analyzeListingVision(userId, row);
}

const designContext = (vision: VisionAnalysisData) => ({
  description: vision.description ?? null,
  primarySubject: vision.primarySubject ?? null,
  primaryAesthetic: vision.primaryAesthetic ?? null,
  productType: vision.productType ?? null,
});

/** Mevcut metnin puanı (kayıtlı yapay zekâ incelemeleri metne uyuyorsa kullanılır) ve satıra yazılması. */
export async function reevaluateListing(
  userId: string,
  row: DbRow,
  extra: Partial<Pick<SeoEvaluationResult, 'aiReview'>> & { improvement?: unknown; scoringBudgetMs?: number } = {},
): Promise<SeoEvaluationResult> {
  const tags = parseListingTags(row);
  const poolRows = await poolRowsForTags(tags, await scrapeOptions(userId), extra.scoringBudgetMs ?? 0);
  const previous = parseJson<Record<string, unknown>>(row.seo_evaluation, {});
  const evaluation = evaluateEtsyListingSeo({
    title: row.title, description: row.description, tags, keywordPoolRows: poolRows,
    aiReview: [extra.aiReview ?? null, ...storedAiReview(previous)],
  });
  const improvement = 'improvement' in extra ? extra.improvement : previous.improvement;
  const stored = { ...evaluation, ...(improvement ? { improvement } : {}) };
  await sql`
    UPDATE user_etsy_listings SET seo_score = ${evaluation.score}, seo_evaluation = ${JSON.stringify(stored)}::jsonb, updated_at = CURRENT_TIMESTAMP
    WHERE user_id = ${userId} AND listing_id = ${String(row.listing_id)}
  `;
  return stored as SeoEvaluationResult;
}

/** Mevcut metnin incelemesi yapıldı mı (iyileştirme için önce analiz gerekir). */
export function isListingAnalyzed(row: DbRow): boolean {
  const evaluation = parseJson<{ aiReview?: { textHash?: string } | null; confidence?: { aiReviewed?: boolean } }>(row.seo_evaluation, {});
  return Boolean(evaluation.confidence?.aiReviewed && evaluation.aiReview);
}

/**
 * "Analiz et": görsel analizi (yoksa veya `refreshVision` ise), etiketlerin Etsy'den puanlanması ve yapay zekâ
 * değerlendirmesi; tam SEO puanı satıra yazılır.
 */
export async function analyzeEtsyListing(userId: string, row: DbRow, { refreshVision = false } = {}): Promise<{ evaluation: SeoEvaluationResult; vision: VisionAnalysisData }> {
  const vision = refreshVision ? await analyzeListingVision(userId, row) : await ensureListingVision(userId, row);
  const storeFacts = await loadStoreCopyFacts(userId).catch(() => 'None provided');
  const aiReview = await reviewListingWithAi({
    title: String(row.title || ''), tags: parseListingTags(row), description: String(row.description || ''),
    design: designContext(vision), storeFacts,
  });
  const evaluation = await reevaluateListing(userId, { ...row, vision_analysis: vision }, { aiReview, scoringBudgetMs: 25_000 });
  return { evaluation, vision };
}

export type ListingImprovement = {
  title: string;
  tags: string[];
  description: string;
  evaluation: SeoEvaluationResult;
  aiReview: ListingAiReview | null;
  createdAt: string;
};

/** İlanla ilgili havuz kelimeleri (görsel analizindeki konu ve stil kelimeleriyle eşleşen güncel, puanlı). */
async function relatedPoolKeywords(words: string[]): Promise<string[]> {
  const terms = Array.from(new Set(words.flatMap((w) => w.toLowerCase().split(/[^a-z0-9]+/)).filter((w) => w.length >= 4))).slice(0, 8);
  if (terms.length === 0) return [];
  const rows = await sql`
    SELECT keyword FROM keyword_pool
    WHERE opportunity_score >= 55 AND char_length(keyword) <= 20
      AND last_evaluated_at > NOW() - make_interval(days => ${KEYWORD_MAX_SCORE_AGE_DAYS}::int)
      AND keyword ~* ${`\\m(${terms.join('|')})\\M`}
    ORDER BY opportunity_score DESC LIMIT 25
  `.catch(() => []);
  return rows.map((r) => String(r.keyword));
}

/**
 * "Yapay zekâ ile iyileştir": yeni ilanlarla aynı akış (yaz → Etsy'den puanla → değerlendir → gerekirse düzelt).
 * Öneri ve önce/sonra puanı satıra kaydedilir; Etsy'ye gönderim kullanıcı onayıyla yapılır.
 */
export async function improveEtsyListing(userId: string, row: DbRow): Promise<{ before: SeoEvaluationResult; improvement: ListingImprovement }> {
  const vision = await ensureListingVision(userId, row);
  const tags = parseListingTags(row);
  const storeFacts = await loadStoreCopyFacts(userId).catch(() => 'None provided');
  const related = await relatedPoolKeywords([vision.primarySubject ?? '', vision.primaryAesthetic ?? '', ...(vision.keywords ?? []).slice(0, 5)]);
  const keywords = Array.from(new Set([...(vision.keywords ?? []), ...tags, ...related].map((k) => k.toLowerCase().trim()).filter(Boolean))).slice(0, 45);
  const result = await generateBestListing(userId, {
    designDescription: vision.description || String(row.title || ''),
    keywords,
    productType: vision.productType || undefined,
    primarySubject: vision.primarySubject || undefined,
    primaryAesthetic: vision.primaryAesthetic || undefined,
    taxonomyId: Number(row.taxonomy_id) || undefined,
    currentListing: { title: String(row.title || ''), tags, description: String(row.description || '') },
    design: designContext(vision),
    storeFacts,
  });
  const improvement: ListingImprovement = {
    title: result.listing.title,
    tags: result.listing.selectedTags,
    description: result.listing.description,
    evaluation: result.evaluation,
    aiReview: result.aiReview,
    createdAt: new Date().toISOString(),
  };
  await sql`
    UPDATE user_etsy_listings SET
      ai_optimized_title = ${improvement.title},
      ai_optimized_tags = ${JSON.stringify(improvement.tags)}::jsonb,
      ai_optimized_description = ${improvement.description},
      ai_optimized_at = CURRENT_TIMESTAMP
    WHERE user_id = ${userId} AND listing_id = ${String(row.listing_id)}
  `;
  const before = await reevaluateListing(userId, row, { improvement });
  return { before, improvement };
}

/**
 * İlan metninin "en iyi hâli": yapay zekâ metni yazar, yeni etiketler Etsy'den puanlanır (kelime havuzu), metin
 * yapay zekâyla değerlendirilir ve SEO puanı (v2) hesaplanır. Puan hedefin altındaysa kurallar, Etsy verisi ve
 * yapay zekâ değerlendirmesinden çıkan geri bildirimle bir kez daha yazdırılır; iki taslaktan puanı yüksek olan
 * seçilir. Otomasyon, Üretim'den gelen ilanlar ve Etsy'deki ilanların iyileştirmesi aynı akışı kullanır.
 */
import sql from '@/lib/db';
import { generateListingContent, type GenerateListingInput } from '@/lib/listing-generator';
import { reviewListingWithAi, type ReviewDesignContext } from '@/lib/listing-ai-review';
import { evaluateEtsyListingSeo, type KeywordPoolInputRow, type ListingAiReview, type SeoEvaluationResult } from '@/lib/etsy-seo-evaluator';
import { normalizeKeywords, scoreKeywords } from '@/lib/keyword-pool';
import { loadScraperCredentials } from '@/lib/scraper-credentials';
import type { ScrapingOptions } from '@/lib/etsy-scraper';

/** Bu puanın altındaki ilk taslak geri bildirimle yeniden yazılır. */
export const TARGET_SEO_SCORE = 85;

export type BestListingResult = Awaited<ReturnType<typeof generateListingContent>> & {
  evaluation: SeoEvaluationResult;
  aiReview: ListingAiReview | null;
  /** Kaç taslak yazıldı (1 veya 2) */
  attempts: number;
};

async function scrapeOptionsFor(userId: string): Promise<ScrapingOptions> {
  const credentials = await loadScraperCredentials(userId).catch(() => null);
  return {
    etsyAccessToken: credentials?.etsyAccessToken,
    etsyApiKey: credentials?.etsyApiKey,
    etsySharedSecret: credentials?.etsySharedSecret,
    userId,
    apiKey: credentials?.scrapingApiKey,
    provider: credentials?.scrapingProvider,
    workerUrl: credentials?.workerUrl,
  };
}

/**
 * Etiketlerin havuz satırları: güncel puanı olmayanlar süre bütçesi içinde Etsy'den puanlanır (sığmayanlar
 * havuzda "Taranacak" olarak bekler ve puana katılmaz).
 */
export async function poolRowsForTags(tags: string[], options: ScrapingOptions, budgetMs: number): Promise<KeywordPoolInputRow[]> {
  const keywords = normalizeKeywords(tags);
  if (keywords.length === 0) return [];
  if (budgetMs > 0) {
    await scoreKeywords(keywords, options, { budgetMs, countUsage: false })
      .catch((error: unknown) => console.warn('[Listing pipeline] Tag scoring failed', error instanceof Error ? error.message : error));
  }
  return await sql`
    SELECT keyword, opportunity_score, etsy_score, total_listings, competition_level, bestseller_count, is_etsy_suggested, last_evaluated_at
    FROM keyword_pool WHERE keyword = ANY(${keywords})
  ` as KeywordPoolInputRow[];
}

/** Değerlendirmeden yapay zekâya verilecek düzeltme listesi (ipuçları dahil, en önemliler önce). */
export function revisionFeedbackFrom(evaluation: SeoEvaluationResult): string[] {
  const order = { critical: 0, warning: 1, tip: 2 } as const;
  const feedback = [...evaluation.issues]
    .sort((a, b) => order[a.severity] - order[b.severity])
    .map((issue) => `${issue.field.toUpperCase()}: ${issue.message}${issue.fixSuggestion ? ` (${issue.fixSuggestion})` : ''}`);
  const weakTags = evaluation.tagBreakdown.filter((t) => t.status === 'poor').map((t) => t.keyword);
  if (weakTags.length > 0) feedback.push(`TAGS: these tags have low Etsy opportunity scores, replace them with stronger relevant phrases from the keyword list: ${weakTags.join(', ')}`);
  if (evaluation.missingPoolKeywords.length > 0) {
    feedback.push(`TAGS: high-scoring relevant phrases not used yet (use them if they fit this design): ${evaluation.missingPoolKeywords.slice(0, 6).map((k) => `${k.keyword} (${k.opportunityScore})`).join(', ')}`);
  }
  if (evaluation.aiReview?.notes.overall) feedback.push(`OVERALL: ${evaluation.aiReview.notes.overall}`);
  return feedback.slice(0, 14);
}

async function draft(
  userId: string,
  input: GenerateListingInput,
  design: ReviewDesignContext,
  storeFacts: string,
  scrape: ScrapingOptions,
  scoringBudgetMs: number,
) {
  const result = await generateListingContent(userId, { ...input, storeFacts });
  const { title, description, selectedTags: tags } = result.listing;
  const [poolRows, aiReview] = await Promise.all([
    poolRowsForTags(tags, scrape, scoringBudgetMs),
    reviewListingWithAi({ title, tags, description, design, storeFacts })
      .catch((error: unknown) => { console.warn('[Listing pipeline] AI review failed', error instanceof Error ? error.message : error); return null; }),
  ]);
  const evaluation = evaluateEtsyListingSeo({ title, description, tags, keywordPoolRows: poolRows, aiReview });
  return { ...result, evaluation, aiReview };
}

export async function generateBestListing(
  userId: string,
  input: GenerateListingInput & { design: ReviewDesignContext; storeFacts: string },
  { scoringBudgetMs = 25_000, revise = true }: { scoringBudgetMs?: number; revise?: boolean } = {},
): Promise<BestListingResult> {
  const { design, storeFacts, ...generatorInput } = input;
  const scrape = await scrapeOptionsFor(userId);
  const first = await draft(userId, generatorInput, design, storeFacts, scrape, scoringBudgetMs);
  if (!revise || first.evaluation.score >= TARGET_SEO_SCORE) return { ...first, attempts: 1 };

  try {
    const second = await draft(userId, {
      ...generatorInput,
      revisionFeedback: revisionFeedbackFrom(first.evaluation),
      currentListing: { title: first.listing.title, tags: first.listing.selectedTags, description: first.listing.description },
    }, design, storeFacts, scrape, Math.round(scoringBudgetMs / 2));
    const best = second.evaluation.score > first.evaluation.score ? second : first;
    return { ...best, attempts: 2 };
  } catch (error) {
    console.warn('[Listing pipeline] Revision failed; keeping the first draft', error instanceof Error ? error.message : error);
    return { ...first, attempts: 1 };
  }
}

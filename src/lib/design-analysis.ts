/**
 * Tasarım analizi: görsel yapay zekâ (konu, stil, açıklama, kelimeler) + kelimelerin Etsy puanları
 * (bkz. keyword-pool). /api/designs/analyze hem yanıtta (misafir, kaydedilmemiş tasarım) hem arka planda
 * (giriş yapılmış, sonuç tasarıma yazılır) bu akışı kullanır.
 */
import { loadVisionImage } from '@/lib/media-source';
import { analyzeDesignImage } from '@/lib/design-vision';
import { normalizeKeywords, scoreKeywords } from '@/lib/keyword-pool';
import { loadScraperCredentials } from '@/lib/scraper-credentials';
import { filterSafeKeywords } from '@/lib/trademark-shield';
import type { ScrapingOptions } from '@/lib/etsy-scraper';
import type { DesignItem } from '@/types/pod';

export type DesignAnalysis = NonNullable<DesignItem['analysis']> & { trademarkRemovedKeywords: string[] };

export type DesignAnalysisResult = {
  analysis: DesignAnalysis;
  hasEtsyApi: boolean;
  /** Süre bütçesine sığmayıp sonradan puanlanacak kelimeler */
  pendingKeywords: string[];
  scrapeOptions: ScrapingOptions;
};

export async function runDesignAnalysis(
  userId: string | null,
  src: string,
  options: { appOrigin: string; scoringBudgetMs: number },
): Promise<DesignAnalysisResult> {
  const image = await loadVisionImage(userId, src, { appOrigin: options.appOrigin });
  const [vision, credentials] = await Promise.all([
    analyzeDesignImage(image),
    loadScraperCredentials(userId).catch(() => null),
  ]);
  const scrapeOptions: ScrapingOptions = {
    etsyAccessToken: credentials?.etsyAccessToken,
    etsyApiKey: credentials?.etsyApiKey,
    etsySharedSecret: credentials?.etsySharedSecret,
    userId: userId ?? undefined,
    apiKey: credentials?.scrapingApiKey,
    provider: credentials?.scrapingProvider,
    workerUrl: credentials?.workerUrl,
  };

  const trademarkRemoved = filterSafeKeywords(vision.keywords.map((k) => k.toLowerCase().trim())).removed.map((r) => r.keyword);
  const keywords = normalizeKeywords(vision.keywords);
  const scored = await scoreKeywords(keywords, scrapeOptions, { budgetMs: options.scoringBudgetMs });
  return {
    hasEtsyApi: Boolean(credentials?.etsyAccessToken),
    pendingKeywords: scored.pending,
    scrapeOptions,
    analysis: {
      description: vision.description,
      keywords,
      evaluatedKeywords: scored.evaluated,
      discoveredCompetitorTags: scored.competitorTags,
      analyzedAt: Date.now(),
      primarySubject: vision.primarySubject,
      primaryAesthetic: vision.primaryAesthetic,
      niche: vision.niche,
      userNotes: vision.userNotes,
      productType: vision.productType,
      taxonomyId: vision.taxonomyId,
      trademarkRemovedKeywords: trademarkRemoved,
      source: 'vision',
    },
  };
}

/** Bütçeye sığmayan kelimeleri puanlar (yanıttan sonra; hata yalnızca loglanır). */
export async function scorePendingKeywords(result: DesignAnalysisResult, budgetMs: number): Promise<void> {
  if (result.pendingKeywords.length === 0) return;
  await scoreKeywords(result.pendingKeywords, result.scrapeOptions, { budgetMs, countUsage: false })
    .catch((error: unknown) => console.warn('[Design analysis] Background keyword scoring failed', error instanceof Error ? error.message : error));
}

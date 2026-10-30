/**
 * POST /api/designs/analyze — tasarım görselinin yapay zekâ analizi ve anahtar kelimelerin Etsy puanları.
 *
 * Zaman aşımını önlemek için iş ikiye ayrılır:
 *  1. Görsel analizi + havuzda taze puanı olan kelimeler hemen döner; eski/yeni kelimeler süre bütçesi içinde
 *     Etsy'den puanlanır (bkz. keyword-pool).
 *  2. Bütçeye sığmayan kelimeler havuza "Taranacak" olarak eklenir ve yanıt döndükten sonra (after) puanlanır;
 *     kalanları zamanlayıcının havuz yenilemesi tamamlar. Analiz penceresi puanları havuzdan güncel okur.
 */
import { NextResponse, after } from 'next/server';
import { getAuthoritativeSession } from '@/lib/auth-server';
import { checkRateLimit } from '@/lib/request-rate-limit';
import { loadVisionImage, MediaSourceError } from '@/lib/media-source';
import { analyzeDesignImage, DesignVisionConfigError } from '@/lib/design-vision';
import { normalizeKeywords, scoreKeywords } from '@/lib/keyword-pool';
import { loadScraperCredentials } from '@/lib/scraper-credentials';
import { filterSafeKeywords } from '@/lib/trademark-shield';
import type { ScrapingOptions } from '@/lib/etsy-scraper';

export const maxDuration = 120;

/** Yanıttan önce kelime puanlamaya ayrılan süre (görsel analizi ayrıca ~10-30 sn sürer). */
const SYNC_SCORING_BUDGET_MS = 35_000;
/** Yanıttan sonra kalan kelimelerin puanlanması için süre. */
const BACKGROUND_SCORING_BUDGET_MS = 70_000;

export async function POST(request: Request) {
  try {
    const session = await getAuthoritativeSession();
    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || request.headers.get('x-real-ip') || 'guest';
    const rateLimitKey = session ? `ai:design-analyze:${session.id}` : `ai:design-analyze:guest:${clientIp}`;
    const rateLimit = await checkRateLimit(rateLimitKey, 15, 10 * 60_000);
    if (!rateLimit.allowed) {
      return NextResponse.json({ success: false, error: 'Vision AI analiz limiti aşıldı. Lütfen birkaç dakika sonra tekrar deneyin.' }, {
        status: 429,
        headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) },
      });
    }

    const { src } = await request.json().catch(() => ({}));
    if (!src) return NextResponse.json({ success: false, error: 'Görsel URL veya base64 gerekli.' }, { status: 400 });

    // Görseli sahiplik doğrulamasıyla yükle (misafirler yalnızca data URL / demo görselleri)
    let image: { buffer: Buffer; mimeType: string };
    try {
      image = await loadVisionImage(session?.id ?? null, String(src), { appOrigin: new URL(request.url).origin });
    } catch (error) {
      if (error instanceof MediaSourceError) return NextResponse.json({ success: false, error: error.message }, { status: error.status });
      console.error('[Analyze API] Image load failed:', error);
      return NextResponse.json({ success: false, error: 'Görsel dosyası okunamadı veya yükleme henüz tamamlanmadı. Lütfen tekrar deneyin.' }, { status: 400 });
    }

    const [vision, credentials] = await Promise.all([
      analyzeDesignImage(image),
      loadScraperCredentials(session?.id ?? null).catch(() => null),
    ]);
    const scrapeOptions: ScrapingOptions = {
      etsyAccessToken: credentials?.etsyAccessToken,
      etsyApiKey: credentials?.etsyApiKey,
      etsySharedSecret: credentials?.etsySharedSecret,
      userId: session?.id,
      apiKey: credentials?.scrapingApiKey,
      provider: credentials?.scrapingProvider,
      workerUrl: credentials?.workerUrl,
    };

    const trademarkRemoved = filterSafeKeywords(vision.keywords.map((k) => k.toLowerCase().trim())).removed.map((r) => r.keyword);
    const keywords = normalizeKeywords(vision.keywords);
    const scored = await scoreKeywords(keywords, scrapeOptions, { budgetMs: SYNC_SCORING_BUDGET_MS });
    if (scored.pending.length > 0) {
      after(async () => {
        await scoreKeywords(scored.pending, scrapeOptions, { budgetMs: BACKGROUND_SCORING_BUDGET_MS, countUsage: false })
          .catch((error: unknown) => console.warn('[Analyze API] Background keyword scoring failed', error instanceof Error ? error.message : error));
      });
    }

    return NextResponse.json({
      success: true,
      hasEtsyApi: Boolean(credentials?.etsyAccessToken),
      pendingKeywords: scored.pending.length,
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
    });
  } catch (error) {
    console.error('[Design Analyze] Request failed:', error instanceof Error ? error.message : 'unknown error');
    const message = error instanceof DesignVisionConfigError ? error.message : 'Tasarım analizi başarısız oldu. Lütfen tekrar deneyin.';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

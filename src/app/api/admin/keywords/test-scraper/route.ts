import { NextResponse } from 'next/server';
import sql, { ensureKeywordPoolColumns } from '@/lib/db';
import { scrapeEtsyKeywordData } from '@/lib/etsy-scraper';
import { loadScraperCredentials } from '@/lib/scraper-credentials';
import { requireAdmin } from '@/lib/auth-server';
import { consumeRateLimit } from '@/lib/request-rate-limit';

export async function POST(req: Request) {
  try {
    const session = await requireAdmin();
    if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const rateLimit = consumeRateLimit(`scraper:test:${session.id}`, 10, 10 * 60_000);
    if (!rateLimit.allowed) {
      return NextResponse.json({ success: false, error: 'Scraper test limiti aşıldı.' }, {
        status: 429,
        headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) },
      });
    }

    await ensureKeywordPoolColumns();
    const body = await req.json();
    const { keyword = 'vintage shirt', workerUrl } = body;
    if (typeof keyword !== 'string' || keyword.trim().length === 0 || keyword.length > 200) {
      return NextResponse.json({ success: false, error: 'Geçersiz keyword.' }, { status: 400 });
    }
    if (workerUrl !== undefined && (typeof workerUrl !== 'string' || workerUrl.length > 2048)) {
      return NextResponse.json({ success: false, error: 'Geçersiz worker URL.' }, { status: 400 });
    }

    // Fetch user workspace & app settings
    const credentials = await loadScraperCredentials(session.id);
    const { etsyAccessToken, etsyApiKey, etsySharedSecret, etsyShopId, scrapingApiKey, scrapingProvider } = credentials;
    const effectiveWorkerUrl = workerUrl || credentials.workerUrl;

    const result = await scrapeEtsyKeywordData(keyword, {
      etsyAccessToken,
      etsyApiKey,
      etsySharedSecret,
      apiKey: scrapingApiKey,
      provider: scrapingProvider,
      workerUrl: effectiveWorkerUrl
    });

    return NextResponse.json({
      success: !result.scrapeError,
      result,
      diagnostics: {
        testedKeyword: keyword,
        etsyOfficialApiConnected: result.rawMetrics?.method === 'etsy_official_api' || !!etsyAccessToken || !!etsyApiKey,
        etsyShopId: etsyShopId || 'Yok',
        hasScraperApiKey: !!scrapingApiKey,
        scrapingProvider,
        workerUrlUsed: effectiveWorkerUrl || 'Yok',
        dataSourceUsed: result.rawMetrics?.method || (result.scrapeError ? 'error' : 'unknown'),
        apiStatus: result.rawMetrics?.apiStatus || null,
        apiError: result.rawMetrics?.apiError || null
      }
    });
  } catch (error) {
    console.error('[Test Scraper] Request failed:', error instanceof Error ? error.message : 'unknown error');
    return NextResponse.json({ success: false, error: 'Scraper test isteği işlenemedi.' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import sql, { ensureKeywordPoolColumns } from '@/lib/db';
import { scrapeEtsyKeywordData } from '@/lib/etsy-scraper';
import { loadScraperCredentials } from '@/lib/scraper-credentials';
import { requireAdmin } from '@/lib/auth-server';
import { consumeRateLimit } from '@/lib/request-rate-limit';

export async function GET(req: Request) {
  try {
    const session = await requireAdmin();
    if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const rateLimit = consumeRateLimit(`scraper:proxy:${session.id}`, 30, 60_000);
    if (!rateLimit.allowed) {
      return NextResponse.json({ success: false, error: 'Scraper istek limiti aşıldı.' }, {
        status: 429,
        headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) },
      });
    }

    await ensureKeywordPoolColumns();
    const { searchParams } = new URL(req.url);
    const targetUrl = searchParams.get('url');
    const keyword = searchParams.get('q') || searchParams.get('keyword') || '';

    if (!targetUrl && !keyword) {
      return NextResponse.json({ success: false, error: 'url veya q parametresi gerekli.' }, { status: 400 });
    }

    const cleanKeyword = keyword.trim().toLowerCase();

    // Query user workspace & app settings
    const { etsyAccessToken, etsyApiKey, etsySharedSecret, scrapingApiKey, scrapingProvider, workerUrl } =
      await loadScraperCredentials(session.id);

    // Evaluate keyword with real Etsy engine
    const result = await scrapeEtsyKeywordData(cleanKeyword, {
      etsyAccessToken,
      etsyApiKey,
      etsySharedSecret,
      apiKey: scrapingApiKey,
      provider: scrapingProvider,
      workerUrl
    });

    if (!result.scrapeError && result.totalListings > 0) {
      return NextResponse.json({
        success: true,
        method: result.rawMetrics?.method || 'etsy_official_api',
        data: result
      });
    }

    return NextResponse.json({
      success: false,
      status: 403,
      error: result.scrapeError || 'Etsy Bot Koruması Engeli (HTTP 403). Etsy Mağazanızı bağlayın veya Scraper API ekleyin.'
    }, { status: 200 });

  } catch (error) {
    console.error('[Proxy Fetch] Request failed:', error instanceof Error ? error.message : 'unknown error');
    return NextResponse.json({ success: false, error: 'Scraper isteği işlenemedi.' }, { status: 500 });
  }
}

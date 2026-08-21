import { NextResponse } from 'next/server';
import sql, { ensureKeywordPoolColumns } from '@/lib/db';
import { scrapeEtsyKeywordData } from '@/lib/etsy-scraper';
import { getValidEtsyToken } from '@/lib/etsy-token-manager';
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
    const workspaceRows = await sql`
      SELECT user_id, etsy_shop_id, scraping_api_key, scraping_provider, cloudflare_worker_url 
      FROM user_workspaces
      WHERE user_id = ${session.id}
      LIMIT 1
    `;

    const appSettingRows = await sql`
      SELECT setting_key, setting_value 
      FROM app_settings 
      WHERE setting_key IN ('etsy_keystring', 'etsy_shared_secret', 'scraping_api_key')
    `;

    let etsyApiKey = process.env.ETSY_API_KEY;
    let etsySharedSecret = process.env.ETSY_SHARED_SECRET;
    let scrapingApiKey = workspaceRows[0]?.scraping_api_key || process.env.SCRAPER_API_KEY || '';
    let scrapingProvider = workspaceRows[0]?.scraping_provider || 'scraperapi';
    let workerUrl = workspaceRows[0]?.cloudflare_worker_url || process.env.CLOUDFLARE_WORKER_URL;

    for (const r of appSettingRows) {
      if (r.setting_key === 'etsy_keystring' && r.setting_value) etsyApiKey = r.setting_value;
      if (r.setting_key === 'etsy_shared_secret' && r.setting_value) etsySharedSecret = r.setting_value;
      if (r.setting_key === 'scraping_api_key' && r.setting_value && !scrapingApiKey) scrapingApiKey = r.setting_value;
    }

    let etsyAccessToken: string | undefined = undefined;
    if (workspaceRows.length > 0 && workspaceRows[0].user_id) {
      const tokenRes = await getValidEtsyToken(workspaceRows[0].user_id);
      if (tokenRes.success && tokenRes.access_token) {
        etsyAccessToken = tokenRes.access_token;
        etsyApiKey = tokenRes.api_key || etsyApiKey;
        etsySharedSecret = tokenRes.shared_secret || etsySharedSecret;
      }
    }

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

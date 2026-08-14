import { NextResponse } from 'next/server';
import sql, { ensureKeywordPoolColumns } from '@/lib/db';
import { scrapeEtsyKeywordData } from '@/lib/etsy-scraper';
import { getValidEtsyToken } from '@/lib/etsy-token-manager';

export async function POST(req: Request) {
  try {
    await ensureKeywordPoolColumns();
    const body = await req.json();
    const { keyword = 'vintage shirt', workerUrl } = body;

    // Fetch user workspace & app settings
    const workspaceRows = await sql`
      SELECT user_id, etsy_shop_id, scraping_api_key, scraping_provider, cloudflare_worker_url 
      FROM user_workspaces 
      WHERE etsy_access_token IS NOT NULL OR scraping_api_key IS NOT NULL
      ORDER BY updated_at DESC
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
    let effectiveWorkerUrl = workerUrl || workspaceRows[0]?.cloudflare_worker_url || process.env.CLOUDFLARE_WORKER_URL;

    for (const r of appSettingRows) {
      if (r.setting_key === 'etsy_keystring' && r.setting_value) etsyApiKey = r.setting_value;
      if (r.setting_key === 'etsy_shared_secret' && r.setting_value) etsySharedSecret = r.setting_value;
      if (r.setting_key === 'scraping_api_key' && r.setting_value && !scrapingApiKey) scrapingApiKey = r.setting_value;
    }

    let etsyAccessToken: string | undefined = undefined;
    let etsyShopId: string | undefined = undefined;
    if (workspaceRows.length > 0 && workspaceRows[0].user_id) {
      const tokenRes = await getValidEtsyToken(workspaceRows[0].user_id);
      if (tokenRes.success && tokenRes.access_token) {
        etsyAccessToken = tokenRes.access_token;
        etsyApiKey = tokenRes.api_key || etsyApiKey;
        etsySharedSecret = tokenRes.shared_secret || etsySharedSecret;
        etsyShopId = tokenRes.shop_id || workspaceRows[0].etsy_shop_id;
      }
    }

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
        etsyOfficialApiConnected: !!etsyAccessToken,
        etsyShopId: etsyShopId || 'Yok',
        hasScraperApiKey: !!scrapingApiKey,
        scrapingProvider,
        workerUrlUsed: effectiveWorkerUrl || 'Yok',
        dataSourceUsed: result.rawMetrics?.method || (result.scrapeError ? 'error' : 'unknown')
      }
    });
  } catch (error: any) {
    console.error('Test Scraper API Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

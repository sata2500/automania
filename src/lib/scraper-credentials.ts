/**
 * Etsy / scraper çağrıları için gereken kimlik bilgilerini tek yerden çözer.
 * Öncelik: veritabanındaki (şifreli) global ayarlar > ortam değişkenleri.
 * Kullanıcının Etsy OAuth token'ı varsa (ve yenilenebiliyorsa) o da eklenir.
 */
import sql from '@/lib/db';
import { loadSettings } from '@/lib/app-settings';
import { getValidEtsyToken } from '@/lib/etsy-token-manager';

export type ScraperCredentials = {
  etsyApiKey?: string;
  etsySharedSecret?: string;
  etsyAccessToken?: string;
  etsyShopId?: string;
  scrapingApiKey: string;
  scrapingProvider: string;
  workerUrl?: string;
};

export async function loadScraperCredentials(userId: string): Promise<ScraperCredentials> {
  const [workspaceRows, settings] = await Promise.all([
    sql`
      SELECT etsy_shop_id, scraping_provider, cloudflare_worker_url
      FROM user_workspaces
      WHERE user_id = ${userId}
      LIMIT 1
    `,
    loadSettings(['etsy_keystring', 'etsy_shared_secret', 'scraping_api_key']),
  ]);
  const workspace = workspaceRows[0] as
    | { etsy_shop_id?: string | null; scraping_provider?: string | null; cloudflare_worker_url?: string | null }
    | undefined;

  const credentials: ScraperCredentials = {
    etsyApiKey: settings.etsy_keystring || process.env.ETSY_API_KEY,
    etsySharedSecret: settings.etsy_shared_secret || process.env.ETSY_SHARED_SECRET,
    scrapingApiKey: settings.scraping_api_key || process.env.SCRAPER_API_KEY || '',
    scrapingProvider: workspace?.scraping_provider || 'scraperapi',
    workerUrl: workspace?.cloudflare_worker_url || process.env.CLOUDFLARE_WORKER_URL || undefined,
    etsyShopId: workspace?.etsy_shop_id || undefined,
  };

  if (workspace) {
    const tokenRes = await getValidEtsyToken(userId);
    if (tokenRes.success && tokenRes.access_token) {
      credentials.etsyAccessToken = tokenRes.access_token;
      credentials.etsyApiKey = tokenRes.api_key || credentials.etsyApiKey;
      credentials.etsySharedSecret = tokenRes.shared_secret || credentials.etsySharedSecret;
      credentials.etsyShopId = tokenRes.shop_id || credentials.etsyShopId;
    }
  }

  return credentials;
}

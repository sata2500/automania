/**
 * GET /api/cron/automation
 * =========================
 * Saatte bir çağrılan zamanlayıcı uç noktası (GitHub Actions veya harici zamanlayıcı).
 * - Zamanı gelmiş aktif şablonlar için çalıştırma oluşturur; telafi penceresinde kaçırılan saati yakalar.
 * - Yarıda kalmış veya süre sınırında kesilmiş çalıştırmaları sürdürür, çok eskileri kapatır.
 * - Hazır İlanlar'da zamanı gelmiş onaylı ilanları Etsy'de yayına alır.
 * - Kelime havuzunda 7 günden eski / hiç taranmamış kelimelerin bir kısmını Etsy'den yeniden puanlar.
 * `Authorization: Bearer <CRON_SECRET>` gerektirir; CRON_SECRET yoksa kapalıdır.
 */
import { NextRequest, NextResponse, after } from 'next/server';
import { isValidCronAuthorization } from '@/lib/internal-auth';
import { completeSchedulerTick, recordCronHeartbeat, runSchedulerTick } from '@/lib/automation-scheduler';
import { refreshStaleKeywords } from '@/lib/keyword-pool';
import { loadScraperCredentials } from '@/lib/scraper-credentials';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  if (!isValidCronAuthorization(req.headers.get('authorization'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await recordCronHeartbeat().catch((error: unknown) => console.error('[Cron] Heartbeat failed', error));
  const result = await runSchedulerTick();
  const origin = req.nextUrl.origin;
  // Çalıştırmalar ve zamanlanmış ilan yayınları yanıt döndükten sonra, süre bütçesi içinde yapılır.
  after(async () => { await completeSchedulerTick(result, origin); });
  // Havuz yenilemesi ayrı yürür: her turda sınırlı sayıda kelime (Etsy'yi yormadan havuz güncel kalır).
  after(async () => {
    try {
      const creds = await loadScraperCredentials(null);
      const refreshed = await refreshStaleKeywords({
        etsyApiKey: creds.etsyApiKey, etsySharedSecret: creds.etsySharedSecret,
        apiKey: creds.scrapingApiKey, provider: creds.scrapingProvider, workerUrl: creds.workerUrl,
      });
      if (refreshed.refreshed > 0) console.log('[Cron] Keyword pool refreshed', refreshed);
    } catch (error) {
      console.error('[Cron] Keyword pool refresh failed', error instanceof Error ? error.message : error);
    }
  });

  const { dispatch: _dispatch, ...summary } = result;
  return NextResponse.json({ success: true, ...summary });
}

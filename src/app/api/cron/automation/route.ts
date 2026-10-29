/**
 * GET /api/cron/automation
 * =========================
 * Saatte bir çağrılan zamanlayıcı uç noktası (GitHub Actions veya harici zamanlayıcı).
 * - Zamanı gelmiş aktif şablonlar için çalıştırma oluşturur; telafi penceresinde kaçırılan saati yakalar.
 * - Yarıda kalmış veya süre sınırında kesilmiş çalıştırmaları sürdürür, çok eskileri kapatır.
 * - Hazır İlanlar'da zamanı gelmiş onaylı ilanları Etsy'de yayına alır.
 * `Authorization: Bearer <CRON_SECRET>` gerektirir; CRON_SECRET yoksa kapalıdır.
 */
import { NextRequest, NextResponse, after } from 'next/server';
import { isValidCronAuthorization } from '@/lib/internal-auth';
import { completeSchedulerTick, recordCronHeartbeat, runSchedulerTick } from '@/lib/automation-scheduler';

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

  const { dispatch: _dispatch, ...summary } = result;
  return NextResponse.json({ success: true, ...summary });
}

/**
 * Route'larda kullanıcı etkinliğiyle zamanlayıcıyı tetiklemek için ince sarmalayıcı: zamanlayıcı modülü
 * yanıt döndükten sonra (after) yüklenir, böylece sık çağrılan uç noktaların açılışı ağırlaşmaz.
 */
import { after } from 'next/server';

export function scheduleUserTick(userId: string, request: Request) {
  const origin = new URL(request.url).origin;
  try {
    after(async () => {
      const { runUserSchedulerTick } = await import('@/lib/automation-scheduler');
      await runUserSchedulerTick(userId, origin);
    });
  } catch {
    // after() yalnızca istek bağlamında çalışır (ör. testlerde yoktur); zamanlayıcı tetiklenmez.
  }
}

import type { Instrumentation } from 'next';

/**
 * Yakalanmamış sunucu hatalarını yapılandırılmış biçimde loglar ve isteğe bağlı olarak
 * ERROR_REPORT_WEBHOOK_URL adresine (ör. Slack/Discord webhook, Sentry tunnel) iletir.
 * İstek başlıkları (çerezler, Authorization) asla gönderilmez.
 */
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  const message = err instanceof Error ? err.message : String(err);
  const digest = typeof err === 'object' && err !== null && 'digest' in err ? String(err.digest) : undefined;
  const report = {
    level: 'error',
    message: message.slice(0, 2000),
    digest,
    method: request.method,
    path: request.path.split('?')[0],
    routePath: context.routePath,
    routeType: context.routeType,
    at: new Date().toISOString(),
  };

  console.error('[server-error]', JSON.stringify(report));

  const webhook = process.env.ERROR_REPORT_WEBHOOK_URL;
  if (!webhook) return;
  try {
    await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(report),
      signal: AbortSignal.timeout(3000),
    });
  } catch {
    // Raporlama hatası uygulamayı etkilememeli.
  }
};

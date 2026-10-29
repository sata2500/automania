/**
 * Otomasyon zamanlayıcısının tek "tık"ı: zamanı gelen şablonlar için çalıştırma açar, yarıda kalmış veya
 * süre sınırında kesilmiş çalıştırmaları sürdürür ve zamanı gelen Hazır İlanlar'ı yayınlar.
 *  - Saatlik harici zamanlayıcı (GitHub Actions → /api/cron/automation) tüm kullanıcılar için çağırır.
 *  - Ayrıca kullanıcı uygulamayı açtığında yalnızca onun şablonları için çağrılır: harici zamanlayıcı
 *    gecikse veya hiç kurulmamış olsa bile kaçırılan saat (telafi penceresi içinde) yakalanır.
 */
import { and, eq, gt, sql as dsql } from 'drizzle-orm';
import sql, { db } from '@/lib/db';
import { automationRuns, podTemplates } from '@/db/schema';
import { clampListingsPerRun, latestDueSlot } from '@/lib/automation-schedule';
import { publishDueReviewItems } from '@/lib/listing-review';
import { createAutomationRun, dispatchAutomationRun, failStaleAutomationRuns, findResumableRuns, type AutomationRunInput } from '@/lib/automation-runner';

/**
 * Zamanlayıcı bir saati kaçırırsa en fazla bu kadar geriye bakılarak telafi edilir. GitHub Actions'ın
 * zamanlanmış işleri yoğunlukta saatlerce gecikebildiği için pencere geniş tutulur; her şablon için
 * yalnızca en son kaçırılan saat bir kez çalıştırılır.
 */
export const CATCH_UP_HOURS = 8;

/** Bu süredir dokunulmamış çalıştırmalar kapatılır (süre sınırında kesilenler önce sürdürülmeye çalışılır). */
const STALE_RUN_MINUTES = 180;

const LAST_CRON_SETTING = 'automation_scheduler_last_cron_at';

export type SchedulerTickResult = {
  checkedTemplates: number;
  created: Array<{ runId: string; templateId: string }>;
  skipped: Array<{ templateId: string; reason: string }>;
  resumed: string[];
  staleClosed: number;
  dispatch: AutomationRunInput[];
};

export async function runSchedulerTick(options: { userId?: string; now?: Date } = {}): Promise<SchedulerTickResult> {
  const now = options.now ?? new Date();
  const staleClosed = options.userId ? 0 : await failStaleAutomationRuns(STALE_RUN_MINUTES);

  const templates = await db
    .select({ id: podTemplates.id, userId: podTemplates.userId, schedule: podTemplates.automationSchedule })
    .from(podTemplates)
    .where(and(
      eq(podTemplates.isActive, true),
      dsql`(${podTemplates.automationSchedule} ->> 'enabled')::boolean = true`,
      ...(options.userId ? [eq(podTemplates.userId, options.userId)] : []),
    ));

  const created: Array<AutomationRunInput> = [];
  const skipped: Array<{ templateId: string; reason: string }> = [];

  for (const template of templates) {
    const slot = latestDueSlot(template.schedule, now, CATCH_UP_HOURS);
    if (!slot) continue;

    // Bu planlı saat için zaten çalıştırma oluşturulduysa (aynı saatte yeniden tetikleme veya
    // önceki bir telafi) tekrar üretme.
    const [recent] = await db
      .select({ id: automationRuns.id })
      .from(automationRuns)
      .where(and(
        eq(automationRuns.templateId, template.id),
        eq(automationRuns.triggerType, 'scheduled'),
        gt(automationRuns.createdAt, slot),
      ))
      .limit(1);
    if (recent) {
      skipped.push({ templateId: template.id, reason: 'already_triggered' });
      continue;
    }

    const count = clampListingsPerRun(template.schedule?.listingsPerRun);
    for (let i = 0; i < count; i++) {
      const result = await createAutomationRun({
        templateId: template.id,
        userId: template.userId,
        triggerType: 'scheduled',
        allowConcurrent: i > 0,
      });
      if (result.ok) {
        created.push({ runId: result.runId, templateId: template.id, userId: template.userId });
      } else {
        skipped.push({ templateId: template.id, reason: result.reason });
        break;
      }
    }
  }

  // Yarıda kalmış, hiç başlamamış veya süre sınırında kesilmiş çalıştırmalar da sürdürülür.
  const createdIds = new Set(created.map((run) => run.runId));
  const resumable = (await findResumableRuns(60, 10, options.userId).catch(() => [])).filter((run) => !createdIds.has(run.runId));

  return {
    checkedTemplates: templates.length,
    created: created.map(({ runId, templateId }) => ({ runId, templateId })),
    skipped,
    resumed: resumable.map(({ runId }) => runId),
    staleClosed,
    dispatch: [...created, ...resumable],
  };
}

/** Tık sonucunda başlatılacak çalıştırmaları ve zamanı gelen ilan yayınlarını işler (yanıt sonrası). */
export async function completeSchedulerTick(result: SchedulerTickResult, origin: string, options: { userId?: string } = {}) {
  await Promise.allSettled(result.dispatch.map((run) => dispatchAutomationRun(run, origin)));
  const published = await publishDueReviewItems({ userId: options.userId }).catch((error: unknown) => {
    console.error('[Scheduler] Scheduled listing publish failed', error);
    return null;
  });
  if (published && (published.published.length || published.failed.length || published.staleReset)) console.log('[Scheduler] Scheduled listings', published);
}

/** Harici zamanlayıcının en son ne zaman çağrıldığı (uygulamada "zamanlayıcı çalışıyor mu" uyarısı için). */
export async function recordCronHeartbeat(at = new Date()) {
  await sql`
    INSERT INTO app_settings (id, setting_key, setting_value)
    VALUES (${LAST_CRON_SETTING}, ${LAST_CRON_SETTING}, ${at.toISOString()})
    ON CONFLICT (setting_key)
    DO UPDATE SET setting_value = EXCLUDED.setting_value, updated_at = CURRENT_TIMESTAMP
  `;
}

export async function readCronHeartbeat(): Promise<string | null> {
  const rows = await sql`SELECT setting_value FROM app_settings WHERE setting_key = ${LAST_CRON_SETTING} LIMIT 1`;
  const value = rows[0]?.setting_value;
  return typeof value === 'string' && value ? value : null;
}

/** Kullanıcı başına tık sıklığı (aynı sunucu örneğinde): uygulama her açıldığında veritabanı yorulmasın. */
const USER_TICK_INTERVAL_MS = 5 * 60_000;
const lastUserTick = new Map<string, number>();

export function shouldRunUserTick(userId: string, nowMs = Date.now()): boolean {
  const last = lastUserTick.get(userId) ?? 0;
  if (nowMs - last < USER_TICK_INTERVAL_MS) return false;
  lastUserTick.set(userId, nowMs);
  return true;
}

/**
 * Kullanıcı uygulamayı kullanırken (yanıt döndükten sonra) yalnızca onun şablonları için zamanlayıcıyı
 * çalıştırır: harici zamanlayıcı gecikse de kaçırılan saat yakalanır, kesilmiş çalıştırmalar sürer.
 */
export async function runUserSchedulerTick(userId: string, origin: string) {
  if (!shouldRunUserTick(userId)) return;
  try {
    const result = await runSchedulerTick({ userId });
    await completeSchedulerTick(result, origin, { userId });
  } catch (error) {
    console.warn('[Scheduler] User tick failed', { userId, error: error instanceof Error ? error.message : error });
  }
}

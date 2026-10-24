/**
 * GET /api/cron/automation
 * =========================
 * Saatte bir çağrılan zamanlayıcı uç noktası (Vercel Cron veya harici zamanlayıcı).
 * - Uzun süredir ilerlemeyen çalıştırmaları 'failed' olarak kapatır.
 * - Yarıda kalmış (süre bütçesi dolmuş) çalıştırmaları sürdürür.
 * - Zamanı gelmiş aktif şablonlar için çalıştırma oluşturur; son 3 saatte kaçırılan bir saat varsa telafi eder.
 * `Authorization: Bearer <CRON_SECRET>` gerektirir; CRON_SECRET yoksa kapalıdır.
 */
import { NextRequest, NextResponse, after } from 'next/server';
import { and, eq, gt, sql as dsql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { automationRuns, podTemplates } from '@/db/schema';
import { isValidCronAuthorization } from '@/lib/internal-auth';
import { clampListingsPerRun, latestDueSlot } from '@/lib/automation-schedule';
import { createAutomationRun, dispatchAutomationRun, failStaleAutomationRuns, findResumableRuns } from '@/lib/automation-runner';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

/** Zamanlayıcı bir saati kaçırırsa en fazla bu kadar geriye bakılarak telafi edilir. */
const CATCH_UP_HOURS = 3;

export async function GET(req: NextRequest) {
  if (!isValidCronAuthorization(req.headers.get('authorization'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const staleClosed = await failStaleAutomationRuns(30);

  const templates = await db
    .select({ id: podTemplates.id, userId: podTemplates.userId, schedule: podTemplates.automationSchedule })
    .from(podTemplates)
    .where(and(
      eq(podTemplates.isActive, true),
      dsql`(${podTemplates.automationSchedule} ->> 'enabled')::boolean = true`,
    ));

  const created: Array<{ runId: string; templateId: string; userId: string }> = [];
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

  // Yarıda kalmış veya hiç başlamamış eski çalıştırmalar da sürdürülür.
  const createdIds = new Set(created.map((run) => run.runId));
  const resumable = (await findResumableRuns(60, 10).catch(() => [])).filter((run) => !createdIds.has(run.runId));

  const origin = req.nextUrl.origin;
  const toDispatch = [...created, ...resumable];
  if (toDispatch.length > 0) {
    after(async () => {
      await Promise.allSettled(toDispatch.map((run) => dispatchAutomationRun(run, origin)));
    });
  }

  return NextResponse.json({
    success: true,
    checkedTemplates: templates.length,
    created: created.map(({ runId, templateId }) => ({ runId, templateId })),
    skipped,
    resumed: resumable.map(({ runId }) => runId),
    staleClosed,
  });
}

/**
 * GET /api/cron/automation
 * =========================
 * Saatte bir çağrılan zamanlayıcı uç noktası (Vercel Cron veya harici zamanlayıcı).
 * - Uzun süredir takılı kalan çalıştırmaları 'failed' olarak kapatır.
 * - Zamanlaması bu saate denk gelen aktif şablonlar için çalıştırma oluşturur.
 * `Authorization: Bearer <CRON_SECRET>` gerektirir; CRON_SECRET yoksa kapalıdır.
 */
import { NextRequest, NextResponse, after } from 'next/server';
import { and, eq, gt, sql as dsql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { automationRuns, podTemplates } from '@/db/schema';
import { isValidCronAuthorization } from '@/lib/internal-auth';
import { clampListingsPerRun, isDueThisHour } from '@/lib/automation-schedule';
import { createAutomationRun, dispatchAutomationRun, failStaleAutomationRuns } from '@/lib/automation-runner';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

const DUPLICATE_WINDOW_MS = 50 * 60 * 1000;

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
    if (!isDueThisHour(template.schedule, now)) continue;

    // Aynı saat diliminde ikinci kez tetiklenirse (yeniden deneme vb.) tekrar üretme
    const [recent] = await db
      .select({ id: automationRuns.id })
      .from(automationRuns)
      .where(and(
        eq(automationRuns.templateId, template.id),
        eq(automationRuns.triggerType, 'scheduled'),
        gt(automationRuns.createdAt, new Date(now.getTime() - DUPLICATE_WINDOW_MS)),
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

  const origin = req.nextUrl.origin;
  if (created.length > 0) {
    after(async () => {
      await Promise.allSettled(created.map((run) => dispatchAutomationRun(run, origin)));
    });
  }

  return NextResponse.json({
    success: true,
    checkedTemplates: templates.length,
    created: created.map(({ runId, templateId }) => ({ runId, templateId })),
    skipped,
    staleClosed,
  });
}

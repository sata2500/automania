/**
 * GET /api/automation/poll/[runId]
 * Bir otomasyon çalıştırmasının güncel durumunu döner (yalnızca sahibine).
 */

import { NextResponse, after } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { automationRuns } from '@/db/schema';
import { getAuthoritativeSession } from '@/lib/auth-server';
import { DEAD_RUN_MS, runAndContinue } from '@/lib/automation-runner';

export const maxDuration = 300;

/** Bekleyen bir çalıştırma bu kadar süredir dokunulmamışsa takip isteği onu sürdürür. */
const RESUME_IDLE_MS = 20_000;

export async function GET(
  req: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  const session = await getAuthoritativeSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { runId } = await params;
  try {
    const [run] = await db
      .select()
      .from(automationRuns)
      .where(and(eq(automationRuns.id, runId), eq(automationRuns.userId, session.id)))
      .limit(1);

    if (!run) return NextResponse.json({ error: 'Çalıştırma bulunamadı.' }, { status: 404 });

    // Yarıda kalmış (süre bütçesi dolmuş) veya hiç başlamamış çalıştırma: kullanıcı izlerken kaldığı yerden sürdür.
    // Aynı anda iki çağrı gelse bile çalıştırıcı yalnızca 'pending' kaydı sahiplenir.
    const lastTouched = (run.updatedAt ?? run.createdAt)?.getTime() ?? 0;
    // Süre sınırında kesilip 'running' durumunda kalmış çalıştırma da kaldığı adımdan sürdürülür.
    const idle = Date.now() - lastTouched;
    if ((run.status === 'pending' && idle > RESUME_IDLE_MS) || (run.status === 'running' && idle > DEAD_RUN_MS)) {
      const origin = new URL(req.url).origin;
      after(async () => { await runAndContinue({ runId: run.id, templateId: run.templateId, userId: run.userId }, origin); });
    }
    return NextResponse.json({ run });
  } catch (error) {
    console.error('[GET /api/automation/poll] Error:', error);
    return NextResponse.json({ error: 'Çalıştırma durumu alınamadı.' }, { status: 500 });
  }
}

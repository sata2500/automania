/**
 * GET /api/automation/poll/[runId]
 * Bir otomasyon çalıştırmasının güncel durumunu döner (yalnızca sahibine).
 */

import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { automationRuns } from '@/db/schema';
import { getAuthoritativeSession } from '@/lib/auth-server';

export async function GET(
  _req: Request,
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
    return NextResponse.json({ run });
  } catch (error) {
    console.error('[GET /api/automation/poll] Error:', error);
    return NextResponse.json({ error: 'Çalıştırma durumu alınamadı.' }, { status: 500 });
  }
}

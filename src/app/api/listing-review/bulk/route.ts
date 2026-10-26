/**
 * POST /api/listing-review/bulk
 * { runIds, action: 'schedule' | 'unschedule' | 'reject', startAt?, intervalMinutes? }
 * 'schedule': seçilen ilanlar sırayla startAt'ten başlayarak intervalMinutes arayla zamanlanır
 * (startAt yoksa hemen; zamanı gelenler zamanlayıcı tarafından yayınlanır, hemen olanlar bu istekten sonra başlar).
 */
import { NextResponse, after } from 'next/server';
import { z } from 'zod';
import { getAuthoritativeSession } from '@/lib/auth-server';
import { applyReviewAction, publishDueReviewItems } from '@/lib/listing-review';
import { getErrorMessage } from '@/lib/errors';

export const maxDuration = 300;

const schema = z.object({
  runIds: z.array(z.string().min(1).max(255)).min(1).max(100),
  action: z.enum(['schedule', 'unschedule', 'reject']),
  startAt: z.string().datetime({ offset: true }).nullable().optional(),
  intervalMinutes: z.number().int().min(0).max(60 * 24 * 30).optional(),
});

export async function POST(req: Request) {
  const session = await getAuthoritativeSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ success: false, error: 'Geçersiz istek.' }, { status: 400 });
  const { runIds, action, startAt, intervalMinutes = 0 } = parsed.data;
  const start = startAt ? new Date(startAt).getTime() : Date.now();

  const done: string[] = [];
  const errors: Array<{ runId: string; error: string }> = [];
  for (const [index, runId] of runIds.entries()) {
    try {
      if (action === 'schedule') {
        await applyReviewAction(session.id, runId, { type: 'approve', scheduledAt: new Date(start + index * intervalMinutes * 60_000).toISOString() });
      } else {
        await applyReviewAction(session.id, runId, { type: action });
      }
      done.push(runId);
    } catch (error) {
      errors.push({ runId, error: getErrorMessage(error) });
    }
  }
  // Hemen yayınlanması gerekenler zamanlayıcıyı beklemeden başlatılır.
  if (action === 'schedule' && start <= Date.now() + 60_000 && done.length > 0) {
    after(async () => { await publishDueReviewItems({ userId: session.id, budgetMs: 270_000 }).catch((e) => console.error('[Listing Review] Immediate publish failed', e)); });
  }
  return NextResponse.json({ success: errors.length === 0, done, errors });
}

/**
 * PATCH /api/listing-review/[runId] — ilan metnini ve fotoğraf seçimini düzenler.
 * POST  /api/listing-review/[runId] — { action: 'approve' | 'unschedule' | 'reject' | 'restore' | 'publish', scheduledAt? }
 *   'publish' ilanı hemen Etsy'de oluşturup yayına alır; 'approve' zamanlar (scheduledAt yoksa ilk zamanlayıcı turunda).
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthoritativeSession } from '@/lib/auth-server';
import { applyReviewAction, ListingReviewError, publishReviewItem, updateReviewItem } from '@/lib/listing-review';
import { checkRateLimit } from '@/lib/request-rate-limit';
import { getErrorMessage } from '@/lib/errors';

export const maxDuration = 300;

const editSchema = z.object({
  title: z.string().max(200).optional(),
  description: z.string().max(20_000).optional(),
  tags: z.array(z.string().max(40)).max(20).optional(),
  photos: z.array(z.string().max(2000)).max(30).optional(),
  includeVideo: z.boolean().optional(),
  imageAltTexts: z.record(z.string().max(2000), z.string().max(500)).optional(),
});

const actionSchema = z.object({
  action: z.enum(['approve', 'unschedule', 'reject', 'restore', 'publish']),
  scheduledAt: z.string().datetime({ offset: true }).nullable().optional(),
});

function errorResponse(error: unknown) {
  if (error instanceof ListingReviewError) return NextResponse.json({ success: false, error: error.message }, { status: error.status });
  console.error('[Listing Review]', error);
  return NextResponse.json({ success: false, error: getErrorMessage(error) }, { status: 500 });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ runId: string }> }) {
  const session = await getAuthoritativeSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const parsed = editSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ success: false, error: 'Geçersiz düzenleme.' }, { status: 400 });
  try {
    await updateReviewItem(session.id, (await params).runId, parsed.data);
    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ runId: string }> }) {
  const session = await getAuthoritativeSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const parsed = actionSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ success: false, error: 'Geçersiz işlem.' }, { status: 400 });
  const { runId } = await params;
  try {
    if (parsed.data.action === 'publish') {
      const rateLimit = await checkRateLimit(`listing-review:publish:${session.id}`, 30, 60 * 60_000);
      if (!rateLimit.allowed) return NextResponse.json({ success: false, error: 'Saatlik yayın sınırına ulaşıldı; biraz sonra tekrar deneyin.' }, { status: 429 });
      const review = await publishReviewItem(session.id, runId);
      return NextResponse.json({ success: review.status === 'published', review, error: review.status === 'published' ? undefined : review.error });
    }
    const action = parsed.data.action === 'approve'
      ? { type: 'approve' as const, scheduledAt: parsed.data.scheduledAt ?? null }
      : { type: parsed.data.action };
    return NextResponse.json({ success: true, review: await applyReviewAction(session.id, runId, action) });
  } catch (error) {
    return errorResponse(error);
  }
}

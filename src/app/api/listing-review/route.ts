/**
 * GET  /api/listing-review — Hazır İlanlar: inceleme bekleyen/zamanlanmış/yayınlanmış ilanlar.
 * POST /api/listing-review — İlan Stüdyosu'nda hazırlanan ilanı kuyruğa ekler.
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthoritativeSession } from '@/lib/auth-server';
import { createManualDraft, listReviewItems } from '@/lib/listing-review';
import { getErrorMessage } from '@/lib/errors';
import { etsyListingSettingsSchema } from '@/lib/validation/templates';

/** Yalnızca uygulamanın kendi depolamasındaki dosyalar (yayın sırasında sahiplik ayrıca doğrulanır). */
const storedMedia = z.string().max(2000).regex(/^\/api\/(r2|uploads)\//, 'Görseller önce depolamaya yüklenmelidir.');

const manualDraftSchema = z.object({
  title: z.string().trim().min(1).max(140),
  description: z.string().trim().min(1).max(20_000),
  tags: z.array(z.string().trim().min(1).max(20)).max(13),
  taxonomyId: z.number().int().positive(),
  taxonomyProperties: z.record(z.string(), z.array(z.number().int())).default({}),
  materials: z.array(z.string().max(45)).max(13).default([]),
  styles: z.array(z.string().max(45)).max(2).default([]),
  shopSectionId: z.string().max(40).nullable().optional(),
  photos: z.array(storedMedia).min(1).max(20),
  videoUrl: storedMedia.nullable().optional(),
  designUrl: z.string().max(2000).nullable().optional(),
  settings: z.object({
    etsy: etsyListingSettingsSchema,
    variations: z.array(z.object({
      id: z.string().max(100),
      size: z.string().max(100),
      color: z.string().max(100),
      price: z.number().min(0),
      quantity: z.number().int().min(0),
      sku: z.string().max(100).default(''),
      enabled: z.boolean(),
    })).max(400),
  }),
});

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getAuthoritativeSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    return NextResponse.json({ success: true, items: await listReviewItems(session.id) });
  } catch (error) {
    console.error('[Listing Review] List failed', error);
    return NextResponse.json({ success: false, error: getErrorMessage(error) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await getAuthoritativeSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const parsed = manualDraftSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.issues[0]?.message || 'Geçersiz ilan.' }, { status: 400 });
  }
  try {
    const runId = await createManualDraft(session.id, parsed.data);
    return NextResponse.json({ success: true, runId });
  } catch (error) {
    console.error('[Listing Review] Manual draft failed', error);
    return NextResponse.json({ success: false, error: getErrorMessage(error) }, { status: 500 });
  }
}

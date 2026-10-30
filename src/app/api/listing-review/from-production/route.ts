/**
 * POST /api/listing-review/from-production — Üretim sekmesindeki manuel üretimi Hazır İlanlar'a gönderir.
 * Görseller depoya yüklenmiş olarak gelir; ilan metni yanıt döndükten sonra arka planda üretilir
 * (kategori tasarımın analizinden, mağaza ayarları Ayarlar'dan; varyasyon Hazır İlanlar'da seçilir). Kuyrukta "hazırlanıyor" olarak görünür.
 */
import { NextResponse, after } from 'next/server';
import { z } from 'zod';
import { getAuthoritativeSession } from '@/lib/auth-server';
import { createProductionDraft } from '@/lib/listing-review';
import { runAndContinue } from '@/lib/automation-runner';
import { MANUAL_TEMPLATE_ID } from '@/lib/manual-listing';
import { checkRateLimit } from '@/lib/request-rate-limit';
import { getErrorMessage } from '@/lib/errors';

export const maxDuration = 300;

/** Yalnızca uygulamanın kendi depolamasındaki dosyalar (sahiplik yayın sırasında ayrıca doğrulanır). */
const storedMedia = z.string().max(2000).regex(/^\/api\/(r2|uploads)\//, 'Görseller önce depolamaya yüklenmelidir.');

const schema = z.object({
  photos: z.array(storedMedia).min(1, 'İlana eklenecek görsel yok.').max(20, 'Etsy en fazla 20 fotoğraf kabul eder.'),
  photoLabels: z.array(z.string().max(300)).max(20).optional(),
  videoUrl: storedMedia.nullable().optional(),
  folderId: z.string().max(255).nullable().optional(),
  folderName: z.string().max(200).optional(),
  design: z.object({
    id: z.string().max(255).nullable().optional(),
    url: storedMedia.nullable().optional(),
    name: z.string().max(300),
    analysis: z.object({
      description: z.string().max(4000).optional(),
      keywords: z.array(z.string().max(100)).max(60).optional(),
      primarySubject: z.string().max(300).optional(),
      primaryAesthetic: z.string().max(300).optional(),
      productType: z.string().max(100).optional(),
      taxonomyId: z.number().int().positive().nullable().optional(),
    }).nullable().optional(),
  }),
});

export async function POST(req: Request) {
  const session = await getAuthoritativeSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.issues[0]?.message || 'Geçersiz istek.' }, { status: 400 });
  }
  const rateLimit = await checkRateLimit(`listing-review:production:${session.id}`, 40, 60 * 60_000);
  if (!rateLimit.allowed) return NextResponse.json({ success: false, error: 'Saatlik ilan oluşturma sınırına ulaşıldı; biraz sonra tekrar deneyin.' }, { status: 429 });
  try {
    const { runId } = await createProductionDraft(session.id, parsed.data);
    const origin = new URL(req.url).origin;
    after(async () => { await runAndContinue({ runId, templateId: MANUAL_TEMPLATE_ID, userId: session.id }, origin); });
    return NextResponse.json({ success: true, runId });
  } catch (error) {
    console.error('[Listing Review] Production draft failed', error);
    return NextResponse.json({ success: false, error: getErrorMessage(error) }, { status: 500 });
  }
}

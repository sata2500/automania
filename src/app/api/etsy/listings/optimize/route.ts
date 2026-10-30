/**
 * POST /api/etsy/listings/optimize — "Yapay zekâ ile iyileştir": Etsy'deki bir ilan için yeni ilanlarla aynı
 * akışla (yaz → Etsy'den puanla → yapay zekâyla değerlendir → gerekirse düzelt) yeni başlık, etiket ve açıklama
 * önerir; önce/sonra SEO puanını döner. Etsy'ye gönderilmez: öneri Düzenle sekmesinden kullanıcı onayıyla gider.
 * Yalnızca analiz edilmiş ilanda çalışır. Body: { listingId } (bir istekte bir ilan; toplu iyileştirmede istemci
 * sırayla çağırır).
 */
import { getErrorMessage } from '@/lib/errors';
import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { getAuthoritativeSession } from '@/lib/auth-server';
import { checkRateLimit } from '@/lib/request-rate-limit';
import { improveEtsyListing, isListingAnalyzed } from '@/lib/etsy-listing-seo';

export const maxDuration = 300;

export async function POST(req: Request) {
  try {
    const session = await getAuthoritativeSession();
    if (!session) return NextResponse.json({ success: false, error: 'Oturum açmanız gerekiyor.' }, { status: 401 });

    const rateLimit = await checkRateLimit(`ai:etsy-optimize:${session.id}`, 20, 10 * 60_000);
    if (!rateLimit.allowed) {
      return NextResponse.json({ success: false, error: 'Yapay zekâ iyileştirme limiti aşıldı. Biraz sonra tekrar deneyin.' }, {
        status: 429,
        headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) },
      });
    }

    const { listingId } = await req.json().catch(() => ({}));
    if (!listingId) return NextResponse.json({ success: false, error: 'İyileştirilecek ilan belirtilmedi.' }, { status: 400 });
    const rows = await sql`SELECT * FROM user_etsy_listings WHERE user_id = ${session.id} AND listing_id = ${String(listingId)} LIMIT 1`;
    if (rows.length === 0) return NextResponse.json({ success: false, error: 'İlan bulunamadı.' }, { status: 404 });
    if (!isListingAnalyzed(rows[0])) {
      return NextResponse.json({ success: false, error: 'Önce ilanı analiz edin; iyileştirme analiz sonucuna göre yapılır.', code: 'NOT_ANALYZED' }, { status: 409 });
    }

    const { before, improvement } = await improveEtsyListing(session.id, rows[0]);
    return NextResponse.json({
      success: true,
      listingId: String(listingId),
      before: { score: before.score, evaluation: before },
      after: { score: improvement.evaluation.score, evaluation: improvement.evaluation },
      suggestion: { title: improvement.title, tags: improvement.tags, description: improvement.description, createdAt: improvement.createdAt },
    });
  } catch (error) {
    console.error('[Listing optimize] Failed:', error);
    return NextResponse.json({ success: false, error: getErrorMessage(error) }, { status: 500 });
  }
}

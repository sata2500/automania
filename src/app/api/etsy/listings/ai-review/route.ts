/**
 * POST /api/etsy/listings/ai-review — Etsy'deki ilanların metnini yapay zekâyla değerlendirir (SEO puanının
 * 40 puanlık kısmı; görsel analizi yoksa önce yapılır). Düğmeyle veya toplu seçimle çalışır, otomatik değil.
 * Body: { listingIds } (en fazla 5). Sonuç ilan satırında saklanır; metin değişmedikçe yeniden ücret ödenmez.
 */
import { getErrorMessage } from '@/lib/errors';
import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { getAuthoritativeSession } from '@/lib/auth-server';
import { checkRateLimit } from '@/lib/request-rate-limit';
import { reviewEtsyListing } from '@/lib/etsy-listing-seo';

export const maxDuration = 300;
const MAX_PER_REQUEST = 5;

export async function POST(req: Request) {
  try {
    const session = await getAuthoritativeSession();
    if (!session) return NextResponse.json({ success: false, error: 'Oturum açmanız gerekiyor.' }, { status: 401 });

    const { listingIds } = await req.json().catch(() => ({}));
    const targetIds = Array.from(new Set((Array.isArray(listingIds) ? listingIds : []).filter(Boolean).map(String)));
    if (targetIds.length === 0) return NextResponse.json({ success: false, error: 'Değerlendirilecek ilan seçilmedi.' }, { status: 400 });
    if (targetIds.length > MAX_PER_REQUEST) return NextResponse.json({ success: false, error: `Tek istekte en fazla ${MAX_PER_REQUEST} ilan değerlendirilebilir.` }, { status: 400 });

    const rateLimit = await checkRateLimit(`ai:etsy-review:${session.id}`, 40, 10 * 60_000);
    if (!rateLimit.allowed) {
      return NextResponse.json({ success: false, error: 'Yapay zekâ değerlendirme limiti aşıldı. Biraz sonra tekrar deneyin.' }, {
        status: 429,
        headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) },
      });
    }

    const listings = await sql`SELECT * FROM user_etsy_listings WHERE user_id = ${session.id} AND listing_id = ANY(${targetIds})`;
    const results: Array<Record<string, unknown>> = [];
    const errors: string[] = [];
    for (const listing of listings) {
      try {
        const { evaluation } = await reviewEtsyListing(session.id, listing);
        results.push({ listingId: String(listing.listing_id), seoScore: evaluation.score, seoEvaluation: evaluation });
      } catch (err) {
        console.error(`[AI review] Listing ${listing.listing_id} failed:`, err);
        errors.push(`İlan #${listing.listing_id}: ${getErrorMessage(err)}`);
      }
    }
    return NextResponse.json({ success: results.length > 0, results, errors: errors.length > 0 ? errors : undefined, error: results.length === 0 ? errors[0] : undefined });
  } catch (error) {
    console.error('[AI review] Request failed:', error);
    return NextResponse.json({ success: false, error: getErrorMessage(error) }, { status: 500 });
  }
}

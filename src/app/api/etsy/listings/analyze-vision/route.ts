/**
 * POST /api/etsy/listings/analyze-vision — Etsy ilanlarının kapak görselini yapay zekâyla analiz eder
 * (tasarım analiziyle aynı talimat) ve SEO puanını günceller. Body: { listingId } veya { listingIds } (en fazla 10).
 */
import { getErrorMessage } from '@/lib/errors';
import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { getAuthoritativeSession } from '@/lib/auth-server';
import { checkRateLimit } from '@/lib/request-rate-limit';
import { analyzeListingVision, reevaluateListing } from '@/lib/etsy-listing-seo';

export const maxDuration = 120;

export async function POST(req: Request) {
  try {
    const session = await getAuthoritativeSession();
    if (!session) return NextResponse.json({ success: false, error: 'Oturum açmanız gerekiyor.' }, { status: 401 });

    const rateLimit = await checkRateLimit(`ai:etsy-vision:${session.id}`, 10, 10 * 60_000);
    if (!rateLimit.allowed) {
      return NextResponse.json({ success: false, error: 'Etsy Vision AI analiz limiti aşıldı.' }, {
        status: 429,
        headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) },
      });
    }

    const { listingId, listingIds } = await req.json().catch(() => ({}));
    const targetIds = Array.from(new Set([listingId, ...(Array.isArray(listingIds) ? listingIds : [])].filter(Boolean).map(String)));
    if (targetIds.length === 0) return NextResponse.json({ success: false, error: 'Analiz edilecek listing ID belirtilmedi.' }, { status: 400 });
    if (targetIds.length > 10) return NextResponse.json({ success: false, error: 'Tek istekte en fazla 10 listing analiz edilebilir.' }, { status: 400 });

    const listings = await sql`SELECT * FROM user_etsy_listings WHERE user_id = ${session.id} AND listing_id = ANY(${targetIds})`;
    if (listings.length === 0) return NextResponse.json({ success: false, error: 'Belirtilen ilanlar veritabanında bulunamadı.' }, { status: 404 });

    const results: Array<Record<string, unknown>> = [];
    const errors: string[] = [];
    for (const listing of listings) {
      try {
        const visionAnalysis = await analyzeListingVision(session.id, listing);
        const evaluation = await reevaluateListing(session.id, { ...listing, vision_analysis: visionAnalysis });
        results.push({ listingId: String(listing.listing_id), visionAnalysis, seoScore: evaluation.score, seoEvaluation: evaluation });
      } catch (err) {
        console.error(`Vision analysis error on listing ${listing.listing_id}:`, err);
        errors.push(`İlan #${listing.listing_id}: ${getErrorMessage(err)}`);
      }
    }
    return NextResponse.json({ success: true, analyzedCount: results.length, results, errors: errors.length > 0 ? errors : undefined });
  } catch (error) {
    console.error('Vision Analyze API Error:', error);
    return NextResponse.json({ success: false, error: getErrorMessage(error) }, { status: 500 });
  }
}

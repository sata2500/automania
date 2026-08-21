import { NextResponse } from 'next/server';
import sql, { ensureKeywordPoolColumns } from '@/lib/db';
import { requireAdmin } from '@/lib/auth-server';
import { consumeRateLimit } from '@/lib/request-rate-limit';

export async function POST(req: Request) {
  try {
    const session = await requireAdmin();
    if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const rateLimit = consumeRateLimit(`admin:keywords:bulk-update:${session.id}`, 10, 10 * 60_000);
    if (!rateLimit.allowed) {
      return NextResponse.json({ success: false, error: 'Toplu keyword güncelleme limiti aşıldı.' }, {
        status: 429,
        headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) },
      });
    }

    await ensureKeywordPoolColumns();
    const body = await req.json();
    const { results } = body;

    if (!results || !Array.isArray(results) || results.length === 0 || results.length > 100) {
      return NextResponse.json({ success: false, error: '1–100 arası sonuç verisi gönderilmelidir.' }, { status: 400 });
    }

    let updatedCount = 0;
    for (const item of results) {
      await sql`
        UPDATE keyword_pool 
        SET 
          etsy_score = ${item.opportunityScore},
          opportunity_score = ${item.opportunityScore},
          total_listings = ${item.totalListings},
          competition_level = ${item.competitionLevel},
          bestseller_count = ${item.bestsellerCount},
          is_etsy_suggested = ${item.isEtsySuggested},
          autocomplete_rank = ${item.autocompleteRank},
          char_length = ${item.charLength},
          tag_eligible = ${item.tagEligible},
          avg_price = ${item.avgPrice},
          last_scrape_error = ${item.scrapeError},
          last_evaluated_at = CURRENT_TIMESTAMP
        WHERE id = ${item.id} OR keyword = ${item.keyword}
      `;
      updatedCount++;
    }

    return NextResponse.json({ success: true, updatedCount });
  } catch (error) {
    console.error('[Keywords Bulk Update] Request failed:', error instanceof Error ? error.message : 'unknown error');
    return NextResponse.json({ success: false, error: 'Toplu keyword güncellemesi başarısız oldu.' }, { status: 500 });
  }
}

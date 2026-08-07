import { NextResponse } from 'next/server';
import sql, { ensureKeywordPoolColumns } from '@/lib/db';

export async function POST(req: Request) {
  try {
    await ensureKeywordPoolColumns();
    const body = await req.json();
    const { results } = body;

    if (!results || !Array.isArray(results) || results.length === 0) {
      return NextResponse.json({ success: false, error: 'Güncellenecek sonuç verisi bulunamadı.' }, { status: 400 });
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
  } catch (error: any) {
    console.error('Bulk Update API Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

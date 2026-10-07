import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { getAuthoritativeSession } from '@/lib/auth-server';
import { EvaluatedKeyword } from '@/types/pod';

export async function POST(req: Request) {
  try {
    const session = await getAuthoritativeSession();
    // Allow both guest sessions and authenticated users to read keyword metrics

    const body = await req.json();
    const keywords: string[] = Array.isArray(body?.keywords)
      ? body.keywords.map((k: string) => String(k).toLowerCase().trim()).filter(Boolean)
      : [];

    if (keywords.length === 0) {
      return NextResponse.json({ success: true, keywords: [] });
    }

    const uniqueKeywords = Array.from(new Set(keywords));

    const rows = await sql`
      SELECT 
        id, 
        keyword, 
        etsy_score, 
        opportunity_score, 
        total_listings, 
        competition_level, 
        bestseller_count, 
        is_etsy_suggested, 
        autocomplete_rank, 
        avg_price, 
        char_length, 
        tag_eligible, 
        raw_metrics,
        last_scrape_error,
        last_evaluated_at
      FROM keyword_pool
      WHERE LOWER(keyword) = ANY(${uniqueKeywords})
    ` as unknown as EvaluatedKeyword[];

    return NextResponse.json({
      success: true,
      keywords: rows || [],
    });
  } catch (err: unknown) {
    console.error('[Keyword Lookup] Error:', err instanceof Error ? err.message : 'unknown error');
    return NextResponse.json({ success: false, keywords: [] }, { status: 500 });
  }
}

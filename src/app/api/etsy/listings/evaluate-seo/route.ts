import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { getAuthoritativeSession } from '@/lib/auth-server';
import { evaluateEtsyListingSeo } from '@/lib/etsy-seo-evaluator';

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const session = await getAuthoritativeSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Oturum açmanız gerekiyor.' }, { status: 401 });
    }

    const body = await req.json();
    const { listingId, listingIds, all = false } = body;

    let listings: any[] = [];

    if (all) {
      listings = await sql`
        SELECT * FROM user_etsy_listings 
        WHERE user_id = ${session.id}
      `;
    } else {
      const targetIds: string[] = [];
      if (listingId) targetIds.push(String(listingId));
      if (Array.isArray(listingIds)) {
        for (const id of listingIds) {
          if (id && !targetIds.includes(String(id))) targetIds.push(String(id));
        }
      }

      if (targetIds.length === 0) {
        return NextResponse.json({ success: false, error: 'Değerlendirilecek listing ID belirtilmedi.' }, { status: 400 });
      }

      listings = await sql`
        SELECT * FROM user_etsy_listings 
        WHERE user_id = ${session.id} AND listing_id = ANY(${targetIds as any})
      `;
    }

    if (listings.length === 0) {
      return NextResponse.json({ success: false, error: 'Değerlendirilecek ilan bulunamadı.' }, { status: 404 });
    }

    // Load keyword pool metrics for high-accuracy evaluation
    const keywordPoolRows = await sql`
      SELECT keyword, opportunity_score, etsy_score, total_listings, bestseller_count, is_etsy_suggested 
      FROM keyword_pool
      WHERE opportunity_score > 0 OR etsy_score > 0
    `;

    const results: any[] = [];

    for (const item of listings) {
      const listingIdStr = String(item.listing_id);
      const tags = Array.isArray(item.tags) ? item.tags : (typeof item.tags === 'string' ? JSON.parse(item.tags) : []);
      const vision = typeof item.vision_analysis === 'string' ? JSON.parse(item.vision_analysis) : (item.vision_analysis || {});

      const evaluation = evaluateEtsyListingSeo({
        title: item.title,
        description: item.description,
        tags,
        visionAnalysis: vision,
        keywordPoolRows
      });

      await sql`
        UPDATE user_etsy_listings 
        SET 
          seo_score = ${evaluation.score},
          seo_evaluation = ${JSON.stringify(evaluation)}::jsonb,
          updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ${session.id} AND listing_id = ${listingIdStr}
      `;

      results.push({
        listingId: listingIdStr,
        seoScore: evaluation.score,
        grade: evaluation.grade,
        evaluation
      });
    }

    return NextResponse.json({
      success: true,
      evaluatedCount: results.length,
      results
    });

  } catch (error: any) {
    console.error('SEO Evaluation API Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

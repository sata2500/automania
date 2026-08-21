import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { getAuthoritativeSession } from '@/lib/auth-server';
import { getValidEtsyToken } from '@/lib/etsy-token-manager';
import { evaluateEtsyListingSeo } from '@/lib/etsy-seo-evaluator';
import { consumeRateLimit } from '@/lib/request-rate-limit';

export const maxDuration = 60;

/**
 * PATCH /api/etsy/listings/update
 * Pushes updated Title, Description, Tags, or State directly to Etsy via Etsy OpenAPI v3.
 */
export async function PATCH(req: Request) {
  try {
    const session = await getAuthoritativeSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Oturum açmanız gerekiyor.' }, { status: 401 });
    }

    const rateLimit = consumeRateLimit(`etsy:update:${session.id}`, 20, 10 * 60_000);
    if (!rateLimit.allowed) {
      return NextResponse.json({ success: false, error: 'Etsy güncelleme limiti aşıldı.' }, {
        status: 429,
        headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) },
      });
    }

    const body = await req.json();
    const { listingId, title, description, tags, materials, state } = body;

    if (!listingId) {
      return NextResponse.json({ success: false, error: 'Güncellenecek Listing ID belirtilmedi.' }, { status: 400 });
    }
    if (state !== undefined && state !== 'draft') {
      return NextResponse.json({ success: false, error: 'Güvenlik nedeniyle listing state yalnızca draft olarak tutulabilir.' }, { status: 400 });
    }

    const tokenRes = await getValidEtsyToken(session.id);
    if (!tokenRes.success) {
      return NextResponse.json({ 
        success: false, 
        error: tokenRes.error || 'Etsy bağlantısı bulunamadı.' 
      }, { status: 400 });
    }

    const { access_token: etsyAccessToken, shop_id: etsyShopId, api_key: etsyApiKey, shared_secret: etsySharedSecret } = tokenRes;

    const headers = {
      'x-api-key': `${etsyApiKey}:${etsySharedSecret || ''}`,
      'Authorization': `Bearer ${etsyAccessToken}`,
      'Content-Type': 'application/json'
    };

    // Prepare Etsy update payload (only send provided non-null fields)
    const patchBody: Record<string, any> = {};

    if (typeof title === 'string' && title.trim()) {
      patchBody.title = title.trim().slice(0, 140);
    }

    if (typeof description === 'string' && description.trim()) {
      patchBody.description = description.trim();
    }

    if (Array.isArray(tags) && tags.length > 0) {
      patchBody.tags = tags
        .map(t => String(t).trim())
        .filter(t => t.length > 0 && t.length <= 20)
        .slice(0, 13);
    }

    if (Array.isArray(materials)) {
      patchBody.materials = materials.map(m => String(m).trim()).filter(Boolean);
    }

    if (state && ['active', 'draft', 'inactive'].includes(state)) {
      patchBody.state = state;
    }

    // Call Etsy API PATCH /shops/{shop_id}/listings/{listing_id}
    const etsyUrl = `https://openapi.etsy.com/v3/application/shops/${etsyShopId}/listings/${listingId}`;
    const etsyRes = await fetch(etsyUrl, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(patchBody)
    });

    if (!etsyRes.ok) {
      const errText = await etsyRes.text();
      console.error(`Etsy update error (${etsyRes.status}):`, errText);
      return NextResponse.json({ 
        success: false, 
        error: `Etsy API Güncelleme Hatası (${etsyRes.status}): ${errText}` 
      }, { status: 500 });
    }

    const updatedEtsyData = await etsyRes.json();

    // Fetch existing listing from DB to get vision analysis and keyword pool
    const existingRows = await sql`
      SELECT * FROM user_etsy_listings 
      WHERE user_id = ${session.id} AND listing_id = ${String(listingId)}
      LIMIT 1
    `;

    const vision = existingRows.length > 0 ? (typeof existingRows[0].vision_analysis === 'string' ? JSON.parse(existingRows[0].vision_analysis) : (existingRows[0].vision_analysis || {})) : {};

    const keywordPoolRows = await sql`
      SELECT keyword, opportunity_score, etsy_score, total_listings, bestseller_count, is_etsy_suggested 
      FROM keyword_pool
      WHERE opportunity_score > 0 OR etsy_score > 0
    `;

    // Re-evaluate SEO with new live data
    const finalTitle = patchBody.title || (existingRows[0]?.title ?? '');
    const finalDesc = patchBody.description || (existingRows[0]?.description ?? '');
    const finalTags = patchBody.tags || (existingRows[0]?.tags ?? []);

    const newEvaluation = evaluateEtsyListingSeo({
      title: finalTitle,
      description: finalDesc,
      tags: finalTags,
      visionAnalysis: vision,
      keywordPoolRows
    });

    // Update database cache
    await sql`
      UPDATE user_etsy_listings 
      SET 
        title = ${finalTitle},
        description = ${finalDesc},
        tags = ${JSON.stringify(finalTags)}::jsonb,
        state = COALESCE(${patchBody.state || null}, state),
        seo_score = ${newEvaluation.score},
        seo_evaluation = ${JSON.stringify(newEvaluation)}::jsonb,
        updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ${session.id} AND listing_id = ${String(listingId)}
    `;

    return NextResponse.json({
      success: true,
      message: 'İlan Etsy mağazanızda ve veritabanında başarıyla güncellendi!',
      listing: {
        listingId,
        title: finalTitle,
        description: finalDesc,
        tags: finalTags,
        state: patchBody.state || existingRows[0]?.state,
        seoScore: newEvaluation.score,
        seoEvaluation: newEvaluation
      },
      etsyResponse: updatedEtsyData
    });

  } catch (error) {
    console.error('[Etsy Listing Update] Request failed:', error instanceof Error ? error.message : 'unknown error');
    return NextResponse.json({ success: false, error: 'Etsy listing güncellenemedi.' }, { status: 500 });
  }
}

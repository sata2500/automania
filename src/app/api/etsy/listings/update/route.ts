import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { getAuthoritativeSession } from '@/lib/auth-server';
import { getValidEtsyToken } from '@/lib/etsy-token-manager';
import { evaluateEtsyListingSeo } from '@/lib/etsy-seo-evaluator';
import { checkRateLimit } from '@/lib/request-rate-limit';
import { etsyFetch, readEtsyError } from '@/lib/etsy-api';
import { sanitizeEtsyTags } from '@/lib/etsy-format';
import { hasExplicitLivePublishConfirmation, isLivePublishEnabled } from '@/lib/etsy-publish-mode';

export const maxDuration = 60;

/**
 * PATCH /api/etsy/listings/update
 * Bir ilanın başlık, açıklama ve etiketlerini Etsy'de günceller. İlan durumu yalnızca
 * açıkça istendiğinde değiştirilir:
 *  - 'inactive' (yayından kaldır): `confirmStateChange: true` gerekir.
 *  - 'active' (yayına al): canlı yayının sunucuda açık olması ve "YAYINLA" onayı gerekir.
 * Etsy, updateListing ile ilanın taslağa çekilmesine izin vermez.
 */
export async function PATCH(req: Request) {
  try {
    const session = await getAuthoritativeSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Oturum açmanız gerekiyor.' }, { status: 401 });
    }

    const rateLimit = await checkRateLimit(`etsy:update:${session.id}`, 20, 10 * 60_000);
    if (!rateLimit.allowed) {
      return NextResponse.json({ success: false, error: 'Etsy güncelleme limiti aşıldı.' }, {
        status: 429,
        headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) },
      });
    }

    const body = await req.json().catch(() => ({}));
    const { listingId, title, description, tags, materials, state } = body as Record<string, unknown>;

    if (!listingId || !/^\d+$/.test(String(listingId))) {
      return NextResponse.json({ success: false, error: 'Güncellenecek Listing ID belirtilmedi.' }, { status: 400 });
    }

    if (state !== undefined && state !== null) {
      if (state !== 'active' && state !== 'inactive') {
        return NextResponse.json({
          success: false,
          error: 'İlan durumu yalnızca "Aktif" veya "Pasif" yapılabilir (Etsy, yayındaki bir ilanın taslağa çekilmesine izin vermez).',
        }, { status: 400 });
      }
      if (state === 'inactive' && body.confirmStateChange !== true) {
        return NextResponse.json({ success: false, error: 'İlanı yayından kaldırmak için onay gerekiyor.' }, { status: 400 });
      }
      if (state === 'active') {
        if (!isLivePublishEnabled(process.env.ETSY_LIVE_PUBLISH_ENABLED)) {
          return NextResponse.json({ success: false, error: 'Canlı yayın sunucu ayarlarında kapalı.' }, { status: 403 });
        }
        if (!hasExplicitLivePublishConfirmation(body)) {
          return NextResponse.json({ success: false, error: 'İlanı yayına almak için "YAYINLA" onayı gerekiyor.' }, { status: 400 });
        }
      }
    }

    const tokenRes = await getValidEtsyToken(session.id);
    if (!tokenRes.success) {
      return NextResponse.json({
        success: false,
        error: tokenRes.error || 'Etsy bağlantısı bulunamadı.'
      }, { status: 400 });
    }

    const { access_token: etsyAccessToken, shop_id: etsyShopId, api_key: etsyApiKey, shared_secret: etsySharedSecret } = tokenRes;

    // Etsy updateListing gövdesi application/x-www-form-urlencoded'dır; etiketler virgülle ayrılır.
    const patchBody = new URLSearchParams();
    const applied: { title?: string; description?: string; tags?: string[] } = {};

    if (typeof title === 'string' && title.trim()) {
      applied.title = title.trim().slice(0, 140);
      patchBody.set('title', applied.title);
    }

    if (typeof description === 'string' && description.trim()) {
      applied.description = description.trim();
      patchBody.set('description', applied.description);
    }

    if (Array.isArray(tags)) {
      const cleanTags = sanitizeEtsyTags(tags);
      if (cleanTags.length === 0) {
        return NextResponse.json({ success: false, error: 'Geçerli en az bir etiket gerekiyor (en fazla 20 karakter, özel karakter içermeden).' }, { status: 400 });
      }
      applied.tags = cleanTags;
      patchBody.set('tags', cleanTags.join(','));
    }

    if (Array.isArray(materials)) {
      for (const material of materials.map((m) => String(m).trim()).filter(Boolean)) patchBody.append('materials', material);
    }

    if (state === 'active' || state === 'inactive') {
      patchBody.set('state', state);
    }

    if ([...patchBody.keys()].length === 0) {
      return NextResponse.json({ success: false, error: 'Güncellenecek bir alan gönderilmedi.' }, { status: 400 });
    }

    const etsyRes = await etsyFetch(`https://openapi.etsy.com/v3/application/shops/${etsyShopId}/listings/${listingId}`, {
      method: 'PATCH',
      headers: {
        'x-api-key': `${etsyApiKey}:${etsySharedSecret || ''}`,
        'Authorization': `Bearer ${etsyAccessToken}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: patchBody,
    });

    if (!etsyRes.ok) {
      const message = await readEtsyError(etsyRes, 'Etsy ilanı güncellemeyi reddetti');
      console.error('[Etsy Listing Update]', message);
      return NextResponse.json({ success: false, error: message }, { status: etsyRes.status === 429 ? 429 : 502 });
    }

    const updatedEtsyData = await etsyRes.json().catch(() => ({}));

    // Fetch existing listing from DB to get vision analysis and keyword pool
    const existingRows = await sql`
      SELECT * FROM user_etsy_listings
      WHERE user_id = ${session.id} AND listing_id = ${String(listingId)}
      LIMIT 1
    `;

    const vision = existingRows.length > 0 ? (typeof existingRows[0].vision_analysis === 'string' ? JSON.parse(existingRows[0].vision_analysis) : (existingRows[0].vision_analysis || {})) : {};

    const keywordPoolRows = await sql`
      SELECT keyword, opportunity_score, etsy_score, total_listings, competition_level, bestseller_count, is_etsy_suggested, last_evaluated_at
      FROM keyword_pool
      WHERE opportunity_score > 0 OR etsy_score > 0
    `;

    // Re-evaluate SEO with new live data
    const finalTitle = applied.title ?? (existingRows[0]?.title ?? '');
    const finalDesc = applied.description ?? (existingRows[0]?.description ?? '');
    const finalTags = applied.tags ?? (existingRows[0]?.tags ?? []);
    const finalState = typeof state === 'string' ? state : existingRows[0]?.state;

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
        state = COALESCE(${typeof state === 'string' ? state : null}, state),
        seo_score = ${newEvaluation.score},
        seo_evaluation = ${JSON.stringify(newEvaluation)}::jsonb,
        updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ${session.id} AND listing_id = ${String(listingId)}
    `;

    return NextResponse.json({
      success: true,
      message: 'İlan Etsy mağazanızda güncellendi.',
      listing: {
        listingId,
        title: finalTitle,
        description: finalDesc,
        tags: finalTags,
        state: finalState,
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

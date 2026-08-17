import { NextResponse } from 'next/server';
import sql, { ensureUserEtsyListingsTable } from '@/lib/db';
import { getSession } from '@/lib/auth-server';
import { getValidEtsyToken } from '@/lib/etsy-token-manager';
import { evaluateEtsyListingSeo } from '@/lib/etsy-seo-evaluator';

export const maxDuration = 60;

/**
 * GET /api/etsy/listings
 * Reads cached listings from PostgreSQL database with filtering, search, and stats summary.
 */
export async function GET(req: Request) {
  try {
    await ensureUserEtsyListingsTable();

    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Oturum açmanız gerekiyor.' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const listingId = searchParams.get('listing_id');
    const search = searchParams.get('search')?.trim().toLowerCase() || '';
    const stateFilter = searchParams.get('state') || 'all'; // all, active, draft, inactive
    const scoreFilter = searchParams.get('scoreFilter') || 'all'; // all, critical (<50), warning (50-74), good (75-89), excellent (90+)
    const visionFilter = searchParams.get('visionFilter') || 'all'; // all, analyzed, not_analyzed
    const sortBy = searchParams.get('sort') || 'newest';

    // 1. Single listing detail query
    if (listingId) {
      const rows = await sql`
        SELECT * FROM user_etsy_listings 
        WHERE user_id = ${session.id} AND listing_id = ${listingId}
        LIMIT 1
      `;

      if (rows.length === 0) {
        return NextResponse.json({ success: false, error: 'İlan veritabanında bulunamadı.' }, { status: 404 });
      }

      return NextResponse.json({ success: true, listing: rows[0] });
    }

    // 2. Fetch all user listings from PostgreSQL
    const allRows = await sql`
      SELECT * FROM user_etsy_listings 
      WHERE user_id = ${session.id}
      ORDER BY updated_at DESC
    `;

    // Compute store overall stats
    const total = allRows.length;
    let activeCount = 0;
    let draftCount = 0;
    let inactiveCount = 0;
    let analyzedCount = 0;
    let totalScoreSum = 0;
    let lastSyncedAt: string | null = null;

    for (const r of allRows) {
      if (r.state === 'active') activeCount++;
      else if (r.state === 'draft') draftCount++;
      else inactiveCount++;

      const va = typeof r.vision_analysis === 'string' ? JSON.parse(r.vision_analysis) : (r.vision_analysis || {});
      if (va && (va.primarySubject || va.description || va.analyzedAt)) {
        analyzedCount++;
      }

      totalScoreSum += Number(r.seo_score || 0);

      if (r.last_synced_at) {
        if (!lastSyncedAt || new Date(r.last_synced_at) > new Date(lastSyncedAt)) {
          lastSyncedAt = r.last_synced_at;
        }
      }
    }

    const avgScore = total > 0 ? Math.round(totalScoreSum / total) : 0;

    // Filter in-memory for fast instantaneous client responsiveness
    let filtered = allRows.filter((r: any) => {
      // Search
      if (search) {
        const titleMatch = (r.title || '').toLowerCase().includes(search);
        const idMatch = String(r.listing_id || '').includes(search);
        const tagsArr = Array.isArray(r.tags) ? r.tags : (typeof r.tags === 'string' ? JSON.parse(r.tags) : []);
        const tagMatch = tagsArr.some((t: string) => String(t).toLowerCase().includes(search));
        if (!titleMatch && !idMatch && !tagMatch) return false;
      }

      // State
      if (stateFilter !== 'all' && r.state !== stateFilter) {
        return false;
      }

      // Score filter
      const score = Number(r.seo_score || 0);
      if (scoreFilter === 'critical' && score >= 50) return false;
      if (scoreFilter === 'warning' && (score < 50 || score >= 75)) return false;
      if (scoreFilter === 'good' && (score < 75 || score >= 90)) return false;
      if (scoreFilter === 'excellent' && score < 90) return false;

      // Vision filter
      const va = typeof r.vision_analysis === 'string' ? JSON.parse(r.vision_analysis) : (r.vision_analysis || {});
      const hasVision = !!(va && (va.primarySubject || va.description || va.analyzedAt));
      if (visionFilter === 'analyzed' && !hasVision) return false;
      if (visionFilter === 'not_analyzed' && hasVision) return false;

      return true;
    });

    // Sorting
    filtered.sort((a: any, b: any) => {
      if (sortBy === 'score_desc') return (Number(b.seo_score) || 0) - (Number(a.seo_score) || 0);
      if (sortBy === 'score_asc') return (Number(a.seo_score) || 0) - (Number(b.seo_score) || 0);
      if (sortBy === 'views_desc') return (Number(b.views) || 0) - (Number(a.views) || 0);
      if (sortBy === 'favorers_desc') return (Number(b.num_favorers) || 0) - (Number(a.num_favorers) || 0);
      if (sortBy === 'title_asc') return (a.title || '').localeCompare(b.title || '');
      // newest default
      return new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime();
    });

    return NextResponse.json({
      success: true,
      listings: filtered,
      stats: {
        total,
        active: activeCount,
        draft: draftCount,
        inactive: inactiveCount,
        avgScore,
        analyzedCount,
        lastSyncedAt
      }
    });

  } catch (error: any) {
    console.error('Etsy Listings Fetch Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

/**
 * Helper to fetch all paginated listings for a specific state from Etsy OpenAPI v3.
 * Supports smart delta termination based on updated timestamp.
 */
async function fetchAllListingsForState(
  shopId: string,
  state: string,
  headers: any,
  mode: 'smart' | 'full',
  existingMap: Map<string, any>,
  maxTimestampInDb: number
): Promise<{ listings: any[]; totalInEtsy: number }> {
  const listings: any[] = [];
  let offset = 0;
  const limit = 100;
  let totalInEtsy = 0;
  let hasMore = true;

  while (hasMore) {
    const url = `https://openapi.etsy.com/v3/application/shops/${shopId}/listings?state=${state}&limit=${limit}&offset=${offset}&sort_on=updated&sort_order=desc&includes=images`;
    const res = await fetch(url, { headers });
    
    if (!res.ok) {
      const errText = await res.text();
      console.warn(`Etsy fetch page warning for state ${state}, offset ${offset} (${res.status}):`, errText);
      break;
    }

    const data = await res.json();
    totalInEtsy = Number(data.count) || totalInEtsy;
    const pageResults = Array.isArray(data.results) ? data.results : [];
    
    if (pageResults.length === 0) break;

    listings.push(...pageResults);

    // Smart Delta optimization:
    // If in smart mode, we have prior records in DB, and all items in this page are already in DB with same or newer updated timestamp,
    // we can terminate early because Etsy returns listings sorted by updated desc (older listings follow).
    if (mode === 'smart' && maxTimestampInDb > 0 && offset > 0) {
      const allOlderAndCached = pageResults.every((item: any) => {
        const itemTs = Number(item.updated_timestamp || item.last_modified_timestamp || item.state_timestamp || 0);
        const ex = existingMap.get(String(item.listing_id));
        return ex && Number(ex.etsy_updated_timestamp || 0) >= itemTs;
      });

      if (allOlderAndCached) {
        break; // Reached already-synced history
      }
    }

    offset += pageResults.length;
    if (offset >= (data.count || 0) || pageResults.length < limit) {
      hasMore = false;
    }
  }

  return { listings, totalInEtsy };
}

/**
 * POST /api/etsy/listings
 * Triggers on-demand synchronization from Etsy API into PostgreSQL DB cache.
 * Accepts mode: 'smart' (default - delta sync) | 'full' (complete pagination across all states).
 */
export async function POST(req: Request) {
  try {
    await ensureUserEtsyListingsTable();

    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Oturum açmanız gerekiyor.' }, { status: 401 });
    }

    let mode: 'smart' | 'full' = 'smart';
    try {
      const body = await req.json();
      if (body?.mode === 'full' || body?.mode === 'smart') {
        mode = body.mode;
      }
    } catch {}

    const tokenRes = await getValidEtsyToken(session.id);
    if (!tokenRes.success) {
      return NextResponse.json({ 
        success: false, 
        error: tokenRes.error || 'Etsy bağlantısı bulunamadı. Lütfen Etsy hesabınızı bağlayın.' 
      }, { status: 400 });
    }

    const { access_token: etsyAccessToken, shop_id: etsyShopId, api_key: etsyApiKey, shared_secret: etsySharedSecret } = tokenRes;

    if (!etsyShopId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Etsy Mağaza ID (Shop ID) bulunamadı. Lütfen Etsy bağlantınızı kontrol edin.' 
      }, { status: 400 });
    }

    const headers = {
      'x-api-key': `${etsyApiKey}:${etsySharedSecret || ''}`,
      'Authorization': `Bearer ${etsyAccessToken}`
    };

    // 1. Fetch existing DB listings for this user to compare timestamps and preserve previous Vision analysis & AI optimizations
    const existingDbRows = await sql`
      SELECT id, listing_id, title, description, tags, etsy_updated_timestamp, seo_score, seo_evaluation, vision_analysis, ai_optimized_title, ai_optimized_description, ai_optimized_tags, ai_optimized_at 
      FROM user_etsy_listings 
      WHERE user_id = ${session.id}
    `;

    let maxTimestampInDb = 0;
    const existingMap = new Map<string, any>();
    for (const row of existingDbRows) {
      existingMap.set(String(row.listing_id), row);
      const ts = Number(row.etsy_updated_timestamp || 0);
      if (ts > maxTimestampInDb) maxTimestampInDb = ts;
    }

    // 2. Fetch paginated listings from Etsy for Active, Draft, and Inactive states
    const [activeData, draftData, inactiveData] = await Promise.all([
      fetchAllListingsForState(String(etsyShopId), 'active', headers, mode, existingMap, maxTimestampInDb),
      fetchAllListingsForState(String(etsyShopId), 'draft', headers, mode, existingMap, maxTimestampInDb),
      fetchAllListingsForState(String(etsyShopId), 'inactive', headers, mode, existingMap, maxTimestampInDb),
    ]);

    const rawEtsyListings = [
      ...activeData.listings,
      ...draftData.listings,
      ...inactiveData.listings
    ];

    if (rawEtsyListings.length === 0 && existingDbRows.length === 0) {
      return NextResponse.json({
        success: true,
        count: 0,
        message: 'Etsy mağazasında herhangi bir ilan bulunamadı veya Etsy API yanıt vermedi.'
      });
    }

    // 3. Load keyword pool rows for SEO score evaluation of new / changed listings
    const keywordPoolRows = await sql`
      SELECT keyword, opportunity_score, etsy_score, total_listings, bestseller_count, is_etsy_suggested 
      FROM keyword_pool
      WHERE opportunity_score > 0 OR etsy_score > 0
    `;

    // 4. Transform and Upsert each listing
    let newOrUpdatedCount = 0;
    let unchangedCount = 0;

    for (const item of rawEtsyListings) {
      const listingIdStr = String(item.listing_id);
      const compositeId = `${session.id}_${listingIdStr}`;
      const existing = existingMap.get(listingIdStr);

      const itemUpdatedTs = Number(item.updated_timestamp || item.last_modified_timestamp || item.state_timestamp || item.creation_timestamp || 0);
      const title = item.title || '';
      const description = item.description || '';
      const tags = Array.isArray(item.tags) ? item.tags : [];
      const materials = Array.isArray(item.materials) ? item.materials : [];
      const state = item.state || 'active';
      const quantity = typeof item.quantity === 'number' ? item.quantity : 999;
      const views = typeof item.views === 'number' ? item.views : 0;
      const numFavorers = typeof item.num_favorers === 'number' ? item.num_favorers : 0;
      const url = item.url || `https://www.etsy.com/listing/${listingIdStr}`;
      const taxonomyId = item.taxonomy_id || null;

      // Extract price
      let price = 0;
      let currencyCode = 'USD';
      if (item.price && typeof item.price === 'object') {
        const amount = Number(item.price.amount) || 0;
        const divisor = Number(item.price.divisor) || 100;
        price = amount / divisor;
        currencyCode = item.price.currency_code || 'USD';
      }

      // Extract images
      const images = Array.isArray(item.images) ? item.images : [];
      let primaryImageUrl = item.images?.[0]?.url_570xN || item.images?.[0]?.url_fullxfull || item.images?.[0]?.url_170x135 || null;

      // Preserve existing vision analysis and AI optimization
      const visionAnalysis = existing?.vision_analysis || {};
      const aiOptimizedTitle = existing?.ai_optimized_title || null;
      const aiOptimizedDesc = existing?.ai_optimized_description || null;
      const aiOptimizedTags = existing?.ai_optimized_tags || [];
      const aiOptimizedAt = existing?.ai_optimized_at || null;

      // Check if title, tags, or description changed vs existing DB cache
      const existingTags = Array.isArray(existing?.tags) ? existing.tags : (typeof existing?.tags === 'string' ? JSON.parse(existing.tags) : []);
      const tagsMatch = JSON.stringify(tags) === JSON.stringify(existingTags);
      const isContentIdentical = existing && existing.title === title && existing.description === description && tagsMatch;

      let seoScore = Number(existing?.seo_score || 0);
      let seoEvaluation = existing?.seo_evaluation || {};

      // Only run SEO calculation if content changed or it is a new listing
      if (!isContentIdentical || !existing?.seo_evaluation || Object.keys(existing.seo_evaluation).length === 0) {
        const evaluation = evaluateEtsyListingSeo({
          title,
          description,
          tags,
          visionAnalysis: typeof visionAnalysis === 'string' ? JSON.parse(visionAnalysis) : visionAnalysis,
          keywordPoolRows
        });
        seoScore = evaluation.score;
        seoEvaluation = evaluation;
        newOrUpdatedCount++;
      } else {
        unchangedCount++;
      }

      // Upsert into user_etsy_listings
      await sql`
        INSERT INTO user_etsy_listings (
          id,
          user_id,
          listing_id,
          shop_id,
          title,
          description,
          tags,
          materials,
          price,
          currency_code,
          quantity,
          state,
          url,
          views,
          num_favorers,
          images,
          primary_image_url,
          taxonomy_id,
          vision_analysis,
          seo_score,
          seo_evaluation,
          ai_optimized_title,
          ai_optimized_description,
          ai_optimized_tags,
          ai_optimized_at,
          etsy_updated_timestamp,
          last_synced_at,
          updated_at
        ) VALUES (
          ${compositeId},
          ${session.id},
          ${listingIdStr},
          ${String(etsyShopId)},
          ${title},
          ${description},
          ${JSON.stringify(tags)}::jsonb,
          ${JSON.stringify(materials)}::jsonb,
          ${price},
          ${currencyCode},
          ${quantity},
          ${state},
          ${url},
          ${views},
          ${numFavorers},
          ${JSON.stringify(images)}::jsonb,
          ${primaryImageUrl},
          ${taxonomyId},
          ${JSON.stringify(visionAnalysis)}::jsonb,
          ${seoScore},
          ${JSON.stringify(seoEvaluation)}::jsonb,
          ${aiOptimizedTitle},
          ${aiOptimizedDesc},
          ${JSON.stringify(aiOptimizedTags)}::jsonb,
          ${aiOptimizedAt ? new Date(aiOptimizedAt) : null},
          ${itemUpdatedTs},
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        )
        ON CONFLICT (id) DO UPDATE SET
          shop_id = EXCLUDED.shop_id,
          title = EXCLUDED.title,
          description = EXCLUDED.description,
          tags = EXCLUDED.tags,
          materials = EXCLUDED.materials,
          price = EXCLUDED.price,
          currency_code = EXCLUDED.currency_code,
          quantity = EXCLUDED.quantity,
          state = EXCLUDED.state,
          url = EXCLUDED.url,
          views = EXCLUDED.views,
          num_favorers = EXCLUDED.num_favorers,
          images = EXCLUDED.images,
          primary_image_url = EXCLUDED.primary_image_url,
          taxonomy_id = EXCLUDED.taxonomy_id,
          seo_score = EXCLUDED.seo_score,
          seo_evaluation = EXCLUDED.seo_evaluation,
          etsy_updated_timestamp = EXCLUDED.etsy_updated_timestamp,
          last_synced_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      `;
    }

    const totalCount = await sql`
      SELECT COUNT(*) as cnt FROM user_etsy_listings WHERE user_id = ${session.id}
    `;
    const finalTotal = Number(totalCount[0]?.cnt || 0);

    const message = mode === 'smart'
      ? `Akıllı senkronizasyon tamamlandı: Toplam ${finalTotal} ilan güncel. (${newOrUpdatedCount} yeni/güncellenen işlendi, ${unchangedCount} değişmeyen ilan korundu)`
      : `Tam senkronizasyon tamamlandı: Etsy mağazanızdaki tüm sayfalar taranarak toplam ${finalTotal} ilan veritabanına aktarıldı.`;

    return NextResponse.json({
      success: true,
      mode,
      totalListings: finalTotal,
      newOrUpdatedCount,
      unchangedCount,
      message
    });

  } catch (error: any) {
    console.error('Etsy Listings Sync Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

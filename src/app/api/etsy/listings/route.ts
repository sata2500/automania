import { getErrorMessage } from '@/lib/errors';
import { NextResponse } from 'next/server';
import sql, { type DbRow } from '@/lib/db';
import { getAuthoritativeSession } from '@/lib/auth-server';
import { getValidEtsyToken } from '@/lib/etsy-token-manager';
import { evaluateEtsyListingSeo, isCurrentSeoEvaluation, storedAiReview } from '@/lib/etsy-seo-evaluator';
import { etsyFetch, listingsToMarkRemoved } from '@/lib/etsy-api';

export const maxDuration = 120;

/** Etsy'nin getListingsByShop için tanıdığı tüm durumlar. Hepsi çekilmezse "mağazada yok" kararı verilemez. */
const ETSY_LISTING_STATES = ['active', 'draft', 'inactive', 'sold_out', 'expired'] as const;

/**
 * GET /api/etsy/listings
 * Reads cached listings from PostgreSQL database with filtering, search, and stats summary.
 */
export async function GET(req: Request) {
  try {

    const session = await getAuthoritativeSession();
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

    // 1. Single listing detail & inventory query
    if (listingId) {
      let inventory = null;
      // Envanter Etsy'den canlı çekilir; yalnızca ayrıntı görünümü gerekmiyorsa atlanabilir.
      const includeInventory = searchParams.get('inventory') !== 'false';
      if (includeInventory) try {
        const tokenRes = await getValidEtsyToken(session.id);
        if (tokenRes.success && tokenRes.access_token) {
          const { access_token: etsyAccessToken, api_key: etsyApiKey, shared_secret: etsySharedSecret } = tokenRes;
          const headers = {
            'x-api-key': `${etsyApiKey}:${etsySharedSecret || ''}`,
            'Authorization': `Bearer ${etsyAccessToken}`
          };
          const invRes = await fetch(`https://openapi.etsy.com/v3/application/listings/${listingId}/inventory`, {
            method: 'GET',
            headers,
            next: { revalidate: 0 }
          });
          if (invRes.ok) {
            inventory = await invRes.json();
          } else {
            console.warn(`[Etsy Listings] Inventory fetch returned ${invRes.status}:`, await invRes.text().catch(() => ''));
          }
        }
      } catch (invErr) {
        console.warn('[Etsy Listings] Inventory fetch exception:', getErrorMessage(invErr));
      }

      const rows = await sql`
        SELECT * FROM user_etsy_listings 
        WHERE user_id = ${session.id} AND listing_id = ${listingId}
        LIMIT 1
      `;

      if (rows.length === 0 && !inventory) {
        return NextResponse.json({ success: false, error: 'İlan bulunamadı.' }, { status: 404 });
      }

      return NextResponse.json({ 
        success: true, 
        listing: rows[0] || null,
        inventory
      });
    }

    // 2. Fetch lightweight listing summaries for the list view.
    // Heavy fields (description, materials, images, SEO/vision JSON) are fetched
    // on demand by the listing_id detail branch above to keep mobile/initial loads fast.
    const allRows = await sql`
      SELECT
        id,
        user_id,
        listing_id,
        shop_id,
        title,
        tags,
        price,
        currency_code,
        quantity,
        state,
        url,
        views,
        num_favorers,
        primary_image_url,
        taxonomy_id,
        vision_analysis,
        seo_score,
        -- "Analiz edildi": mevcut metin yapay zekâyla değerlendirildi (görsel + Etsy verisi + yapay zekâ)
        COALESCE(seo_evaluation->'confidence'->>'aiReviewed', 'false') = 'true' AS ai_analyzed,
        ai_optimized_title,
        ai_optimized_at,
        etsy_updated_timestamp,
        last_synced_at,
        created_at,
        updated_at
      FROM user_etsy_listings
      WHERE user_id = ${session.id} AND state <> 'removed'
      ORDER BY etsy_updated_timestamp DESC NULLS LAST
    `;

    // Compute store overall stats
    const total = allRows.length;
    let activeCount = 0;
    let draftCount = 0;
    let inactiveCount = 0;
    let otherCount = 0;
    let analyzedCount = 0;
    let totalScoreSum = 0;
    let activeScoreSum = 0;
    let totalViews = 0;
    let totalFavorites = 0;
    let lastSyncedAt: string | null = null;

    for (const r of allRows) {
      if (r.state === 'active') activeCount++;
      else if (r.state === 'draft') draftCount++;
      else if (r.state === 'inactive') inactiveCount++;
      else otherCount++; // sold_out, expired

      if (r.ai_analyzed) {
        analyzedCount++;
      }

      totalScoreSum += Number(r.seo_score || 0);
      if (r.state === 'active') activeScoreSum += Number(r.seo_score || 0);
      totalViews += Number(r.views || 0);
      totalFavorites += Number(r.num_favorers || 0);

      if (r.last_synced_at) {
        if (!lastSyncedAt || new Date(r.last_synced_at) > new Date(lastSyncedAt)) {
          lastSyncedAt = r.last_synced_at;
        }
      }
    }

    // Mağaza ortalaması satıştaki (aktif) ilanlardan hesaplanır; aktif ilan yoksa tüm ilanlardan.
    const avgScore = activeCount > 0
      ? Math.round(activeScoreSum / activeCount)
      : total > 0 ? Math.round(totalScoreSum / total) : 0;
    const now = Date.now();
    const lastSyncTime = lastSyncedAt ? new Date(lastSyncedAt).getTime() : 0;
    const hoursSinceLastSync = lastSyncTime > 0 ? (now - lastSyncTime) / (1000 * 60 * 60) : 999999;
    const isStale = total === 0 || !lastSyncedAt || hoursSinceLastSync >= 24;

    // Filter in-memory for fast instantaneous client responsiveness
    const filtered = allRows.filter((r) => {
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
      const analyzed = Boolean(r.ai_analyzed);
      if (visionFilter === 'analyzed' && !analyzed) return false;
      if (visionFilter === 'not_analyzed' && analyzed) return false;

      return true;
    });

    // Sorting
    filtered.sort((a, b) => {
      if (sortBy === 'score_desc') return (Number(b.seo_score) || 0) - (Number(a.seo_score) || 0);
      if (sortBy === 'score_asc') return (Number(a.seo_score) || 0) - (Number(b.seo_score) || 0);
      if (sortBy === 'views_desc') return (Number(b.views) || 0) - (Number(a.views) || 0);
      if (sortBy === 'views_asc') return (Number(a.views) || 0) - (Number(b.views) || 0);
      if (sortBy === 'favorers_desc') return (Number(b.num_favorers) || 0) - (Number(a.num_favorers) || 0);
      if (sortBy === 'favorers_asc') return (Number(a.num_favorers) || 0) - (Number(b.num_favorers) || 0);
      if (sortBy === 'price_desc') return (Number(b.price) || 0) - (Number(a.price) || 0);
      if (sortBy === 'price_asc') return (Number(a.price) || 0) - (Number(b.price) || 0);
      if (sortBy === 'title_asc') return (a.title || '').localeCompare(b.title || '');
      if (sortBy === 'title_desc') return (b.title || '').localeCompare(a.title || '');
      // "En yeni": ilanın Etsy'de son güncellendiği zaman (senkron zamanı değil).
      const etsyTime = (r: DbRow) => Number(r.etsy_updated_timestamp || 0) || new Date(r.created_at || 0).getTime() / 1000;
      if (sortBy === 'oldest') return etsyTime(a) - etsyTime(b);
      return etsyTime(b) - etsyTime(a);
    });

    return NextResponse.json({
      success: true,
      listings: filtered,
      stats: {
        total,
        active: activeCount,
        draft: draftCount,
        inactive: inactiveCount,
        other: otherCount,
        avgScore,
        totalViews,
        totalFavorites,
        analyzedCount,
        lastSyncedAt,
        hoursSinceLastSync: Math.round(hoursSinceLastSync * 10) / 10,
        isStale
      }
    });

  } catch (error) {
    console.error('Etsy Listings Fetch Error:', error);
    return NextResponse.json({ success: false, error: getErrorMessage(error) }, { status: 500 });
  }
}

/**
 * Helper to fetch all paginated listings for a specific state from Etsy OpenAPI v3.
 * Supports intelligent delta termination for large shops while ensuring complete sync for standard shops.
 */
/** Etsy OpenAPI v3 listing yanıtı (yalnızca kullanılan alanlar). */
type EtsyApiListing = {
  listing_id: number | string;
  updated_timestamp?: number;
  last_modified_timestamp?: number;
  state_timestamp?: number;
  // Etsy yanıtı çok sayıda isteğe bağlı alan içerir; yalnızca okunarak DB'ye eşlenir.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
};

async function fetchAllListingsForState(
  shopId: string,
  state: string,
  headers: Record<string, string>,
  mode: 'smart' | 'full',
  existingMap: Map<string, DbRow>,
  maxTimestampInDb: number
): Promise<{ listings: EtsyApiListing[]; totalInEtsy: number; complete: boolean; error?: string }> {
  const listings: EtsyApiListing[] = [];
  let offset = 0;
  const limit = 100;
  let totalInEtsy = 0;

  while (true) {
    const url = `https://openapi.etsy.com/v3/application/shops/${shopId}/listings?state=${state}&limit=${limit}&offset=${offset}&sort_on=updated&sort_order=desc&includes=images`;
    let res: Response;
    try {
      res = await etsyFetch(url, { headers });
    } catch (fetchError) {
      return { listings, totalInEtsy, complete: false, error: getErrorMessage(fetchError) };
    }

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.warn(`Etsy fetch page warning for state ${state}, offset ${offset} (${res.status}):`, errText.slice(0, 300));
      // Eksik sayfa: bu durumdaki ilanların tamamı görülmedi, "silindi" kararı verilemez.
      return { listings, totalInEtsy, complete: false, error: `HTTP ${res.status}` };
    }

    const data = await res.json();
    totalInEtsy = Number(data.count) || totalInEtsy;
    const pageResults: EtsyApiListing[] = Array.isArray(data.results) ? data.results : [];

    if (pageResults.length === 0) break;
    listings.push(...pageResults);

    // Smart Delta optimization for stores with >300 listings: remaining pages are older than the cache.
    // Bu durumda liste bilerek eksik bırakılır (complete=false) ve kalan ilanlar "silindi" sayılmaz.
    if (totalInEtsy > 300 && mode === 'smart' && maxTimestampInDb > 0 && offset > 0) {
      const allOlderAndCached = pageResults.every((item) => {
        const itemTs = Number(item.updated_timestamp || item.last_modified_timestamp || item.state_timestamp || 0);
        const ex = existingMap.get(String(item.listing_id));
        return ex && Number(ex.etsy_updated_timestamp || 0) >= itemTs;
      });
      if (allOlderAndCached) {
        return { listings, totalInEtsy, complete: false };
      }
    }

    offset += pageResults.length;
    if (offset >= (data.count || 0) || pageResults.length < limit) break;
  }

  return { listings, totalInEtsy, complete: true };
}

/**
 * POST /api/etsy/listings
 * Triggers unified synchronization from Etsy API into PostgreSQL DB cache.
 * Accepts mode: 'smart' (default) | 'full' (forced complete pagination).
 */
export async function POST(req: Request) {
  try {

    const session = await getAuthoritativeSession();
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
        error: tokenRes.error || 'Etsy bağlantısı bulunamadı. Lütfen Etsy hesabınızı bağlayın.',
        notConnected: true,
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
      SELECT id, listing_id, state, title, description, tags, etsy_updated_timestamp, seo_score, seo_evaluation, vision_analysis, ai_optimized_title, ai_optimized_description, ai_optimized_tags, ai_optimized_at 
      FROM user_etsy_listings 
      WHERE user_id = ${session.id}
    `;

    let maxTimestampInDb = 0;
    const existingMap = new Map<string, DbRow>();
    for (const row of existingDbRows) {
      existingMap.set(String(row.listing_id), row);
      const ts = Number(row.etsy_updated_timestamp || 0);
      if (ts > maxTimestampInDb) maxTimestampInDb = ts;
    }

    // 2. Fetch listings from Etsy for every listing state. Sıralı çalıştırılır: paralel 5 durum
    //    Etsy'nin saniye başına istek sınırını kolayca aşar.
    const stateResults: Array<Awaited<ReturnType<typeof fetchAllListingsForState>> & { state: string }> = [];
    for (const state of ETSY_LISTING_STATES) {
      const result = await fetchAllListingsForState(String(etsyShopId), state, headers, mode, existingMap, maxTimestampInDb);
      stateResults.push({ ...result, state });
    }
    const failedStates = stateResults.filter((r) => r.error).map((r) => r.state);
    const allStatesComplete = stateResults.every((r) => r.complete);

    const rawEtsyListings = stateResults.flatMap((r) => r.listings);

    if (rawEtsyListings.length === 0 && failedStates.length > 0) {
      return NextResponse.json({
        success: false,
        error: 'Etsy ilanları alınamadı (Etsy yanıt vermedi veya istek sınırına ulaşıldı). Mevcut veriler korunuyor; lütfen biraz sonra tekrar deneyin.',
      }, { status: 502 });
    }

    if (rawEtsyListings.length === 0 && existingDbRows.length === 0) {
      return NextResponse.json({
        success: true,
        count: 0,
        message: 'Etsy mağazasında herhangi bir ilan bulunamadı veya Etsy API yanıt vermedi.'
      });
    }

    // 3. Load keyword pool rows for SEO score evaluation of new / changed listings
    const keywordPoolRows = await sql`
      SELECT keyword, opportunity_score, etsy_score, total_listings, competition_level, bestseller_count, is_etsy_suggested, last_evaluated_at 
      FROM keyword_pool
      WHERE opportunity_score > 0 OR etsy_score > 0
    `;

    // 4. Transform and Upsert each listing
    let newOrUpdatedCount = 0;
    let unchangedCount = 0;
    const returnedEtsyListingIds = new Set<string>();

    for (const item of rawEtsyListings) {
      const listingIdStr = String(item.listing_id);
      returnedEtsyListingIds.add(listingIdStr);
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
      const primaryImageUrl = item.images?.[0]?.url_570xN || item.images?.[0]?.url_fullxfull || item.images?.[0]?.url_170x135 || null;

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
      if (!isContentIdentical || !isCurrentSeoEvaluation(existing?.seo_evaluation)) {
        const evaluation = evaluateEtsyListingSeo({
          title,
          description,
          tags,
          visionAnalysis: typeof visionAnalysis === 'string' ? JSON.parse(visionAnalysis) : visionAnalysis,
          keywordPoolRows,
          aiReview: storedAiReview(existing?.seo_evaluation),
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

    // 5. Handle listings deleted on Etsy — only when every state was fetched completely.
    const removedIds = listingsToMarkRemoved(existingMap.entries(), returnedEtsyListingIds, allStatesComplete);
    for (const listingId of removedIds) {
      await sql`
        UPDATE user_etsy_listings
        SET state = 'removed', updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ${session.id} AND listing_id = ${listingId}
      `.catch(() => {});
    }

    const totalCount = await sql`
      SELECT COUNT(*) as cnt FROM user_etsy_listings WHERE user_id = ${session.id} AND state != 'removed'
    `;
    const finalTotal = Number(totalCount[0]?.cnt || 0);

    const partial = failedStates.length > 0;
    const message = partial
      ? `Etsy senkronizasyonu kısmen tamamlandı: ${rawEtsyListings.length} ilan güncellendi, ancak bazı ilanlar alınamadı (Etsy yanıt vermedi veya istek sınırı). Alınamayan ilanların mevcut kayıtları korundu; biraz sonra tekrar senkronize edin.`
      : `Etsy senkronizasyonu tamamlandı: Toplam ${finalTotal} ilan güncel. (${newOrUpdatedCount} yeni/güncellenen işlendi, ${unchangedCount} değişmeyen ilan korundu${removedIds.length > 0 ? `, Etsy'den kaldırılmış ${removedIds.length} ilan listeden çıkarıldı` : ''})`;

    return NextResponse.json({
      success: true,
      partial,
      failedStates,
      removedCount: removedIds.length,
      mode,
      totalListings: finalTotal,
      newOrUpdatedCount,
      unchangedCount,
      lastSyncedAt: new Date().toISOString(),
      message
    });

  } catch (error) {
    console.error('Etsy Listings Sync Error:', error);
    return NextResponse.json({ success: false, error: getErrorMessage(error) }, { status: 500 });
  }
}

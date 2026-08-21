import { NextResponse } from 'next/server';
import sql, { ensureKeywordPoolColumns } from '@/lib/db';
import { requireAdmin } from '@/lib/auth-server';

export async function GET(req: Request) {
  try {
    const session = await requireAdmin();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    await ensureKeywordPoolColumns();
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';
    const filter = searchParams.get('filter') || 'all'; // 'all', 'tag_eligible', 'gold', 'error'
    const sortBy = searchParams.get('sortBy') || 'created_at';
    const order = searchParams.get('order') || 'desc';
    
    const isExport = searchParams.get('export') === 'true';
    
    // Cap limit to prevent OOM, allow up to 100,000 for exports
    const rawLimit = parseInt(searchParams.get('limit') || '100', 10);
    const maxAllowedLimit = isExport || rawLimit > 200 ? 100000 : 200;
    const limit = Math.min(Math.max(1, rawLimit), maxAllowedLimit);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const validSortCols = ['keyword', 'usage_count', 'etsy_score', 'opportunity_score', 'total_listings', 'bestseller_count', 'char_length', 'created_at', 'last_evaluated_at'];
    const sortCol = validSortCols.includes(sortBy) ? sortBy : 'created_at';
    const sortOrder = order.toLowerCase() === 'asc' ? 'asc' : 'desc';

    let data;
    let count;

    const searchPattern = `%${search.toLowerCase()}%`;

    let whereClause = sql`WHERE 1=1`;
    if (search) {
      whereClause = sql`WHERE LOWER(keyword) LIKE ${searchPattern}`;
    }

    if (filter === 'tag_eligible') {
      if (search) {
        whereClause = sql`WHERE LOWER(keyword) LIKE ${searchPattern} AND LENGTH(keyword) <= 20`;
      } else {
        whereClause = sql`WHERE LENGTH(keyword) <= 20`;
      }
    } else if (filter === 'gold') {
      if (search) {
        whereClause = sql`WHERE LOWER(keyword) LIKE ${searchPattern} AND opportunity_score >= 70 AND total_listings < 5000`;
      } else {
        whereClause = sql`WHERE opportunity_score >= 70 AND total_listings < 5000`;
      }
    } else if (filter === 'error' || filter === 'blocked') {
      if (search) {
        whereClause = sql`WHERE LOWER(keyword) LIKE ${searchPattern} AND (last_scrape_error IS NOT NULL OR competition_level = 'Engellendi / Hata')`;
      } else {
        whereClause = sql`WHERE last_scrape_error IS NOT NULL OR competition_level = 'Engellendi / Hata'`;
      }
    } else if (filter === 'unevaluated') {
      if (search) {
        whereClause = sql`WHERE LOWER(keyword) LIKE ${searchPattern} AND (last_evaluated_at IS NULL OR competition_level IN ('Taranacak', 'Henüz Taranmadı'))`;
      } else {
        whereClause = sql`WHERE last_evaluated_at IS NULL OR competition_level IN ('Taranacak', 'Henüz Taranmadı')`;
      }
    }

    // Dynamic query building for sorting
    if (sortOrder === 'asc') {
      switch (sortCol) {
        case 'usage_count': data = await sql`SELECT * FROM keyword_pool ${whereClause} ORDER BY usage_count ASC LIMIT ${limit} OFFSET ${offset}`; break;
        case 'etsy_score': case 'opportunity_score': data = await sql`SELECT * FROM keyword_pool ${whereClause} ORDER BY opportunity_score ASC LIMIT ${limit} OFFSET ${offset}`; break;
        case 'total_listings': data = await sql`SELECT * FROM keyword_pool ${whereClause} ORDER BY total_listings ASC LIMIT ${limit} OFFSET ${offset}`; break;
        case 'bestseller_count': data = await sql`SELECT * FROM keyword_pool ${whereClause} ORDER BY bestseller_count ASC LIMIT ${limit} OFFSET ${offset}`; break;
        case 'char_length': data = await sql`SELECT * FROM keyword_pool ${whereClause} ORDER BY LENGTH(keyword) ASC LIMIT ${limit} OFFSET ${offset}`; break;
        case 'last_evaluated_at': data = await sql`SELECT * FROM keyword_pool ${whereClause} ORDER BY last_evaluated_at ASC NULLS FIRST LIMIT ${limit} OFFSET ${offset}`; break;
        case 'keyword': data = await sql`SELECT * FROM keyword_pool ${whereClause} ORDER BY keyword ASC LIMIT ${limit} OFFSET ${offset}`; break;
        default: data = await sql`SELECT * FROM keyword_pool ${whereClause} ORDER BY created_at ASC LIMIT ${limit} OFFSET ${offset}`; break;
      }
    } else {
      switch (sortCol) {
        case 'usage_count': data = await sql`SELECT * FROM keyword_pool ${whereClause} ORDER BY usage_count DESC LIMIT ${limit} OFFSET ${offset}`; break;
        case 'etsy_score': case 'opportunity_score': data = await sql`SELECT * FROM keyword_pool ${whereClause} ORDER BY opportunity_score DESC LIMIT ${limit} OFFSET ${offset}`; break;
        case 'total_listings': data = await sql`SELECT * FROM keyword_pool ${whereClause} ORDER BY total_listings DESC LIMIT ${limit} OFFSET ${offset}`; break;
        case 'bestseller_count': data = await sql`SELECT * FROM keyword_pool ${whereClause} ORDER BY bestseller_count DESC LIMIT ${limit} OFFSET ${offset}`; break;
        case 'char_length': data = await sql`SELECT * FROM keyword_pool ${whereClause} ORDER BY LENGTH(keyword) DESC LIMIT ${limit} OFFSET ${offset}`; break;
        case 'last_evaluated_at': data = await sql`SELECT * FROM keyword_pool ${whereClause} ORDER BY last_evaluated_at DESC NULLS LAST LIMIT ${limit} OFFSET ${offset}`; break;
        case 'keyword': data = await sql`SELECT * FROM keyword_pool ${whereClause} ORDER BY keyword DESC LIMIT ${limit} OFFSET ${offset}`; break;
        default: data = await sql`SELECT * FROM keyword_pool ${whereClause} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`; break;
      }
    }

    const countRes = await sql`
      SELECT COUNT(*) as total FROM keyword_pool ${whereClause}
    `;
    count = parseInt(countRes[0].total, 10);

    const [etsyWorkspace, etsySettings] = await Promise.all([
      sql`
        SELECT etsy_shop_id 
        FROM user_workspaces 
        WHERE etsy_access_token IS NOT NULL 
        LIMIT 1
      `,
      sql`
        SELECT setting_value 
        FROM app_settings 
        WHERE setting_key = 'etsy_keystring' 
        LIMIT 1
      `
    ]);

    const hasApiKey = Boolean(etsySettings[0]?.setting_value || process.env.ETSY_API_KEY);
    const hasOAuth = etsyWorkspace.length > 0;

    return NextResponse.json({
      success: true,
      keywords: data,
      total: count,
      etsyStatus: {
        connected: hasOAuth || hasApiKey,
        hasOAuth,
        hasApiKey,
        shopId: etsyWorkspace[0]?.etsy_shop_id || (hasApiKey ? 'Etsy Developer API' : null)
      }
    });
  } catch (error: any) {
    console.error('Keywords API GET Error:', error);
    return NextResponse.json({ success: false, error: 'Sunucu hatası oluştu.' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await requireAdmin();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { ids } = body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ success: false, error: 'Silinecek kelime bulunamadı.' }, { status: 400 });
    }

    await sql`
      DELETE FROM keyword_pool WHERE id = ANY(${ids as any})
    `;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Keywords API DELETE Error:', error);
    return NextResponse.json({ success: false, error: 'Sunucu hatası oluştu.' }, { status: 500 });
  }
}

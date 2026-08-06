import { NextResponse } from 'next/server';
import sql from '@/lib/db';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';
    const sortBy = searchParams.get('sortBy') || 'created_at';
    const order = searchParams.get('order') || 'desc';
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const validSortCols = ['keyword', 'usage_count', 'etsy_score', 'created_at', 'last_evaluated_at'];
    const sortCol = validSortCols.includes(sortBy) ? sortBy : 'created_at';
    const sortOrder = order.toLowerCase() === 'asc' ? 'asc' : 'desc';

    let data;
    let count;

    if (search) {
      const searchPattern = `%${search.toLowerCase()}%`;
      if (sortOrder === 'asc') {
        switch (sortCol) {
          case 'usage_count': data = await sql`SELECT * FROM keyword_pool WHERE LOWER(keyword) LIKE ${searchPattern} ORDER BY usage_count ASC LIMIT ${limit} OFFSET ${offset}`; break;
          case 'etsy_score': data = await sql`SELECT * FROM keyword_pool WHERE LOWER(keyword) LIKE ${searchPattern} ORDER BY etsy_score ASC LIMIT ${limit} OFFSET ${offset}`; break;
          case 'last_evaluated_at': data = await sql`SELECT * FROM keyword_pool WHERE LOWER(keyword) LIKE ${searchPattern} ORDER BY last_evaluated_at ASC LIMIT ${limit} OFFSET ${offset}`; break;
          case 'keyword': data = await sql`SELECT * FROM keyword_pool WHERE LOWER(keyword) LIKE ${searchPattern} ORDER BY keyword ASC LIMIT ${limit} OFFSET ${offset}`; break;
          default: data = await sql`SELECT * FROM keyword_pool WHERE LOWER(keyword) LIKE ${searchPattern} ORDER BY created_at ASC LIMIT ${limit} OFFSET ${offset}`; break;
        }
      } else {
        switch (sortCol) {
          case 'usage_count': data = await sql`SELECT * FROM keyword_pool WHERE LOWER(keyword) LIKE ${searchPattern} ORDER BY usage_count DESC LIMIT ${limit} OFFSET ${offset}`; break;
          case 'etsy_score': data = await sql`SELECT * FROM keyword_pool WHERE LOWER(keyword) LIKE ${searchPattern} ORDER BY etsy_score DESC LIMIT ${limit} OFFSET ${offset}`; break;
          case 'last_evaluated_at': data = await sql`SELECT * FROM keyword_pool WHERE LOWER(keyword) LIKE ${searchPattern} ORDER BY last_evaluated_at DESC LIMIT ${limit} OFFSET ${offset}`; break;
          case 'keyword': data = await sql`SELECT * FROM keyword_pool WHERE LOWER(keyword) LIKE ${searchPattern} ORDER BY keyword DESC LIMIT ${limit} OFFSET ${offset}`; break;
          default: data = await sql`SELECT * FROM keyword_pool WHERE LOWER(keyword) LIKE ${searchPattern} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`; break;
        }
      }
      
      const countRes = await sql`
        SELECT COUNT(*) as total FROM keyword_pool 
        WHERE LOWER(keyword) LIKE ${searchPattern}
      `;
      count = parseInt(countRes[0].total, 10);
    } else {
      if (sortOrder === 'asc') {
        switch (sortCol) {
          case 'usage_count': data = await sql`SELECT * FROM keyword_pool ORDER BY usage_count ASC LIMIT ${limit} OFFSET ${offset}`; break;
          case 'etsy_score': data = await sql`SELECT * FROM keyword_pool ORDER BY etsy_score ASC LIMIT ${limit} OFFSET ${offset}`; break;
          case 'last_evaluated_at': data = await sql`SELECT * FROM keyword_pool ORDER BY last_evaluated_at ASC LIMIT ${limit} OFFSET ${offset}`; break;
          case 'keyword': data = await sql`SELECT * FROM keyword_pool ORDER BY keyword ASC LIMIT ${limit} OFFSET ${offset}`; break;
          default: data = await sql`SELECT * FROM keyword_pool ORDER BY created_at ASC LIMIT ${limit} OFFSET ${offset}`; break;
        }
      } else {
        switch (sortCol) {
          case 'usage_count': data = await sql`SELECT * FROM keyword_pool ORDER BY usage_count DESC LIMIT ${limit} OFFSET ${offset}`; break;
          case 'etsy_score': data = await sql`SELECT * FROM keyword_pool ORDER BY etsy_score DESC LIMIT ${limit} OFFSET ${offset}`; break;
          case 'last_evaluated_at': data = await sql`SELECT * FROM keyword_pool ORDER BY last_evaluated_at DESC LIMIT ${limit} OFFSET ${offset}`; break;
          case 'keyword': data = await sql`SELECT * FROM keyword_pool ORDER BY keyword DESC LIMIT ${limit} OFFSET ${offset}`; break;
          default: data = await sql`SELECT * FROM keyword_pool ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`; break;
        }
      }
      
      const countRes = await sql`
        SELECT COUNT(*) as total FROM keyword_pool
      `;
      count = parseInt(countRes[0].total, 10);
    }

    return NextResponse.json({
      success: true,
      keywords: data,
      total: count,
    });
  } catch (error: any) {
    console.error('Keywords API GET Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
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
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

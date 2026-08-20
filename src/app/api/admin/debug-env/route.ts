import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { requireAdmin } from '@/lib/auth-server';
import { getR2Stats, isR2Configured } from '@/lib/r2';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const adminSession = await requireAdmin();
    if (!adminSession) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });
    }

    // 1. Check Database on Vercel
    const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || 'NOT_SET';
    const maskedDbUrl = dbUrl.replace(/:[^:@]+@/, ':***@');

    const dbRows = await sql`
      SELECT user_id, 
        jsonb_array_length(COALESCE(mockups, '[]'::jsonb)) as mockups_count,
        jsonb_array_length(COALESCE(designs, '[]'::jsonb)) as designs_count,
        jsonb_array_length(COALESCE(folders, '[]'::jsonb)) as folders_count,
        updated_at
      FROM user_workspaces
    `;

    // 2. Check R2 on Vercel
    const r2Config = {
      isConfigured: isR2Configured(),
      accountId: process.env.R2_ACCOUNT_ID || 'NOT_SET',
      bucket: process.env.R2_BUCKET_NAME || 'NOT_SET',
      accessKeyId: process.env.R2_ACCESS_KEY_ID || 'NOT_SET',
      secretKeyPrefix: process.env.R2_SECRET_ACCESS_KEY ? `${process.env.R2_SECRET_ACCESS_KEY.substring(0, 6)}...` : 'NOT_SET',
    };

    const r2Stats = await getR2Stats();

    return NextResponse.json({
      success: true,
      database: {
        url: maskedDbUrl,
        rows: dbRows,
      },
      r2: {
        config: r2Config,
        stats: r2Stats,
      },
    }, {
      headers: { 'Cache-Control': 'no-store' }
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { sql } from '@/lib/db'; // Re-exported raw sql client
import { requireAdmin } from '@/lib/auth-server';
import { isR2Configured, getR2Stats } from '@/lib/r2';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export async function GET() {
  try {
    const adminSession = await requireAdmin();
    if (!adminSession) {
      return NextResponse.json({ success: false, message: 'Yetkisiz erişim.' }, { 
        status: 403,
        headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' }
      });
    }

    // Measure DB query time as a metric for "System Health"
    const startTime = Date.now();

    // 1. User Statistics
    const usersData = await sql`
      SELECT 
        COUNT(*) as total_users,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_users,
        COUNT(CASE WHEN status = 'blocked' THEN 1 END) as blocked_users
      FROM users
    `;

    // 2. Asset Statistics (Mockups & Designs)
    const assetsData = await sql`
      SELECT 
        COALESCE(SUM(jsonb_array_length(mockups)), 0) as total_mockups,
        COALESCE(SUM(jsonb_array_length(designs)), 0) as total_designs,
        COALESCE(SUM(jsonb_array_length(folders)), 0) as total_folders
      FROM user_workspaces
    `;

    const dbLatencyMs = Date.now() - startTime;

    // 3. Storage Statistics (Cloudflare R2)
    let totalSizeBytes = 0;
    let blobCount = 0;
    let storageProvider = 'Cloudflare R2';
    const storageLimitBytes = 10 * 1024 * 1024 * 1024; // 10 GB Free Tier for Cloudflare R2

    if (isR2Configured()) {
      try {
        const r2Stats = await getR2Stats();
        totalSizeBytes = r2Stats.totalBytes;
        blobCount = r2Stats.objectCount;
      } catch (r2Err) {
        console.error('Failed to fetch Cloudflare R2 stats:', r2Err);
      }
    }

    const stats = {
      users: {
        total: parseInt(usersData[0].total_users || '0', 10),
        active: parseInt(usersData[0].active_users || '0', 10),
        blocked: parseInt(usersData[0].blocked_users || '0', 10),
      },
      assets: {
        mockups: parseInt(assetsData[0].total_mockups || '0', 10),
        designs: parseInt(assetsData[0].total_designs || '0', 10),
        folders: parseInt(assetsData[0].total_folders || '0', 10),
      },
      health: {
        status: dbLatencyMs < 500 ? 'excellent' : dbLatencyMs < 1500 ? 'good' : 'degraded',
        dbLatencyMs,
      },
      storage: {
        provider: storageProvider,
        usedBytes: totalSizeBytes,
        limitBytes: storageLimitBytes,
        blobCount,
      },
    };

    return NextResponse.json({ success: true, stats }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0',
      }
    });
  } catch (error: any) {
    console.error('Admin Stats Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { 
      status: 500,
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' }
    });
  }
}

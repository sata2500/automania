import { NextResponse } from 'next/server';
import { sql } from '@/lib/db'; // Re-exported raw sql client
import { requireAdmin } from '@/lib/auth-server';
import { list } from '@vercel/blob';

export async function GET() {
  try {
    const adminSession = await requireAdmin();
    if (!adminSession) {
      return NextResponse.json({ success: false, message: 'Yetkisiz erişim.' }, { status: 403 });
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
    // We use jsonb_array_length to count the elements in the JSONB arrays.
    // COALESCE handles null or empty cases.
    const assetsData = await sql`
      SELECT 
        COALESCE(SUM(jsonb_array_length(mockups)), 0) as total_mockups,
        COALESCE(SUM(jsonb_array_length(designs)), 0) as total_designs,
        COALESCE(SUM(jsonb_array_length(folders)), 0) as total_folders
      FROM user_workspaces
    `;

    const dbLatencyMs = Date.now() - startTime;

    // 3. Vercel Blob Storage Statistics
    let totalSizeBytes = 0;
    let blobCount = 0;
    
    try {
      let hasMore = true;
      let cursor: string | undefined = undefined;
      while (hasMore) {
        const blobListResponse = (await list({ token: process.env.BLOB_READ_WRITE_TOKEN, cursor, limit: 1000 })) as any;
        blobCount += blobListResponse.blobs.length;
        for (const b of blobListResponse.blobs) {
          totalSizeBytes += b.size;
        }
        hasMore = blobListResponse.hasMore;
        cursor = blobListResponse.cursor;
      }
    } catch (blobErr) {
      console.error('Failed to fetch blob stats:', blobErr);
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
        usedBytes: totalSizeBytes,
        limitBytes: 1073741824, // 1GB in bytes for Hobby tier
        blobCount
      }
    };

    return NextResponse.json({ success: true, stats });
  } catch (error: any) {
    console.error('Admin Stats Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

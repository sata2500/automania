import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { requireAdmin } from '@/lib/auth-server';
import { isR2Configured, listR2Objects, deleteFromR2 } from '@/lib/r2';
import * as sampleData from '@/lib/sample-data';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(request: Request) {
  try {
    const adminSession = await requireAdmin();
    if (!adminSession) {
      return NextResponse.json({ success: false, message: 'Yetkisiz erişim.' }, { status: 403 });
    }

    // 1. Extract protected URLs from sample-data
    const sampleDataString = JSON.stringify(sampleData);
    const urlMatches = sampleDataString.match(/(?:https?:\/\/[^\s"',]+|\/api\/r2\/[^\s"',]+)/g) || [];
    const protectedUrls = new Set(urlMatches);

    // 2. Fetch active workspaces from DB
    const rows = await sql`SELECT mockups, designs, etsy_generated_mockups FROM user_workspaces`;

    const activeUrls = new Set<string>();

    rows.forEach(row => {
      try {
        const mockups = typeof row.mockups === 'string' ? JSON.parse(row.mockups) : row.mockups;
        const designs = typeof row.designs === 'string' ? JSON.parse(row.designs) : row.designs;
        const etsyMockups =
          typeof row.etsy_generated_mockups === 'string'
            ? JSON.parse(row.etsy_generated_mockups)
            : row.etsy_generated_mockups;

        if (Array.isArray(mockups)) {
          mockups.forEach((m: any) => m.src && activeUrls.add(m.src));
        }
        if (Array.isArray(designs)) {
          designs.forEach((d: any) => d.src && activeUrls.add(d.src));
        }
        if (Array.isArray(etsyMockups)) {
          etsyMockups.forEach((m: any) => m.previewUrl && activeUrls.add(m.previewUrl));
        }
      } catch (e) {
        console.error('Failed to parse a row', e);
      }
    });

    let totalDeleted = 0;
    let totalChecked = 0;

    // 3. Clean Cloudflare R2 if configured
    if (isR2Configured()) {
      try {
        let hasMore = true;
        let cursor: string | undefined = undefined;
        const r2Objects: { key: string; url: string }[] = [];

        while (hasMore) {
          const res = await listR2Objects({ cursor, limit: 1000 });
          r2Objects.push(...res.objects);
          hasMore = res.hasMore;
          cursor = res.nextCursor;
        }

        totalChecked += r2Objects.length;

        const orphanedR2 = r2Objects.filter(obj => {
          // Check if object url or key is in active or protected list
          const matchesActive = Array.from(activeUrls).some(u => u.includes(obj.key) || u === obj.url);
          if (matchesActive) return false;

          const matchesProtected = Array.from(protectedUrls).some(u => u.includes(obj.key) || u === obj.url);
          if (matchesProtected) return false;

          return true;
        });

        if (orphanedR2.length > 0) {
          const keysToDelete = orphanedR2.map(o => o.key);
          const delRes = await deleteFromR2(keysToDelete);
          totalDeleted += delRes.deletedCount;
        }
      } catch (r2Err) {
        console.error('[Clean Blobs] Cloudflare R2 clean error:', r2Err);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Toplam ${totalDeleted} adet çöp veri/görsel Cloudflare R2 depolama alanından başarıyla temizlendi.`,
      stats: {
        active: activeUrls.size,
        protected: protectedUrls.size,
        deleted: totalDeleted,
        totalChecked,
      },
    });
  } catch (error: any) {
    console.error('Clean Blobs Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

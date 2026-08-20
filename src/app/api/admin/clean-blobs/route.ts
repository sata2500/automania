import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { requireAdmin } from '@/lib/auth-server';
import { isR2Configured, listR2Objects, deleteFromR2, R2ObjectItem } from '@/lib/r2';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(_request: Request) {
  try {
    const adminSession = await requireAdmin();
    if (!adminSession) {
      return NextResponse.json({ success: false, message: 'Yetkisiz erişim.' }, { status: 403 });
    }

    if (!isR2Configured()) {
      return NextResponse.json({ success: false, message: 'Cloudflare R2 yapılandırılmamış.' }, { status: 500 });
    }

    // 1. Collect every URL actively referenced in the database
    const rows = await sql`SELECT mockups, designs, etsy_generated_mockups FROM user_workspaces`;

    const activeKeys = new Set<string>();

    for (const row of rows) {
      const parse = (v: any): any[] => {
        try { return typeof v === 'string' ? JSON.parse(v) : (Array.isArray(v) ? v : []); }
        catch { return []; }
      };
      parse(row.mockups).forEach((m: any) => m?.src && activeKeys.add(m.src));
      parse(row.designs).forEach((d: any) => d?.src && activeKeys.add(d.src));
      parse(row.etsy_generated_mockups).forEach((e: any) => e?.previewUrl && activeKeys.add(e.previewUrl));
    }

    // 2. List ALL objects in R2
    const allObjects: R2ObjectItem[] = [];
    let cursor: string | undefined;
    let hasMore = true;
    while (hasMore) {
      const res = await listR2Objects({ cursor, limit: 1000 });
      allObjects.push(...res.objects);
      hasMore = res.hasMore;
      cursor = res.nextCursor;
    }

    const totalChecked = allObjects.length;

    // 3. An object is orphaned if its key does not appear in ANY active URL
    const orphans = allObjects.filter(obj => {
      for (const url of activeKeys) {
        if (url.includes(obj.key)) return false; // key found inside a URL → keep
      }
      return true; // no reference → orphan
    });

    let totalDeleted = 0;
    if (orphans.length > 0) {
      const keysToDelete = orphans.map(o => o.key);
      const res = await deleteFromR2(keysToDelete);
      totalDeleted = res.deletedCount;
    }

    return NextResponse.json({
      success: true,
      message: `${totalDeleted} adet sahipsiz dosya Cloudflare R2'den başarıyla temizlendi.`,
      stats: {
        totalChecked,
        activeReferenced: activeKeys.size,
        deleted: totalDeleted,
        remaining: totalChecked - totalDeleted,
      },
    }, {
      headers: { 'Cache-Control': 'no-store' },
    });

  } catch (error: any) {
    console.error('[Clean R2] Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

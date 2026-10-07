import { getErrorMessage } from '@/lib/errors';
import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { requireAdmin } from '@/lib/auth-server';
import { isR2Configured, listR2Objects, deleteFromR2, R2ObjectItem } from '@/lib/r2';
import { parseJsonArray } from '@/lib/json-utils';
import { writeAuditLog } from '@/lib/audit-log';
import { collectWorkspaceReferences, findOrphanKeys } from '@/lib/orphan-detection';

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
    const [workspaceRows, runRows] = await Promise.all([
      sql`SELECT mockups, designs, etsy_generated_mockups FROM user_workspaces`,
      sql`SELECT generated_design_url, generated_mockup_urls, generated_video_url FROM automation_runs`,
    ]);

    const activeKeys = new Set<string>();
    for (const row of workspaceRows) collectWorkspaceReferences(row, activeKeys);
    for (const row of runRows) {
      if (typeof row.generated_design_url === 'string') activeKeys.add(row.generated_design_url);
      if (typeof row.generated_video_url === 'string') activeKeys.add(row.generated_video_url);
      for (const url of parseJsonArray<string>(row.generated_mockup_urls)) if (typeof url === 'string') activeKeys.add(url);
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

    // 3. Referans verilmeyen ve 24 saatten eski nesneler sahipsizdir
    const orphanKeys = findOrphanKeys(allObjects, activeKeys);

    let totalDeleted = 0;
    if (orphanKeys.length > 0) {
      const res = await deleteFromR2(orphanKeys);
      totalDeleted = res.deletedCount;
      await writeAuditLog({
        userId: adminSession.id,
        action: 'admin.storage.orphans_deleted',
        resourceType: 'r2',
        metadata: { deleted: totalDeleted, checked: totalChecked },
      });
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

  } catch (error) {
    console.error('[Clean R2] Error:', error);
    return NextResponse.json({ success: false, error: getErrorMessage(error) }, { status: 500 });
  }
}

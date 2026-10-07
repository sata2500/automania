/**
 * GET /api/workspace/variation-templates
 * ========================================
 * Kullanıcının etsyVariationTemplates listesini döner.
 * EtsySeoContext tarafından IndexedDB'ye kaydedilmiş varyasyon şablonları,
 * DB'de userWorkspaces.etsyVariationTemplates alanında saklanır.
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { userWorkspaces } from '@/db/schema';
import { getAuthoritativeSession } from '@/lib/auth-server';
import { eq } from 'drizzle-orm';

export async function GET() {
  try {
    const session = await getAuthoritativeSession();
    if (!session?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rows = await db
      .select({ etsyVariationTemplates: userWorkspaces.etsyVariationTemplates })
      .from(userWorkspaces)
      .where(eq(userWorkspaces.userId, session.id))
      .limit(1);

    const templates = (rows[0]?.etsyVariationTemplates as unknown[]) ?? [];

    return NextResponse.json({ templates });
  } catch (error) {
    console.error('[GET /api/workspace/variation-templates] Error:', error);
    return NextResponse.json({ templates: [] });
  }
}

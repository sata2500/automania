/**
 * GET /api/etsy/taxonomy
 * Yöneticinin admin panelinde etkinleştirdiği Etsy kategorileri (şablon ve ilan formlarında seçim için).
 */
import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { etsyTaxonomyCache } from '@/db/schema';
import { getAuthoritativeSession } from '@/lib/auth-server';

export async function GET() {
  const session = await getAuthoritativeSession();
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  try {
    const categories = await db
      .select({ id: etsyTaxonomyCache.id, name: etsyTaxonomyCache.name, path: etsyTaxonomyCache.path })
      .from(etsyTaxonomyCache)
      .where(eq(etsyTaxonomyCache.isActive, true))
      .orderBy(etsyTaxonomyCache.path);
    return NextResponse.json({ success: true, categories });
  } catch (error) {
    console.error('[GET /api/etsy/taxonomy] failed:', error instanceof Error ? error.message : error);
    return NextResponse.json({ success: false, categories: [] }, { status: 500 });
  }
}

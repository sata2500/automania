import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { requireAdmin } from '@/lib/auth-server';
import { extractKeyFromUrlOrKey, isR2Configured, listR2Objects } from '@/lib/r2';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function parseArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function classifyReference(value: unknown): 'durable_r2' | 'temporary' | 'other' | 'missing' {
  if (typeof value !== 'string' || value.length === 0) return 'missing';
  if (value.startsWith('blob:') || value.startsWith('data:')) return 'temporary';
  if (value.includes('/api/r2/') || value.startsWith('http://') || value.startsWith('https://')) return 'durable_r2';
  return 'other';
}

function addReference(
  references: Map<string, Set<string>>,
  assetType: string,
  value: unknown,
) {
  if (classifyReference(value) !== 'durable_r2' || typeof value !== 'string') return;
  const key = extractKeyFromUrlOrKey(value);
  if (!key) return;
  const set = references.get(assetType) || new Set<string>();
  set.add(key);
  references.set(assetType, set);
}

export async function GET() {
  try {
    const session = await requireAdmin();
    if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });

    const rows = await sql`
      SELECT mockups, designs, etsy_generated_mockups
      FROM user_workspaces
    `;

    const references = new Map<string, Set<string>>();
    const records = {
      mockups: 0,
      designs: 0,
      generatedMockups: 0,
      durable: 0,
      temporary: 0,
      other: 0,
      missing: 0,
    };

    const inspect = (assetType: 'mockups' | 'designs' | 'generatedMockups', items: unknown[], field: string) => {
      records[assetType] += items.length;
      for (const item of items) {
        const value = item && typeof item === 'object' ? (item as Record<string, unknown>)[field] : undefined;
        const classification = classifyReference(value);
        records[classification === 'durable_r2' ? 'durable' : classification] += 1;
        addReference(references, assetType, value);
      }
    };

    for (const row of rows) {
      inspect('mockups', parseArray(row.mockups), 'src');
      inspect('designs', parseArray(row.designs), 'src');
      inspect('generatedMockups', parseArray(row.etsy_generated_mockups), 'previewUrl');
    }

    const referencedKeys = new Set<string>();
    for (const keys of references.values()) {
      for (const key of keys) referencedKeys.add(key);
    }

    const response = {
      success: true,
      workspaceCount: rows.length,
      records,
      referencedR2Objects: referencedKeys.size,
      byAssetType: Object.fromEntries(
        Array.from(references.entries()).map(([assetType, keys]) => [assetType, keys.size]),
      ),
      r2: {
        configured: isR2Configured(),
        objectCount: 0,
        totalBytes: 0,
        orphanObjectCount: null as number | null,
        missingReferencedObjectCount: null as number | null,
      },
    };

    if (!isR2Configured()) {
      return NextResponse.json(response, { headers: { 'Cache-Control': 'no-store' } });
    }

    const objectKeys = new Set<string>();
    let cursor: string | undefined;
    let hasMore = true;
    while (hasMore) {
      const page = await listR2Objects({ cursor, limit: 1000 });
      for (const object of page.objects) {
        objectKeys.add(object.key);
        response.r2.totalBytes += object.size;
      }
      response.r2.objectCount += page.objects.length;
      cursor = page.nextCursor;
      hasMore = page.hasMore;
    }

    let missingReferencedObjectCount = 0;
    for (const key of referencedKeys) {
      if (!objectKeys.has(key)) missingReferencedObjectCount += 1;
    }
    response.r2.missingReferencedObjectCount = missingReferencedObjectCount;
    response.r2.orphanObjectCount = Math.max(0, objectKeys.size - referencedKeys.size + missingReferencedObjectCount);

    return NextResponse.json(response, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('[Admin Storage Diagnostics] Error:', error instanceof Error ? error.message : 'unknown error');
    return NextResponse.json({ success: false, error: 'Storage diagnostics failed.' }, { status: 500 });
  }
}

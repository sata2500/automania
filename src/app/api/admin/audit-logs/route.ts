import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { requireAdmin } from '@/lib/auth-server';

export async function GET(request: Request) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  try {
    const limitParam = Number(new URL(request.url).searchParams.get('limit') || 50);
    const limit = Math.min(100, Math.max(1, Number.isFinite(limitParam) ? Math.floor(limitParam) : 50));
    const rows = await sql`
      SELECT id, user_id, action, resource_type, resource_id, metadata, created_at
      FROM audit_logs
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;
    return NextResponse.json({ success: true, logs: rows });
  } catch (error) {
    console.error('[Audit] List failed:', error instanceof Error ? error.message : 'unknown error');
    return NextResponse.json({ success: false, error: 'Audit kayıtları alınamadı.' }, { status: 503 });
  }
}

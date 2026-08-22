import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { requireAdmin } from '@/lib/auth-server';

export async function GET() {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const startedAt = Date.now();
  try {
    await sql`SELECT 1 AS ok`;
    return NextResponse.json({
      success: true,
      ok: true,
      latencyMs: Date.now() - startedAt,
    });
  } catch (error) {
    console.error('[Admin Health] Database ping failed:', error instanceof Error ? error.message : 'unknown error');
    return NextResponse.json({
      success: false,
      ok: false,
      latencyMs: Date.now() - startedAt,
      error: 'Veritabanı bağlantı testi başarısız oldu.',
    }, { status: 503 });
  }
}

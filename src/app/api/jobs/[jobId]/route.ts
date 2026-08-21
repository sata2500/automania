import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { getAuthoritativeSession } from '@/lib/auth-server';
import { clampJobProgress } from '@/lib/job-contract';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const session = await getAuthoritativeSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { jobId } = await params;
    if (!jobId || jobId.length > 255) return NextResponse.json({ error: 'Geçersiz job ID.' }, { status: 400 });

    const rows = await sql`
      SELECT id, job_type, status, progress, result, error, created_at, started_at, finished_at, updated_at
      FROM job_runs
      WHERE id = ${jobId} AND user_id = ${session.id}
      LIMIT 1
    `;
    if (rows.length === 0) return NextResponse.json({ error: 'Job bulunamadı.' }, { status: 404 });

    const row = rows[0] as Record<string, unknown>;
    const rawProgress = typeof row.progress === 'string' ? JSON.parse(row.progress) : row.progress;
    return NextResponse.json({
      success: true,
      job: {
        id: String(row.id),
        type: String(row.job_type),
        status: String(row.status),
        progress: clampJobProgress((rawProgress || {}) as Record<string, unknown>),
        result: row.result ?? {},
        error: row.error ? String(row.error) : null,
        createdAt: row.created_at,
        startedAt: row.started_at,
        finishedAt: row.finished_at,
        updatedAt: row.updated_at,
      },
    });
  } catch (error) {
    console.error('[Jobs] Status lookup failed:', error instanceof Error ? error.message : 'unknown error');
    return NextResponse.json({ error: 'Job durumu alınamadı.' }, { status: 503 });
  }
}

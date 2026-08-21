import sql from '@/lib/db';
import {
  clampJobProgress,
  createJobId,
  hashJobPayload,
  normalizeIdempotencyKey,
  type JobProgress,
  type JobStatus,
} from '@/lib/job-contract';

export type JobRecord = {
  id: string;
  userId: string;
  jobType: string;
  status: JobStatus;
  idempotencyKey: string | null;
  requestHash: string | null;
  progress: JobProgress;
  result: unknown;
  error: string | null;
};

export class IdempotencyConflictError extends Error {
  constructor() {
    super('Aynı idempotency key farklı bir istek gövdesiyle kullanıldı.');
    this.name = 'IdempotencyConflictError';
  }
}

function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== 'string') return (value as T) ?? fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function mapJobRow(row: Record<string, unknown>): JobRecord {
  const progress = parseJson<Partial<JobProgress>>(row.progress, { completed: 0, total: 0 });
  return {
    id: String(row.id),
    userId: String(row.user_id),
    jobType: String(row.job_type),
    status: String(row.status) as JobStatus,
    idempotencyKey: row.idempotency_key ? String(row.idempotency_key) : null,
    requestHash: row.request_hash ? String(row.request_hash) : null,
    progress: clampJobProgress(progress),
    result: parseJson(row.result, {}),
    error: row.error ? String(row.error) : null,
  };
}

export async function createOrReuseJob(input: {
  userId: string;
  jobType: string;
  idempotencyKey?: unknown;
  payload: unknown;
  total?: number;
}): Promise<{ job: JobRecord; reused: boolean }> {
  const idempotencyKey = normalizeIdempotencyKey(input.idempotencyKey);
  const requestHash = hashJobPayload(input.payload);

  if (idempotencyKey) {
    const existingRows = await sql`
      SELECT id, user_id, job_type, status, idempotency_key, request_hash, progress, result, error
      FROM job_runs
      WHERE user_id = ${input.userId} AND idempotency_key = ${idempotencyKey}
      LIMIT 1
    `;
    if (existingRows.length > 0) {
      const existing = mapJobRow(existingRows[0] as Record<string, unknown>);
      if (existing.requestHash !== requestHash) throw new IdempotencyConflictError();
      return { job: existing, reused: true };
    }
  }

  const id = createJobId();
  const progress = clampJobProgress({ completed: 0, total: input.total ?? 0 });
  const rows = await sql`
    INSERT INTO job_runs (id, user_id, job_type, status, idempotency_key, request_hash, progress, result)
    VALUES (${id}, ${input.userId}, ${input.jobType}, 'queued', ${idempotencyKey}, ${requestHash}, ${JSON.stringify(progress)}::jsonb, '{}'::jsonb)
    RETURNING id, user_id, job_type, status, idempotency_key, request_hash, progress, result, error
  `;
  return { job: mapJobRow(rows[0] as Record<string, unknown>), reused: false };
}

export async function updateJobProgress(userId: string, jobId: string, progress: Partial<JobProgress>): Promise<void> {
  const safeProgress = clampJobProgress(progress);
  await sql`
    UPDATE job_runs
    SET status = 'running', progress = ${JSON.stringify(safeProgress)}::jsonb,
        started_at = COALESCE(started_at, CURRENT_TIMESTAMP), updated_at = CURRENT_TIMESTAMP
    WHERE id = ${jobId} AND user_id = ${userId}
  `;
}

export async function completeJob(userId: string, jobId: string, result: unknown): Promise<void> {
  await sql`
    UPDATE job_runs
    SET status = 'succeeded', progress = jsonb_build_object('completed', 1, 'total', 1),
        result = ${JSON.stringify(result)}::jsonb, error = NULL,
        finished_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
    WHERE id = ${jobId} AND user_id = ${userId}
  `;
}

export async function failJob(userId: string, jobId: string, errorMessage: string): Promise<void> {
  await sql`
    UPDATE job_runs
    SET status = 'failed', error = ${errorMessage.slice(0, 2000)},
        finished_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
    WHERE id = ${jobId} AND user_id = ${userId}
  `;
}

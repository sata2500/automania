import { createHash, randomUUID } from 'node:crypto';

export const JOB_STATUSES = ['queued', 'running', 'succeeded', 'failed', 'cancelled'] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export type JobProgress = {
  completed: number;
  total: number;
  message?: string;
};

export function createJobId(): string {
  return `job-${randomUUID()}`;
}

export function normalizeIdempotencyKey(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if (normalized.length < 8 || normalized.length > 255) return null;
  return normalized;
}

function sortForHash(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortForHash);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, sortForHash(nested)]),
    );
  }
  return value;
}

export function hashJobPayload(payload: unknown): string {
  const canonical = JSON.stringify(sortForHash(payload));
  return createHash('sha256').update(canonical).digest('hex');
}

export function clampJobProgress(progress: Partial<JobProgress>): JobProgress {
  const total = Math.max(0, Number.isFinite(progress.total) ? Math.floor(progress.total as number) : 0);
  const completed = Math.min(total, Math.max(0, Number.isFinite(progress.completed) ? Math.floor(progress.completed as number) : 0));
  return {
    completed,
    total,
    ...(typeof progress.message === 'string' && progress.message.trim() ? { message: progress.message.trim().slice(0, 500) } : {}),
  };
}

export function getJobProgressPercent(progress: JobProgress): number {
  if (progress.total <= 0) return 0;
  return Math.round((progress.completed / progress.total) * 100);
}

export function isTerminalJobStatus(status: string): status is Exclude<JobStatus, 'queued' | 'running'> {
  return status === 'succeeded' || status === 'failed' || status === 'cancelled';
}

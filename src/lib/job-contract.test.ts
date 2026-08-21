import { describe, expect, it } from 'vitest';
import {
  clampJobProgress,
  getJobProgressPercent,
  hashJobPayload,
  isTerminalJobStatus,
  normalizeIdempotencyKey,
} from './job-contract';

describe('job contract', () => {
  it('hashes equivalent object payloads deterministically', () => {
    expect(hashJobPayload({ b: 2, a: { d: 4, c: 3 } })).toBe(hashJobPayload({ a: { c: 3, d: 4 }, b: 2 }));
  });

  it('normalizes only bounded idempotency keys', () => {
    expect(normalizeIdempotencyKey('  request-123456  ')).toBe('request-123456');
    expect(normalizeIdempotencyKey('short')).toBeNull();
    expect(normalizeIdempotencyKey('x'.repeat(256))).toBeNull();
  });

  it('clamps progress and computes a bounded percentage', () => {
    const progress = clampJobProgress({ completed: 12, total: 10, message: '  working  ' });
    expect(progress).toEqual({ completed: 10, total: 10, message: 'working' });
    expect(getJobProgressPercent(progress)).toBe(100);
    expect(isTerminalJobStatus('succeeded')).toBe(true);
    expect(isTerminalJobStatus('running')).toBe(false);
  });
});

import { describe, expect, it, vi } from 'vitest';
import { describeAiError, isRetryableAiError, withAiRetry } from './ai-retry';

const busy = new Error('{"error":{"code":429,"message":"Resource exhausted. Please try again later.","status":"RESOURCE_EXHAUSTED"}}');

describe('withAiRetry', () => {
  it('retries busy errors with backoff and returns the eventual result', async () => {
    const fn = vi.fn().mockRejectedValueOnce(busy).mockRejectedValueOnce(new Error('503 UNAVAILABLE')).mockResolvedValue('ok');
    const sleep = vi.fn(async () => {});
    await expect(withAiRetry(fn, { sleep })).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it('gives up after the last delay and does not retry permanent errors', async () => {
    const sleep = vi.fn(async () => {});
    const always = vi.fn().mockRejectedValue(busy);
    await expect(withAiRetry(always, { sleep, delaysMs: [1, 1] })).rejects.toBe(busy);
    expect(always).toHaveBeenCalledTimes(3);

    const invalid = vi.fn().mockRejectedValue(new Error('400 INVALID_ARGUMENT: bad prompt'));
    await expect(withAiRetry(invalid, { sleep })).rejects.toThrow('INVALID_ARGUMENT');
    expect(invalid).toHaveBeenCalledTimes(1);
  });
});

describe('describeAiError', () => {
  it('explains capacity errors in Turkish and keeps other messages', () => {
    expect(isRetryableAiError(busy)).toBe(true);
    expect(describeAiError(busy)).toMatch(/yoğun/);
    expect(describeAiError(new Error('Depolama (R2) yapılandırılmamış.'))).toBe('Depolama (R2) yapılandırılmamış.');
  });
});

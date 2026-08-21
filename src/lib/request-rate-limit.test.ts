import { afterEach, describe, expect, it } from 'vitest';
import { consumeRateLimit, resetRateLimitsForTests } from './request-rate-limit';

afterEach(() => resetRateLimitsForTests());

describe('request rate limit', () => {
  it('allows up to the configured limit and then blocks', () => {
    expect(consumeRateLimit('test', 2, 60_000, 1_000).allowed).toBe(true);
    expect(consumeRateLimit('test', 2, 60_000, 1_001).allowed).toBe(true);
    const blocked = consumeRateLimit('test', 2, 60_000, 1_002);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterSeconds).toBe(60);
  });

  it('starts a fresh window after expiry', () => {
    expect(consumeRateLimit('test', 1, 1_000, 1_000).allowed).toBe(true);
    expect(consumeRateLimit('test', 1, 1_000, 1_500).allowed).toBe(false);
    expect(consumeRateLimit('test', 1, 1_000, 2_000).allowed).toBe(true);
  });
});

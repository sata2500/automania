import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkRateLimit, consumeRateLimit, resetRateLimitsForTests } from './request-rate-limit';

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

describe('checkRateLimit', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('uses the in-memory store when no shared store is configured', async () => {
    vi.stubEnv('UPSTASH_REDIS_REST_URL', '');
    vi.stubEnv('KV_REST_API_URL', '');
    expect((await checkRateLimit('mem', 2, 60_000, 2)).allowed).toBe(true);
    expect((await checkRateLimit('mem', 2, 60_000)).allowed).toBe(false);
  });

  it('uses the shared Redis store when configured', async () => {
    vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://redis.example');
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'token');
    const fetchMock = vi.fn(async () => new Response(JSON.stringify([{ result: 6 }, { result: 1 }, { result: 30_000 }])));
    vi.stubGlobal('fetch', fetchMock);

    const result = await checkRateLimit('shared', 5, 60_000);

    expect(result).toEqual({ allowed: false, remaining: 0, retryAfterSeconds: 30 });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://redis.example/pipeline');
    expect(JSON.parse(String(init.body))[0]).toEqual(['INCRBY', 'ratelimit:shared', '1']);
  });

  it('falls back to memory when Redis fails', async () => {
    vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://redis.example');
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'token');
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network'); }));
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    expect((await checkRateLimit('fallback', 1, 60_000)).allowed).toBe(true);
    expect((await checkRateLimit('fallback', 1, 60_000)).allowed).toBe(false);
  });
});

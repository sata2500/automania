/**
 * Kullanıcı/anahtar bazlı sabit pencereli istek sınırlama.
 *
 * Upstash Redis (veya Vercel KV) REST bilgileri tanımlıysa sayaçlar tüm sunucu
 * örnekleri arasında paylaşılır; tanımlı değilse ya da Redis'e ulaşılamazsa
 * süreç içi bellek kullanılır (tek örnekte doğru, serverless'ta en iyi çaba).
 */

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 10_000;
const REDIS_TIMEOUT_MS = 1_500;

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

function toResult(count: number, limit: number, msUntilReset: number): RateLimitResult {
  return {
    allowed: count <= limit,
    remaining: Math.max(0, limit - count),
    retryAfterSeconds: Math.max(1, Math.ceil(msUntilReset / 1000)),
  };
}

/** Süreç içi bellek sayacı (senkron). */
export function consumeRateLimit(key: string, limit: number, windowMs: number, now = Date.now(), cost = 1): RateLimitResult {
  const existing = buckets.get(key);
  const bucket = !existing || existing.resetAt <= now
    ? { count: 0, resetAt: now + windowMs }
    : existing;

  bucket.count += cost;
  buckets.set(key, bucket);

  if (buckets.size > MAX_BUCKETS) {
    for (const [bucketKey, value] of buckets) {
      if (value.resetAt <= now) buckets.delete(bucketKey);
      if (buckets.size <= MAX_BUCKETS) break;
    }
  }

  return toResult(bucket.count, limit, bucket.resetAt - now);
}

type RedisConfig = { url: string; token: string };

export function getRedisConfig(env: NodeJS.ProcessEnv = process.env): RedisConfig | null {
  const url = env.UPSTASH_REDIS_REST_URL || env.KV_REST_API_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN || env.KV_REST_API_TOKEN;
  return url && token ? { url: url.replace(/\/+$/, ''), token } : null;
}

let warnedRedisFailure = false;

async function consumeRedis(config: RedisConfig, key: string, limit: number, windowMs: number, cost: number): Promise<RateLimitResult> {
  const redisKey = `ratelimit:${key}`;
  const res = await fetch(`${config.url}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify([
      ['INCRBY', redisKey, String(cost)],
      ['PEXPIRE', redisKey, String(windowMs), 'NX'],
      ['PTTL', redisKey],
    ]),
    signal: AbortSignal.timeout(REDIS_TIMEOUT_MS),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Redis HTTP ${res.status}`);

  const results = (await res.json()) as Array<{ result?: unknown; error?: string }>;
  const failed = results.find((entry) => entry.error);
  if (failed) throw new Error(`Redis error: ${failed.error}`);

  const count = Number(results[0]?.result);
  const ttl = Number(results[2]?.result);
  if (!Number.isFinite(count)) throw new Error('Unexpected Redis response');
  return toResult(count, limit, Number.isFinite(ttl) && ttl > 0 ? ttl : windowMs);
}

/**
 * İstek sınırını kontrol eder ve `cost` kadar tüketir.
 * Paylaşımlı depo kullanılamazsa bellek sayacına düşer (istekleri asla engellemez).
 */
export async function checkRateLimit(key: string, limit: number, windowMs: number, cost = 1): Promise<RateLimitResult> {
  const config = getRedisConfig();
  if (config) {
    try {
      return await consumeRedis(config, key, limit, windowMs, cost);
    } catch (error) {
      if (!warnedRedisFailure) {
        warnedRedisFailure = true;
        console.warn('[rate-limit] Shared store unavailable, falling back to memory:', error instanceof Error ? error.message : error);
      }
    }
  }
  return consumeRateLimit(key, limit, windowMs, Date.now(), cost);
}

export function resetRateLimitsForTests(): void {
  buckets.clear();
  warnedRedisFailure = false;
}

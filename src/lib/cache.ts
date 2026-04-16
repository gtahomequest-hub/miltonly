// Redis caching layer (Upstash, via Vercel Marketplace).
// - Stampede protection on cache miss (Point 6).
// - Graceful degradation on outage (Point E): if Redis fails, fall back to
//   the compute fn so the caller still gets a result. Never let a Redis
//   hiccup take down a page.
// - Graceful degradation on unset env vars at boot: redis is null, all
//   helpers bypass the cache and call the compute fn directly.

import { Redis } from "@upstash/redis";

export const CACHE_TTL = {
  stats: 3600,        // 1h — street/neighbourhood stats
  scores: 86400,      // 24h — listing scores
  homepage: 3600,     // 1h
  predictions: 86400, // 24h
  soldList: 3600,     // 1h — authed /api/sold responses per street
  aggregate: 21600,   // 6h — public SEO-safe aggregate teasers
} as const;

function makeRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_KV_REST_API_TOKEN;
  if (!url || !token) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[cache] Upstash env vars not set — cache disabled");
    }
    return null;
  }
  return new Redis({ url, token });
}

export const redis: Redis | null = makeRedis();

/**
 * Read-through cache with stampede protection + graceful degradation.
 * 1. Cache hit → return cached value.
 * 2. Cache miss → acquire lock; one caller computes, others wait ~200ms and retry.
 * 3. Second miss after wait → compute directly.
 * 4. Redis failure at any step → fall through to compute. Never throw from here.
 */
export async function cached<T>(
  key: string,
  ttlSeconds: number,
  compute: () => Promise<T>
): Promise<T> {
  if (!redis) return compute();

  // 1. Try cache
  try {
    const hit = await redis.get<T>(key);
    if (hit !== null && hit !== undefined) return hit;
  } catch (err) {
    console.warn(`[cache] read failed for ${key}:`, err);
    return compute();
  }

  // 2. Miss — try to acquire a short-lived lock
  const lockKey = `lock:${key}`;
  let haveLock = false;
  try {
    const acquired = await redis.set(lockKey, "1", { nx: true, ex: 10 });
    haveLock = acquired === "OK";
  } catch (err) {
    console.warn(`[cache] lock acquire failed for ${key}:`, err);
  }

  // 3. If we didn't get the lock, wait briefly and try the cache again
  if (!haveLock) {
    await new Promise((r) => setTimeout(r, 200));
    try {
      const retry = await redis.get<T>(key);
      if (retry !== null && retry !== undefined) return retry;
    } catch (err) {
      console.warn(`[cache] retry read failed for ${key}:`, err);
    }
    // Still nothing — compute without cache populate to avoid fighting lock holder
    return compute();
  }

  // 4. We hold the lock — compute, write, release
  try {
    const value = await compute();
    try {
      await redis.set(key, value, { ex: ttlSeconds });
    } catch (err) {
      console.warn(`[cache] write failed for ${key}:`, err);
    }
    return value;
  } finally {
    try {
      await redis.del(lockKey);
    } catch {
      // lock will expire via TTL
    }
  }
}

export async function invalidate(key: string): Promise<void> {
  if (!redis) return;
  try {
    await redis.del(key);
  } catch (err) {
    console.warn(`[cache] invalidate failed for ${key}:`, err);
  }
}

export async function invalidateMany(keys: string[]): Promise<void> {
  if (!redis || keys.length === 0) return;
  try {
    await redis.del(...keys);
  } catch (err) {
    console.warn(`[cache] invalidateMany failed:`, err);
  }
}

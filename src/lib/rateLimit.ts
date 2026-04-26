// In-memory rate limit. Per-instance on Vercel serverless — concurrent
// invocations can exceed limit globally. Acceptable for current scale (~7 clicks/day).
// Swap to Upstash + Vercel KV if traffic exceeds ~10k req/day.

const WINDOW_MS = 60_000;
const MAX = 5;
const hits = new Map<string, number[]>();

export function hit(key: string): boolean {
  const now = Date.now();
  const arr = (hits.get(key) || []).filter((t) => now - t < WINDOW_MS);
  if (arr.length >= MAX) {
    hits.set(key, arr);
    return false;
  }
  arr.push(now);
  hits.set(key, arr);
  return true;
}

setInterval(() => {
  const now = Date.now();
  hits.forEach((arr, k) => {
    const fresh = arr.filter((t) => now - t < WINDOW_MS);
    if (fresh.length === 0) hits.delete(k);
    else hits.set(k, fresh);
  });
}, WINDOW_MS).unref?.();

// Drop every Redis key whose value is derived from sold.sold_records.
//
// WHY. The sold-date backfill moved 255 rows. The page purge that followed re-rendered the
// homepage and the 22 hubs, and they still published the old figures, because the figures do
// not come from the page render - they come from `cached()` in src/lib/cache.ts, an Upstash
// layer with a 1h TTL that a Next.js path revalidation does not touch. The battery caught it:
// a cache MISS on / that still printed sold-mtd 23 against a live source of 51.
//
// So a DB2 write has THREE consumers to invalidate, not one:
//   1. the Redis aggregate keys  <- this script
//   2. the prerendered pages     <- scripts/purge-after-sold-backfill.ts
//   3. stored prose              <- a regeneration, which is a separate decision
// Run this one FIRST. Purging pages before the cache just re-renders the stale numbers.
//
// Key prefixes below are the complete set of cached() keys reading DB2, taken from
// `grep -rn "cached(" src/lib/`. Street and neighbourhood stat keys are per-slug, so they are
// matched by prefix rather than named.
import { readFileSync } from "node:fs";
function loadEnvLocal(): void {
  try {
    const raw = readFileSync(".env.local", "utf-8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (m && !process.env[m[1]]) {
        let v = m[2].replace(/\r$/, "");
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
        process.env[m[1]] = v;
      }
    }
  } catch {}
}
loadEnvLocal();

const PATTERNS = [
  "sold-agg:*",
  "sold-list:*",
  "home:sold-mtd:*",
  "milton-sold-nbhds",
  "milton-sold-totals",
  "nbhd-sale-stats:*",
  "nbhd-lease-stats:*",
  "street-sale-stats:*",
  "street-lease-stats:*",
  "street-monthly-sales:*",
];

(async () => {
  const { redis } = await import("@/lib/cache");
  if (!redis) { console.error("Upstash env vars unset; there is no cache to purge and the live figures are already current."); process.exit(1); }

  let total = 0;
  for (const pattern of PATTERNS) {
    const keys: string[] = [];
    let cursor = "0";
    do {
      const [next, batch] = (await redis.scan(cursor, { match: pattern, count: 500 })) as [string, string[]];
      keys.push(...batch);
      cursor = String(next);
    } while (cursor !== "0");

    if (keys.length === 0) { console.log(`  ${pattern.padEnd(26)} 0`); continue; }
    // del in chunks; a very large key list in one call is a needless risk.
    for (let i = 0; i < keys.length; i += 100) await redis.del(...keys.slice(i, i + 100));
    total += keys.length;
    console.log(`  ${pattern.padEnd(26)} ${keys.length}`);
  }
  console.log(`deleted ${total} keys`);
  process.exit(0);
})();

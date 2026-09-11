// src/lib/soldCachePurge.ts
//
// EVERY SOLD-DERIVED FIGURE LEAVES THE CACHE WHEN THE SOLD SYNC WRITES (MC-010, 2026-09-11).
//
// The sold sync wrote rows to DB2 and touched nothing else. Every figure computed from those
// rows sits in Upstash under a one-hour TTL (CACHE_TTL.stats / homepage / soldList), so for up
// to an hour after a sync the homepage said "sold so far this month: 41" while the table said
// 44, and a street page's "typical" was the previous sync's. The write and the figure were
// never connected. Now they are: runSoldSync calls purgeSoldDerivedCaches at the end of a run
// that inserted or updated at least one row, with the streets and neighbourhoods it touched.
//
// WHAT GOES. Two kinds of key:
//   · Milton-wide, named exactly: the homepage's month-to-date figure (every date suffix it may
//     carry), the sold totals and neighbourhood roll-ups, the four sold aggregates the guides
//     and hubs read.
//   · Per-street and per-neighbourhood, by prefix, for the slugs and neighbourhoods the sync
//     wrote: sale/lease/monthly stats and the authed sold lists. A street the sync did not
//     touch keeps its cache; its figures did not move.
// Prefix deletion uses SCAN with a MATCH pattern, cursor to exhaustion, then DEL. Upstash's
// KEYS is O(N) over the whole keyspace and is not used.
//
// WHAT DOES NOT GO, AND WHY. buildMiltonWideContext's in-process memo (5-minute TTL) lives in
// whichever serverless instance rendered last; a sync running in another instance cannot reach
// it, and five minutes is the bound it was given. Next's page cache is not involved: the
// homepage is force-dynamic and /sold has revalidate 0, so a fresh Upstash read is a fresh page.
//
// FAIL-SOFT. A purge failure is logged and the sync still returns ok: a stale figure for an hour
// is the state we are leaving, not a reason to fail a sync that wrote correct rows.
import { redis, invalidateMany } from "@/lib/cache";

/** Milton-wide keys, exact. Kept in one place so a new cached() site is added here or is stale. */
export const SOLD_WIDE_KEYS = [
  "milton-sold-totals",
  "milton-sold-nbhds",
  "sold-agg:overall-12mo-v2",
  "sold-agg:by-type-12mo",
  "sold-agg:by-nbhd-12mo-mean",
  "sold-agg:quarterly",
] as const;

/** Prefixes that are keyed by a street slug. */
export const SOLD_STREET_PREFIXES = ["street-sale-stats:", "street-lease-stats:", "street-monthly-sales:", "sold-list:street:"] as const;
/** Prefixes that are keyed by a raw neighbourhood string. */
export const SOLD_NBHD_PREFIXES = ["nbhd-sale-stats:", "nbhd-lease-stats:", "sold-list:nbhd:"] as const;
/** Patterns purged whole on every write. */
export const SOLD_WIDE_PATTERNS = ["home:sold-mtd:*", "sold-list:all:*"] as const;

/** The exact patterns a purge will match for a given write. Pure, so the prebuild case can assert it. */
export function soldPurgePatterns(input: { streetSlugs: Set<string> | string[]; neighbourhoods: Set<string> | string[] }): string[] {
  const out = new Set<string>(Array.from(SOLD_WIDE_PATTERNS));
  for (const s of Array.from(input.streetSlugs)) if (s) for (const p of SOLD_STREET_PREFIXES) out.add(`${p}${s}*`);
  for (const n of Array.from(input.neighbourhoods)) if (n) for (const p of SOLD_NBHD_PREFIXES) out.add(`${p}${n}*`);
  return Array.from(out);
}

async function keysMatching(pattern: string): Promise<string[]> {
  if (!redis) return [];
  const found: string[] = [];
  let cursor: string | number = 0;
  do {
    const [next, keys] = (await redis.scan(cursor, { match: pattern, count: 200 })) as [string | number, string[]];
    found.push(...keys);
    cursor = next;
  } while (String(cursor) !== "0");
  return found;
}

export interface SoldPurgeResult {
  exact: number;
  patterns: number;
  /** keys deleted on the first pass (the exact keys plus every pattern match) */
  deleted: number;
  /** pattern matches deleted again on the settle pass: keys an in-flight render wrote back */
  settled: number;
  skipped: boolean;
  error?: string;
}

/** A render that began before the sync's last write can finish after the purge and put the
 *  pre-sync figure back. Observed on the first proof run: the homepage re-cached 59 against a
 *  table of 60 inside a second of the purge. So the purge runs twice, the second pass after the
 *  longest render a page takes, and any key an in-flight render wrote back in between goes too. */
export const SOLD_PURGE_SETTLE_MS = 10_000;

export async function purgeSoldDerivedCaches(
  input: { streetSlugs: Set<string> | string[]; neighbourhoods: Set<string> | string[] },
  opts: { settleMs?: number } = {},
): Promise<SoldPurgeResult> {
  if (!redis) return { exact: 0, patterns: 0, deleted: 0, settled: 0, skipped: true };
  const patterns = soldPurgePatterns(input);
  const settleMs = opts.settleMs ?? SOLD_PURGE_SETTLE_MS;
  try {
    const pass = async (): Promise<{ total: number; fromPatterns: number }> => {
      const matched = new Set<string>(SOLD_WIDE_KEYS);
      let fromPatterns = 0;
      for (const p of patterns) for (const k of await keysMatching(p)) { if (!matched.has(k)) fromPatterns++; matched.add(k); }
      const keys = Array.from(matched);
      // DEL in slices: Upstash accepts many keys per call, but a per-street list can be long.
      for (let i = 0; i < keys.length; i += 100) await invalidateMany(keys.slice(i, i + 100));
      return { total: keys.length, fromPatterns };
    };
    const first = await pass();
    if (settleMs > 0) await new Promise((r) => setTimeout(r, settleMs));
    const second = settleMs > 0 ? await pass() : { total: 0, fromPatterns: 0 };
    return { exact: SOLD_WIDE_KEYS.length, patterns: patterns.length, deleted: first.total, settled: second.fromPatterns, skipped: false };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[sold-cache-purge] failed: ${message}`);
    return { exact: SOLD_WIDE_KEYS.length, patterns: patterns.length, deleted: 0, settled: 0, skipped: false, error: message };
  }
}

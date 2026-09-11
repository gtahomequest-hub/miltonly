// DATA FLOW RULES — never violate:
// DB1 (operationalDb) → listings, leads, users, auth, compliance
// DB2 (soldDb, schema: sold) → raw VOW sold records, price history
// DB3 (analyticsDb, schema: analytics) → pre-computed stats, scores, monthly aggregates
// DB2 → DB3: nightly compute job only. One direction. Never reverse.
// DB2 → Claude API: NEVER. Sold records never enter any AI prompt.
// DB3 → Claude API: aggregated stats only. Never individual records.
// DB2 → DB1: NEVER. Sold data never enters operational database.
// Redis: caches reads from DB3 and DB1. Never writes source data.
//
// Architecture: single Neon instance, two named schemas ('sold', 'analytics').
// Splittable into separate databases later by pointing the env vars at different
// Neon instances — zero table rework. 'public' schema is intentionally empty.
// All queries fully qualify table names (e.g., `sold.sold_records`) — do not
// rely on search_path, since Neon's HTTP transport is stateless per query.
//
// Graceful degradation: if an env var is unset, the client is null. Callers
// must handle null (log + fallback). Build compiles clean without env vars.
//
// LAZY ACCESSORS: The Neon clients are constructed at first call, NOT at
// module load. Eager top-level construction would freeze the clients to
// null whenever env vars are populated AFTER imports resolve (any script
// using a runtime loadEnvLocal() pattern). With lazy accessors, callers
// get the live process.env state at call time. Vercel (env vars present
// before any code runs) is unaffected.

import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import { prisma } from "./prisma";

export { prisma as operationalDb };

type Sql = NeonQueryFunction<false, false>;

// THE SECOND CACHE, AND ITS TAG (MC-010, 2026-09-11). The Neon HTTP driver runs every query as
// a fetch, and Next caches a fetch that carries `next.revalidate` in its Data Cache, keyed by
// the request body, which for a SQL query is the SQL text and its parameters. So every DB2 and
// DB3 read made from a page was served from a one-hour cache that no Upstash purge could reach.
// Measured 2026-09-11: with the Upstash key deleted and the table at 60, production rendered
// the homepage's month-to-date figure as 59 four times in twenty seconds; the same code and the
// same query from a plain process read 60. The hour is deliberate (it is what keeps a burst of
// renders off the database), so it stays, tagged: the sold sync and /api/revalidate can drop
// the whole tag the moment the rows change. `db2` is the sold schema, `db3` the analytics one.
export const DB_CACHE_TAG: Record<string, string> = {
  SOLD_DATABASE_URL: "db2",
  ANALYTICS_DATABASE_URL: "db3",
};

function makeClient(envKey: string): Sql | null {
  const url = process.env[envKey];
  if (!url) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[db] ${envKey} is not set — client disabled`);
    }
    return null;
  }
  const tag = DB_CACHE_TAG[envKey];
  return neon(url, { fetchOptions: { next: { revalidate: 3600, ...(tag ? { tags: [tag] } : {}) } } });
}

// `undefined` = not yet attempted, `null` = attempted and env var was missing.
let _soldDb: Sql | null | undefined = undefined;
let _analyticsDb: Sql | null | undefined = undefined;

// DB2 — writes/reads for the sold schema. Always qualify: `sold.sold_records`.
export function getSoldDb(): Sql | null {
  if (_soldDb === undefined) _soldDb = makeClient("SOLD_DATABASE_URL");
  return _soldDb;
}

// DB3 — writes/reads for the analytics schema. Always qualify: `analytics.street_sold_stats`.
export function getAnalyticsDb(): Sql | null {
  if (_analyticsDb === undefined) _analyticsDb = makeClient("ANALYTICS_DATABASE_URL");
  return _analyticsDb;
}

export function requireSoldDb(): Sql {
  const db = getSoldDb();
  if (!db) throw new Error("SOLD_DATABASE_URL is not configured");
  return db;
}

export function requireAnalyticsDb(): Sql {
  const db = getAnalyticsDb();
  if (!db) throw new Error("ANALYTICS_DATABASE_URL is not configured");
  return db;
}

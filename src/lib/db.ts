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

import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import { prisma } from "./prisma";

export { prisma as operationalDb };

type Sql = NeonQueryFunction<false, false>;

function makeClient(envKey: string): Sql | null {
  const url = process.env[envKey];
  if (!url) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[db] ${envKey} is not set — client disabled`);
    }
    return null;
  }
  return neon(url);
}

// DB2 — writes/reads for the sold schema. Always qualify: `sold.sold_records`.
export const soldDb: Sql | null = makeClient("SOLD_DATABASE_URL");

// DB3 — writes/reads for the analytics schema. Always qualify: `analytics.street_sold_stats`.
export const analyticsDb: Sql | null = makeClient("ANALYTICS_DATABASE_URL");

export function requireSoldDb(): Sql {
  if (!soldDb) throw new Error("SOLD_DATABASE_URL is not configured");
  return soldDb;
}

export function requireAnalyticsDb(): Sql {
  if (!analyticsDb) throw new Error("ANALYTICS_DATABASE_URL is not configured");
  return analyticsDb;
}

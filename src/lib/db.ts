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
// MC-046 (PropTx VOW Best Practices item 40): THE ONE DOOR. The DB2 and DB3 clients left this
// file for src/lib/vow/door.ts, which hands a connection out only against a VowAccess (a reader
// who passed canSeeVowRecords, a cron's Authorization header, or an offline script). The
// Data Cache tags live in src/lib/vow/cacheTags.ts. Offline scripts open DB2/DB3 through
// scripts/lib/vow-db.ts. This file keeps the data-flow rules above and the DB1 export.

import { prisma } from "./prisma";

export { prisma as operationalDb };

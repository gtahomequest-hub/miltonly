// One-shot migration: create analytics.street_lease_coverage_log table.
//
// Part 4 step 6.5 (2026-05-09). Records per-street lease coverage as a
// side-effect of buildGeneratorInput so we can empirically measure k-anon
// gate fire rates after Part 4 ships.
//
// DB2 (sold/analytics) schema is not managed by Prisma. This script runs
// the CREATE TABLE IF NOT EXISTS as a one-shot. Idempotent — safe to re-run.
//
// Run before deploying the Part 4 buildGeneratorInput change:
//   npx tsx scripts/migrate-create-lease-coverage-log.ts

import { readFileSync } from "node:fs";
function loadEnvLocal(): void {
  try {
    const raw = readFileSync(".env.local", "utf-8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (m && !process.env[m[1]]) {
        let v = m[2].replace(/\\n$/, "");
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
        process.env[m[1]] = v;
      }
    }
  } catch {}
}
loadEnvLocal();

import { getAnalyticsDb } from "@/lib/db";

async function main() {
  const ad = getAnalyticsDb();
  if (!ad) {
    console.error("Analytics DB not configured. Set ANALYTICS_DB_URL in .env.local.");
    process.exit(1);
  }

  console.log("Creating analytics.street_lease_coverage_log if not exists...");
  await ad`
    CREATE TABLE IF NOT EXISTS analytics.street_lease_coverage_log (
      id                BIGSERIAL PRIMARY KEY,
      street_slug       TEXT NOT NULL,
      lease_count_12mo  INTEGER NOT NULL,
      has_recent_records BOOLEAN NOT NULL,
      has_range_stats   BOOLEAN NOT NULL,
      fallback_reason   TEXT,
      recorded_at       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    )
  `;
  console.log("Table created (or already existed).");

  console.log("Creating index on (street_slug, recorded_at DESC)...");
  await ad`
    CREATE INDEX IF NOT EXISTS street_lease_coverage_log_slug_recorded_idx
    ON analytics.street_lease_coverage_log (street_slug, recorded_at DESC)
  `;
  console.log("Index created (or already existed).");

  // Smoke test: insert + select
  await ad`
    INSERT INTO analytics.street_lease_coverage_log
      (street_slug, lease_count_12mo, has_recent_records, has_range_stats, fallback_reason)
    VALUES ('__migration_smoke_test__', 0, FALSE, FALSE, 'smoke_test')
  `;
  const rows = await ad`
    SELECT street_slug, lease_count_12mo, has_recent_records, has_range_stats, fallback_reason
    FROM analytics.street_lease_coverage_log
    WHERE street_slug = '__migration_smoke_test__'
  ` as unknown as Array<Record<string, unknown>>;
  console.log(`Smoke test row inserted + read back: ${JSON.stringify(rows[0])}`);

  await ad`
    DELETE FROM analytics.street_lease_coverage_log
    WHERE street_slug = '__migration_smoke_test__'
  `;
  console.log("Smoke test row deleted. Migration complete.");
}

main().catch((e) => {
  console.error("Migration failed:", e);
  process.exit(1);
});

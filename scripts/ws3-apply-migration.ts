// WS3 STEP B — apply the migration via pg (Prisma engine hits Neon cold-start
// P1001 on this branch; pg connects reliably). Runs the migration.sql inside a
// transaction, then records it in _prisma_migrations with the SAME checksum
// Prisma uses (sha256 hex of the migration.sql bytes) so `migrate status`/deploy
// stay consistent for prod promotion. Idempotent: skips if already recorded.
//
// HARD GUARD: refuses to run unless the target host is the ws3-staging endpoint.
// Usage: DATABASE_URL/DIRECT_DATABASE_URL from .env.staging; npx tsx scripts/ws3-apply-migration.ts

import pg from "pg";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATION = "20260529011359_ws3_entity_taxonomy";
const SQL_PATH = resolve(__dirname, "..", "prisma", "migrations", MIGRATION, "migration.sql");

function loadEnv(name: string) {
  try {
    for (const line of readFileSync(resolve(__dirname, "..", name), "utf8").split(/\r?\n/)) {
      const t = line.trim(); if (!t || t.startsWith("#")) continue;
      const eq = t.indexOf("="); if (eq === -1) continue;
      const k = t.slice(0, eq).trim(); let v = t.slice(eq + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      process.env[k] = v;
    }
  } catch { /* ignore */ }
}

async function main() {
  // PROD promotion (Option A, Brain-approved). Loads .env (prod ep-patient-paper).
  // Requires explicit `--prod` argv so the script can never run by accident.
  if (!process.argv.includes("--prod")) {
    console.error("❌ GUARD: prod apply requires the explicit --prod flag. Refusing to run.");
    process.exit(1);
  }
  loadEnv(".env");
  const url = (process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL || "").trim();
  const host = (url.match(/@([^/?]+)/) || [])[1] || "";
  if (!host.startsWith("ep-patient-paper-aebh7f93")) {
    console.error(`❌ GUARD: target host ${host} is not prod (ep-patient-paper-aebh7f93). Refusing to run.`);
    process.exit(1);
  }
  console.log(`Target (PROD): ${host}`);

  const sql = readFileSync(SQL_PATH, "utf8");
  const checksum = createHash("sha256").update(sql, "utf8").digest("hex");
  console.log(`Migration: ${MIGRATION}\nChecksum : ${checksum}`);

  const c = new pg.Client({ connectionString: url });
  await c.connect();
  try {
    // Ensure _prisma_migrations exists (it does on a branched DB, but be safe).
    await c.query(`CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
      id varchar(36) PRIMARY KEY NOT NULL,
      checksum varchar(64) NOT NULL,
      finished_at timestamptz,
      migration_name varchar(255) NOT NULL,
      logs text,
      rolled_back_at timestamptz,
      started_at timestamptz NOT NULL DEFAULT now(),
      applied_steps_count integer NOT NULL DEFAULT 0
    )`);

    const existing = await c.query(`SELECT migration_name, finished_at FROM "_prisma_migrations" WHERE migration_name=$1`, [MIGRATION]);
    if (existing.rows.length && existing.rows[0].finished_at) {
      console.log("Already applied + recorded — nothing to do (idempotent).");
      return;
    }

    // Apply schema changes + record migration atomically.
    await c.query("BEGIN");
    await c.query(sql);
    await c.query(
      `INSERT INTO "_prisma_migrations"
        (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
       VALUES (gen_random_uuid()::text, $1, now(), $2, NULL, NULL, now(), 1)
       ON CONFLICT (id) DO NOTHING`,
      [checksum, MIGRATION]
    );
    await c.query("COMMIT");
    console.log("✅ Migration applied + recorded in _prisma_migrations (transactional).");
  } catch (e) {
    await c.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    await c.end();
  }
}
main().catch((e) => { console.error("fatal:", e instanceof Error ? e.message : e); process.exit(1); });

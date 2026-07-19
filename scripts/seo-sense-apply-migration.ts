// SEO sense loop — apply the migration via pg (Prisma Rust engine hits
// Neon cold-start P1001 from this machine; pg connects reliably). Clone of
// scripts/ws5-condo-apply-migration.ts: host guard at the live DB1 host
// (ep-patient-paper) + explicit --prod flag; CRLF->LF normalization BEFORE
// hashing AND applying so the recorded checksum matches the committed LF
// bytes regardless of Windows checkout. Idempotent skip if already recorded.
// Usage: npx tsx scripts/seo-sense-apply-migration.ts --prod

import pg from "pg";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATION = "20260718234500_seo_sense_loop";
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
  if (!process.argv.includes("--prod")) {
    console.error("GUARD: prod apply requires the explicit --prod flag. Refusing to run.");
    process.exit(1);
  }
  loadEnv(".env");
  loadEnv(".env.local");
  const url = (process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL || "").trim();
  const host = (url.match(/@([^/?]+)/) || [])[1] || "";
  if (!host.startsWith("ep-patient-paper-aebh7f93")) {
    console.error(`GUARD: target host ${host} is not prod DB1 (ep-patient-paper-aebh7f93). Refusing to run.`);
    process.exit(1);
  }
  console.log(`Target (PROD DB1): ${host}`);

  const sql = readFileSync(SQL_PATH, "utf8").replace(/\r\n/g, "\n");
  const checksum = createHash("sha256").update(sql, "utf8").digest("hex");
  console.log(`Migration: ${MIGRATION}\nChecksum : ${checksum}`);

  const c = new pg.Client({ connectionString: url });
  await c.connect();
  try {
    const existing = await c.query(`SELECT migration_name, finished_at FROM "_prisma_migrations" WHERE migration_name=$1`, [MIGRATION]);
    if (existing.rows.length && existing.rows[0].finished_at) {
      console.log("Already applied + recorded — nothing to do (idempotent).");
      return;
    }

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
    console.log("Migration applied + recorded in _prisma_migrations (transactional).");

    const check = await c.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('SeoOpportunity','SeoActionLog','SenseRun','SeoCoverageState') ORDER BY table_name`
    );
    console.log(`Tables live: ${check.rows.map((r: { table_name: string }) => r.table_name).join(", ")}`);
  } catch (e) {
    await c.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    await c.end();
  }
}
main().catch((e) => { console.error("fatal:", e instanceof Error ? e.message : e); process.exit(1); });

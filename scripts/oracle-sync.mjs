// Daily incremental sync: Neon DB2 (sold schema) → local ORACLE Postgres.
//
// Append-only: rows are UPSERTed on mls_number. Existing rows are updated in
// place; nothing is ever deleted. The local copy is the permanent archive —
// Neon may prune, the local ORACLE keeps everything forever.
//
// Cursor: local max(modification_timestamp) on sold.sold_records. First run
// (empty local table) pulls the full source. Later runs pull only rows with
// modification_timestamp > local max.
//
// Idempotent: safe to run any number of times. If nothing has changed in
// Neon since the last sync, the script reports 0 new/changed records and
// exits without writes.
//
// Usage:
//   node scripts/oracle-sync.mjs           # sync now
//   node scripts/oracle-sync.mjs --dry-run # plan only, no writes
//
// Env (read from .env.local):
//   SOLD_DATABASE_URL    — Neon DB2 (source)
//   ORACLE_DATABASE_URL  — local Postgres (destination)

import { neon } from "@neondatabase/serverless";
import pg from "pg";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");

// --- env loader --------------------------------------------------------------
// Mirrors scripts/backfill-list-office-name.mjs. Handles literal "\n" that has
// been observed inside double-quoted DATABASE_URL values in this repo's
// .env.local — without this pass it corrupts URLs downstream.
function loadEnvLocal() {
  const envPath = resolve(REPO_ROOT, ".env.local");
  let content;
  try {
    content = readFileSync(envPath, "utf8");
  } catch (e) {
    console.error(`[oracle-sync] could not read ${envPath}: ${e.message}`);
    process.exit(1);
  }
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    const isDoubleQuoted = val.startsWith('"') && val.endsWith('"');
    const isSingleQuoted = val.startsWith("'") && val.endsWith("'");
    if (isDoubleQuoted || isSingleQuoted) {
      val = val.slice(1, -1);
    }
    if (isDoubleQuoted) {
      val = val
        .replace(/\\n/g, "\n")
        .replace(/\\r/g, "\r")
        .replace(/\\t/g, "\t")
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, "\\");
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}
loadEnvLocal();

const SOLD_DATABASE_URL = (process.env.SOLD_DATABASE_URL || "").trim();
const ORACLE_DATABASE_URL = (process.env.ORACLE_DATABASE_URL || "").trim();
const DRY_RUN = process.argv.includes("--dry-run");

function assertEnv() {
  const missing = [];
  if (!SOLD_DATABASE_URL) missing.push("SOLD_DATABASE_URL");
  if (!ORACLE_DATABASE_URL) missing.push("ORACLE_DATABASE_URL");
  if (missing.length > 0) {
    console.error(
      `[oracle-sync] missing required env: ${missing.join(", ")}. ` +
        `Set them in .env.local and re-run.`
    );
    process.exit(1);
  }
}

// Column list mirrors migrations/sold/001_initial.sql + 002 + 003. Order must
// match the VALUES clause and the SELECT against the source.
const COLUMNS = [
  "id",
  "mls_number",
  "address",
  "street_name",
  "street_slug",
  "neighbourhood",
  "city",
  "list_price",
  "sold_price",
  "sold_date",
  "list_date",
  "days_on_market",
  "sold_to_ask_ratio",
  "beds",
  "baths",
  "property_type",
  "sqft_range",
  "lat",
  "lng",
  "display_address",
  "perm_advertise",
  "mls_status",
  "modification_timestamp",
  "created_at",
  "updated_at",
  "transaction_type",
  "standard_status",
  "list_office_name",
];

// Columns updated on conflict. Excludes id + created_at — keep the original
// row's primary key and first-seen timestamp stable across upserts.
const UPDATE_COLUMNS = COLUMNS.filter(
  (c) => c !== "id" && c !== "mls_number" && c !== "created_at"
);

function buildUpsertSql() {
  const placeholders = COLUMNS.map((_, i) => `$${i + 1}`).join(", ");
  const updateSet = UPDATE_COLUMNS.map((c) => `${c} = EXCLUDED.${c}`).join(
    ",\n    "
  );
  return `
    INSERT INTO sold.sold_records (${COLUMNS.join(", ")})
    VALUES (${placeholders})
    ON CONFLICT (mls_number) DO UPDATE SET
      ${updateSet}
  `;
}

async function main() {
  assertEnv();
  const started = Date.now();
  console.log(`[oracle-sync] mode: ${DRY_RUN ? "DRY-RUN" : "WRITE"}`);

  const source = neon(SOLD_DATABASE_URL);
  const dest = new pg.Client({ connectionString: ORACLE_DATABASE_URL });
  await dest.connect();

  try {
    // --- find cursor on local -------------------------------------------------
    let maxMod;
    try {
      const r = await dest.query(
        "SELECT MAX(modification_timestamp) AS max_mod FROM sold.sold_records"
      );
      maxMod = r.rows[0].max_mod; // Date | null
    } catch (e) {
      console.error(
        `[oracle-sync] could not read local sold.sold_records — ` +
          `does the schema exist on ORACLE? Apply migrations/sold/*.sql first. ` +
          `Underlying error: ${e.message}`
      );
      process.exit(1);
    }

    const cursorLabel = maxMod
      ? maxMod.toISOString()
      : "(empty — pulling full source)";
    console.log(`[oracle-sync] local cursor: ${cursorLabel}`);

    // --- pull deltas from Neon -----------------------------------------------
    // SELECT * is fine here — we map by column name below when building the
    // INSERT values, so the column order in the result doesn't matter.
    const rows = maxMod
      ? await source`
          SELECT * FROM sold.sold_records
          WHERE modification_timestamp > ${maxMod}
          ORDER BY modification_timestamp ASC
        `
      : await source`
          SELECT * FROM sold.sold_records
          ORDER BY modification_timestamp ASC NULLS FIRST
        `;

    console.log(`[oracle-sync] fetched ${rows.length} row(s) from Neon`);

    if (DRY_RUN) {
      console.log(
        `[oracle-sync] DRY-RUN: would upsert ${rows.length} row(s). ` +
          `First 3 mls_numbers: ${rows
            .slice(0, 3)
            .map((r) => r.mls_number)
            .join(", ") || "(none)"}. Exiting without writes.`
      );
      return;
    }

    // --- upsert into local ---------------------------------------------------
    let written = 0;
    if (rows.length > 0) {
      const upsertSql = buildUpsertSql();
      await dest.query("BEGIN");
      try {
        for (const row of rows) {
          const values = COLUMNS.map((c) => row[c] ?? null);
          await dest.query(upsertSql, values);
          written++;
          if (written % 500 === 0) {
            console.log(`[oracle-sync] progress: ${written}/${rows.length}`);
          }
        }
        await dest.query("COMMIT");
      } catch (e) {
        await dest.query("ROLLBACK").catch(() => {});
        throw e;
      }
    }

    const totalResult = await dest.query(
      "SELECT COUNT(*)::bigint AS n FROM sold.sold_records"
    );
    const total = totalResult.rows[0].n.toString();
    const elapsedSec = ((Date.now() - started) / 1000).toFixed(1);

    console.log(
      `Synced ${written} new/changed records. Total local rows: ${total}.`
    );
    console.log(`[oracle-sync] elapsed: ${elapsedSec}s`);
  } finally {
    await dest.end().catch(() => {});
  }
}

main().catch((e) => {
  console.error("[oracle-sync] FATAL:", e);
  process.exit(1);
});

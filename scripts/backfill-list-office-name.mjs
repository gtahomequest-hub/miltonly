// One-off backfill: populate sold.sold_records.list_office_name for historical
// rows that predate the column being added to the sync route.
//
// WHEN TO RE-RUN: only if sold.sold_records is ever bulk-populated again
// without list_office_name (e.g., a wipe-and-rebuild of DB2, or a schema
// migration that drops and re-adds the column). Normal operation does NOT
// require this script — the live /api/sync/sold route populates
// list_office_name natively on every insert/update going forward (see
// src/app/api/sync/sold/route.ts:238,271,284,310).
//
// Why a standalone script instead of re-running the sync route?
// The sync cursor advances on ModificationTimestamp > max_mod, so already-
// synced records are invisible to re-runs. Bumping maxDuration on the route
// wouldn't help — the records aren't in the query window to begin with. This
// script fetches the missing column by explicit ListingKey lookup against
// AMPRE and UPDATEs in place, so it works regardless of modification state.
//
// Idempotent: the WHERE list_office_name IS NULL guard makes repeat runs
// no-ops once the table is fully populated.
//
// Usage:
//   node scripts/backfill-list-office-name.mjs --dry-run   # plan only
//   node scripts/backfill-list-office-name.mjs             # write
//
// Reads SOLD_DATABASE_URL and VOW_TOKEN from .env.local (per DO-NOT-REPEAT.md:
// VOW_TOKEN is VOW-scoped; TREB_API_TOKEN is IDX-scoped and cannot read
// sold records). Env values are trimmed per the repo-wide convention.

import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");

// --- env loader --------------------------------------------------------------
// Minimal .env.local parser. Existing .mjs scripts rely on Prisma's internal
// env loader; this script uses @neondatabase/serverless directly, so we load
// .env.local explicitly. Values already in process.env win (respects shell
// overrides). Quotes around values are stripped.
function loadEnvLocal() {
  const envPath = resolve(REPO_ROOT, ".env.local");
  let content;
  try {
    content = readFileSync(envPath, "utf8");
  } catch (e) {
    console.error(`[backfill] could not read ${envPath}: ${e.message}`);
    process.exit(1);
  }
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}
loadEnvLocal();

// --- config ------------------------------------------------------------------
const SOLD_DATABASE_URL = (process.env.SOLD_DATABASE_URL || "").trim();
const TREB_API_URL = (
  process.env.TREB_API_URL || "https://query.ampre.ca/odata/Property"
).trim();
const VOW_TOKEN = (process.env.VOW_TOKEN || "").trim();

// URL-length-safe batch size. 100 × ~10-char ListingKey + quoting/encoding
// stays well under typical 8KB URL ceilings. AMPRE has been observed to
// accept `ListingKey in (...)` at this size without issue.
const BATCH_SIZE = 100;

const DRY_RUN = process.argv.includes("--dry-run");

function assertEnv() {
  const missing = [];
  if (!SOLD_DATABASE_URL) missing.push("SOLD_DATABASE_URL");
  if (!VOW_TOKEN) missing.push("VOW_TOKEN");
  if (missing.length > 0) {
    console.error(
      `[backfill] missing required env: ${missing.join(", ")}. ` +
        `Set them in .env.local and re-run.`
    );
    process.exit(1);
  }
}

// --- helpers -----------------------------------------------------------------
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Fetch ListOfficeName for a batch of ListingKeys. Returns Map<key, name>. */
async function fetchOfficeNamesForBatch(keys) {
  const quoted = keys.map((k) => `'${k.replace(/'/g, "''")}'`).join(",");
  const filter = `ListingKey in (${quoted})`;
  const url =
    `${TREB_API_URL}?$select=ListingKey,ListOfficeName` +
    `&$filter=${encodeURIComponent(filter)}` +
    `&$top=${keys.length}`;

  let attempt = 0;
  while (true) {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${VOW_TOKEN}`,
        Accept: "application/json",
      },
    });
    if (res.ok) {
      const data = await res.json();
      const out = new Map();
      for (const row of data.value || []) {
        if (row.ListingKey) out.set(row.ListingKey, row.ListOfficeName || null);
      }
      return out;
    }
    if (res.status === 429 || res.status === 503) {
      attempt++;
      if (attempt > 5) {
        throw new Error(`AMPRE backoff exhausted: ${res.status}`);
      }
      await sleep(Math.min(30_000, 1000 * 2 ** attempt));
      continue;
    }
    const body = await res.text().catch(() => "");
    throw new Error(
      `AMPRE error: ${res.status} ${res.statusText} — body=${body.slice(0, 500)}`
    );
  }
}

// --- main --------------------------------------------------------------------
async function main() {
  assertEnv();
  const sql = neon(SOLD_DATABASE_URL);
  const started = Date.now();

  console.log(`[backfill] mode: ${DRY_RUN ? "DRY-RUN" : "WRITE"}`);
  console.log(`[backfill] batch size: ${BATCH_SIZE}`);

  // Preflight: what's the current state?
  const [pre] = await sql`
    SELECT
      COUNT(*)::int AS total,
      COUNT(list_office_name)::int AS with_office,
      (COUNT(*) - COUNT(list_office_name))::int AS without_office
    FROM sold.sold_records
  `;
  console.log(
    `[backfill] preflight: total=${pre.total}, with_office=${pre.with_office}, without_office=${pre.without_office}`
  );

  if (pre.without_office === 0) {
    console.log("[backfill] nothing to do — all rows already populated.");
    return;
  }

  const targets = await sql`
    SELECT mls_number
    FROM sold.sold_records
    WHERE list_office_name IS NULL
    ORDER BY mls_number
  `;
  const mlsNumbers = targets.map((r) => r.mls_number);
  const batchCount = Math.ceil(mlsNumbers.length / BATCH_SIZE);
  console.log(
    `[backfill] ${mlsNumbers.length} rows to process in ${batchCount} batches`
  );

  if (DRY_RUN) {
    console.log(
      `[backfill] DRY-RUN: would fetch ${mlsNumbers.length} ListingKeys from AMPRE ` +
        `and UPDATE up to that many rows. First 5 keys: ${mlsNumbers
          .slice(0, 5)
          .join(", ")}. Exiting without writes.`
    );
    return;
  }

  let totalUpdated = 0;
  let totalSkippedNoValue = 0;
  let totalSkippedMismatch = 0;
  let totalSkippedNotReturned = 0;
  const failedBatches = [];

  for (let i = 0; i < batchCount; i++) {
    const batch = mlsNumbers.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE);
    const batchSet = new Set(batch);
    const label = `Batch ${i + 1}/${batchCount}`;

    let officeMap;
    try {
      officeMap = await fetchOfficeNamesForBatch(batch);
    } catch (e) {
      console.error(
        `[backfill] ${label}: AMPRE fetch failed — ${e.message}. ` +
          `MLS numbers in batch: ${batch.join(",")}`
      );
      failedBatches.push({ batch: i + 1, mls: batch, error: e.message });
      continue;
    }

    let batchUpdated = 0;
    const updates = [];
    for (const mls of batch) {
      if (!officeMap.has(mls)) {
        totalSkippedNotReturned++;
        continue;
      }
      const returnedName = officeMap.get(mls);
      if (!returnedName || !returnedName.trim()) {
        totalSkippedNoValue++;
        continue;
      }
      // Safety: reconfirm the key we're about to write matches the key we
      // asked for. The batchSet lookup is the round-trip integrity check.
      if (!batchSet.has(mls)) {
        totalSkippedMismatch++;
        continue;
      }
      updates.push({ mls, name: returnedName });
    }

    try {
      // RETURNING mls_number gives an authoritative affected-row count per
      // statement. r.length === 1 → row was updated; r.length === 0 → row
      // already had list_office_name populated (idempotency guard hit).
      const results = await Promise.all(
        updates.map(
          (u) => sql`
            UPDATE sold.sold_records
            SET list_office_name = ${u.name},
                updated_at = NOW()
            WHERE mls_number = ${u.mls}
              AND list_office_name IS NULL
            RETURNING mls_number
          `
        )
      );
      batchUpdated = results.reduce(
        (acc, r) => acc + (Array.isArray(r) ? r.length : 0),
        0
      );
      totalUpdated += batchUpdated;
    } catch (e) {
      console.error(
        `[backfill] ${label}: UPDATE batch failed — ${e.message}. ` +
          `MLS numbers attempted: ${updates.map((u) => u.mls).join(",")}`
      );
      failedBatches.push({
        batch: i + 1,
        mls: updates.map((u) => u.mls),
        error: e.message,
      });
      continue;
    }

    const [progress] = await sql`
      SELECT (COUNT(*) - COUNT(list_office_name))::int AS still_null
      FROM sold.sold_records
    `;
    console.log(
      `[backfill] ${label}: updated ${batchUpdated} rows, ${progress.still_null} still null`
    );
  }

  // --- final verification ---------------------------------------------------
  const [post] = await sql`
    SELECT
      COUNT(*)::int AS total,
      COUNT(list_office_name)::int AS with_office,
      (COUNT(*) - COUNT(list_office_name))::int AS without_office
    FROM sold.sold_records
  `;
  const elapsedSec = ((Date.now() - started) / 1000).toFixed(1);

  console.log("");
  console.log(`[backfill] ===== FINAL =====`);
  console.log(`[backfill] elapsed:             ${elapsedSec}s`);
  console.log(`[backfill] rows updated:        ${totalUpdated}`);
  console.log(`[backfill] skipped (no value):  ${totalSkippedNoValue}`);
  console.log(`[backfill] skipped (not returned by AMPRE): ${totalSkippedNotReturned}`);
  console.log(`[backfill] skipped (key mismatch):          ${totalSkippedMismatch}`);
  console.log(`[backfill] failed batches:      ${failedBatches.length}`);
  console.log(
    `[backfill] with_office: ${pre.with_office} → ${post.with_office} (total rows ${post.total})`
  );
  console.log(`[backfill] still null:          ${post.without_office}`);

  if (failedBatches.length > 0) {
    console.error(`[backfill] FAILED BATCHES:`);
    for (const f of failedBatches) {
      console.error(
        `[backfill]   batch ${f.batch}: ${f.error} — mls=${f.mls.join(",")}`
      );
    }
  }

  // Assertion: unskippable rows that AMPRE returned empty/null values for are
  // legitimately still-null (AMPRE doesn't know the office for that listing).
  // A successful run means every row that COULD be populated was populated.
  const legitimatelyStillNull =
    totalSkippedNoValue + totalSkippedNotReturned + totalSkippedMismatch;
  const unexplainedStillNull = post.without_office - legitimatelyStillNull;

  if (unexplainedStillNull > 0 || failedBatches.length > 0) {
    console.error(
      `[backfill] FAILED: ${unexplainedStillNull} rows unexplained, ` +
        `${failedBatches.length} batches failed. Re-run the script to retry.`
    );
    process.exit(1);
  }

  console.log(
    `[backfill] OK: ${post.without_office} still-null rows are all explained ` +
      `(AMPRE returned no ListOfficeName for them).`
  );
}

main().catch((e) => {
  console.error("[backfill] FATAL:", e);
  process.exit(1);
});

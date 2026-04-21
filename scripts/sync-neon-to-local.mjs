// Neon (SOLD_DATABASE_URL) → local prospect (ORACLE_DATABASE_URL) sync.
//
// This is the historical-archive ingress. Neon expires records after ~3 years
// (VOW retention); prospect keeps everything forever — the predictive engine's
// training set. Rule: one-way, never-delete, overwrite-on-update.
//
// Mode auto-detected on startup:
//   full refresh    — if prospect has < 6,000 enriched rows (raw_vow_data
//                     IS NOT NULL count). Walks every Neon record.
//   incremental     — otherwise. Cursor = MAX(modification_timestamp)
//                     from prospect, fetch only newer records.
//
// Sync scope (full enrichment schema after migration 004):
//   sold.sold_records  — 290 columns including raw_vow_data JSONB
//   sold.media         — all columns, delete+insert per touched mls_number
//   sold.rooms         — all columns, delete+insert per touched mls_number
//
// Safety:
//   - Pre-flight aborts if ORACLE_DATABASE_URL hostname isn't localhost/127.0.0.1.
//     Prevents accidentally pointing the overwrite-on-update at Neon or any
//     remote Postgres.
//   - Strict one-way: never opens a write client against Neon.
//   - Never deletes from prospect. Records that fell off Neon stay forever.
//
// Batching:
//   - 500 sold_records per batch (each record = 1 parameterized INSERT —
//     290 cols × 500 rows would blow past pg's 65,535-param wire limit, so
//     we can't bulk-VALUES this table).
//   - 100 mls_numbers per child transaction for media/rooms, with INSERT
//     sub-batches capped at 500 rows for param-limit safety.
//   - 250ms between batches (polite to localhost, no-op for perf).
//
// Logging:
//   [sync] 2000/7001 records (28.6%) — 45s elapsed — 44 rec/s
//
// Idempotent: safe to rerun. Second run after a successful first completes
// with deltas near 0.
//
// Usage: node scripts/sync-neon-to-local.mjs

import pg from "pg";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
function loadEnvLocal() {
  const content = readFileSync(resolve(__dirname, "..", ".env.local"), "utf8");
  for (const line of content.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    const dq = v.startsWith('"') && v.endsWith('"');
    const sq = v.startsWith("'") && v.endsWith("'");
    if (dq || sq) v = v.slice(1, -1);
    if (dq)
      v = v
        .replace(/\\n/g, "\n")
        .replace(/\\r/g, "\r")
        .replace(/\\t/g, "\t")
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, "\\");
    if (process.env[k] === undefined) process.env[k] = v;
  }
}
loadEnvLocal();

// --- config ----------------------------------------------------------------
const SOLD_URL = (process.env.SOLD_DATABASE_URL || "").trim();
const PROSPECT_URL = (process.env.ORACLE_DATABASE_URL || "").trim();

const FIRST_RUN_THRESHOLD = 6000;
const SOLD_BATCH_SIZE = 500;
const CHILD_KEY_CHUNK = 100; // mls_numbers per media/rooms transaction
const INSERT_SUB_BATCH_ROWS = 500; // rows per bulk INSERT (pg param-limit guard)
const INTER_BATCH_DELAY_MS = 250;
const PROGRESS_SOLD = 500;
const PROGRESS_MEDIA = 10_000;
const PROGRESS_ROOMS = 5_000;

if (!SOLD_URL || !PROSPECT_URL) {
  console.error("Missing SOLD_DATABASE_URL or ORACLE_DATABASE_URL in .env.local");
  process.exit(1);
}

// --- pre-flight safety ------------------------------------------------------
const prospectHost = new URL(PROSPECT_URL).hostname;
if (prospectHost !== "localhost" && prospectHost !== "127.0.0.1") {
  console.error(
    `ABORT — ORACLE_DATABASE_URL hostname is '${prospectHost}', not localhost/127.0.0.1. ` +
      `This script performs overwrite-on-update against the target; refusing to run against ` +
      `a non-local host to prevent accidental data loss on Neon or any remote Postgres.`
  );
  process.exit(1);
}
console.log(`[sync] pre-flight ok — target=${prospectHost}`);

// --- helpers ----------------------------------------------------------------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function fmtNum(n) {
  return Number(n).toLocaleString("en-US");
}

function chunks(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

// Columns excluded from UPSERT's UPDATE SET — preserve prospect's local identity
// and first-seen timestamp. mls_number is implicitly excluded as the conflict key.
// updated_at is also excluded here because we set it explicitly to NOW() below;
// including it in EXCLUDED.updated_at would produce "multiple assignments to
// same column" at query time.
const PRESERVE_ON_UPDATE = new Set(["id", "mls_number", "created_at", "updated_at"]);

async function fetchColumns(client, tableSchema, tableName) {
  const { rows } = await client.query(
    `SELECT column_name, data_type FROM information_schema.columns
     WHERE table_schema = $1 AND table_name = $2 ORDER BY ordinal_position`,
    [tableSchema, tableName]
  );
  return rows.map((r) => ({ name: r.column_name, type: r.data_type }));
}

function buildPlaceholder(col, idx) {
  return col.type === "jsonb" ? `$${idx}::jsonb` : `$${idx}`;
}

function serialize(col, v) {
  if (v === null || v === undefined) return null;
  if (col.type === "jsonb") {
    if (typeof v === "string") return v; // already serialized upstream
    return JSON.stringify(v);
  }
  return v;
}

function buildSoldUpsertSql(cols) {
  const colNames = cols.map((c) => c.name);
  const placeholders = cols.map((c, i) => buildPlaceholder(c, i + 1)).join(", ");
  const updateSet = cols
    .filter((c) => !PRESERVE_ON_UPDATE.has(c.name))
    .map((c) => `${c.name} = EXCLUDED.${c.name}`)
    .concat(["updated_at = NOW()"])
    .join(",\n    ");
  return `
    INSERT INTO sold.sold_records (${colNames.join(", ")})
    VALUES (${placeholders})
    ON CONFLICT (mls_number) DO UPDATE SET
      ${updateSet}
    RETURNING (xmax = 0) AS inserted
  `;
}

function buildBulkInsertSql(tableName, cols, rowCount) {
  const colNames = cols.map((c) => c.name);
  const tuples = [];
  let paramIdx = 1;
  for (let r = 0; r < rowCount; r++) {
    const ph = cols.map((c) => buildPlaceholder(c, paramIdx++));
    tuples.push(`(${ph.join(", ")})`);
  }
  return `INSERT INTO ${tableName} (${colNames.join(", ")}) VALUES ${tuples.join(", ")}`;
}

function bulkValues(rows, cols) {
  const out = [];
  for (const row of rows) {
    for (const c of cols) out.push(serialize(c, row[c.name]));
  }
  return out;
}

// --- connect ----------------------------------------------------------------
const src = new pg.Client({ connectionString: SOLD_URL });
const dst = new pg.Client({ connectionString: PROSPECT_URL });
await src.connect();
await dst.connect();
console.log(`[sync] connected to source (Neon) and target (prospect)`);

const started = Date.now();
let inserted = 0;
let updated = 0;
let rowErrors = 0;
let batchRollbacks = 0;
let mediaWritten = 0;
let mediaDeleted = 0;
let roomsWritten = 0;
let roomsDeleted = 0;
const errors = [];

try {
  // --- before counts --------------------------------------------------------
  const { rows: [before] } = await dst.query(`
    SELECT
      (SELECT COUNT(*)::int FROM sold.sold_records)             AS sold_rows,
      (SELECT COUNT(*)::int FROM sold.sold_records WHERE raw_vow_data IS NOT NULL) AS enriched_rows,
      (SELECT COUNT(*)::int FROM sold.media)                    AS media_rows,
      (SELECT COUNT(*)::int FROM sold.rooms)                    AS rooms_rows
  `);
  console.log(
    `[sync] prospect BEFORE: sold=${fmtNum(before.sold_rows)} enriched=${fmtNum(before.enriched_rows)} ` +
      `media=${fmtNum(before.media_rows)} rooms=${fmtNum(before.rooms_rows)}`
  );

  const { rows: [neonCounts] } = await src.query(`
    SELECT
      (SELECT COUNT(*)::int FROM sold.sold_records) AS sold_rows,
      (SELECT COUNT(*)::int FROM sold.media)        AS media_rows,
      (SELECT COUNT(*)::int FROM sold.rooms)        AS rooms_rows
  `);
  console.log(
    `[sync] neon source:     sold=${fmtNum(neonCounts.sold_rows)} media=${fmtNum(neonCounts.media_rows)} ` +
      `rooms=${fmtNum(neonCounts.rooms_rows)}`
  );

  // --- mode detection -------------------------------------------------------
  const isFullRefresh = before.enriched_rows < FIRST_RUN_THRESHOLD;
  let cursorMod = null;
  let cursorKey = "";
  if (!isFullRefresh) {
    const { rows: [{ max_mod }] } = await dst.query(
      `SELECT MAX(modification_timestamp) AS max_mod FROM sold.sold_records`
    );
    cursorMod = max_mod; // Date | null; pg returns TIMESTAMPTZ as Date
  }
  console.log(
    `[sync] mode=${isFullRefresh ? "FULL REFRESH" : "INCREMENTAL"} ` +
      `cursor=${cursorMod ? cursorMod.toISOString() : "(epoch)"}`
  );

  // --- column introspection (from target so we build SQL for its schema) ---
  const soldCols = await fetchColumns(dst, "sold", "sold_records");
  const mediaCols = await fetchColumns(dst, "sold", "media");
  const roomsCols = await fetchColumns(dst, "sold", "rooms");
  console.log(
    `[sync] columns: sold_records=${soldCols.length}, media=${mediaCols.length}, rooms=${roomsCols.length}`
  );

  const soldUpsertSql = buildSoldUpsertSql(soldCols);

  // --- sold_records loop ----------------------------------------------------
  const touchedKeys = new Set();

  let batchIdx = 0;
  while (true) {
    // Fetch next batch from Neon using keyset pagination.
    // First iteration (cursorMod null): no WHERE clause, just ORDER+LIMIT.
    let neonRows;
    if (cursorMod === null) {
      const res = await src.query(
        `SELECT * FROM sold.sold_records
         WHERE modification_timestamp IS NOT NULL
         ORDER BY modification_timestamp ASC, mls_number ASC
         LIMIT $1`,
        [SOLD_BATCH_SIZE]
      );
      neonRows = res.rows;
    } else {
      const res = await src.query(
        `SELECT * FROM sold.sold_records
         WHERE (modification_timestamp > $1)
            OR (modification_timestamp = $1 AND mls_number > $2)
         ORDER BY modification_timestamp ASC, mls_number ASC
         LIMIT $3`,
        [cursorMod, cursorKey, SOLD_BATCH_SIZE]
      );
      neonRows = res.rows;
    }
    if (neonRows.length === 0) break;
    batchIdx++;

    // Transaction per batch, rollback on catastrophic error, continue.
    let batchInsertedCount = 0;
    let batchUpdatedCount = 0;
    try {
      await dst.query("BEGIN");
      for (const row of neonRows) {
        const params = soldCols.map((c) => serialize(c, row[c.name]));
        try {
          const res = await dst.query(soldUpsertSql, params);
          if (res.rows[0]?.inserted) batchInsertedCount++;
          else batchUpdatedCount++;
          touchedKeys.add(row.mls_number);
        } catch (err) {
          rowErrors++;
          const msg = err instanceof Error ? err.message : String(err);
          errors.push({ phase: "sold-row", key: row.mls_number, message: msg });
          console.error(`[sync] row upsert failed for ${row.mls_number}: ${msg}`);
          // Abort this transaction on row error; caller catches and rolls back.
          throw err;
        }
      }
      await dst.query("COMMIT");
      inserted += batchInsertedCount;
      updated += batchUpdatedCount;
    } catch (txErr) {
      await dst.query("ROLLBACK").catch(() => {});
      batchRollbacks++;
      const msg = txErr instanceof Error ? txErr.message : String(txErr);
      errors.push({ phase: "sold-batch", key: `batch-${batchIdx}`, message: msg });
      console.error(`[sync] batch ${batchIdx} rolled back: ${msg}`);
      // Touched keys we recorded before the rollback shouldn't be synced as
      // children (their parent row isn't in prospect). Remove them.
      for (const row of neonRows) touchedKeys.delete(row.mls_number);
    }

    // Advance cursor to the last row we saw (regardless of commit/rollback
    // — otherwise we'd loop forever re-fetching the same batch).
    const last = neonRows[neonRows.length - 1];
    cursorMod = last.modification_timestamp; // Date
    cursorKey = last.mls_number;

    // Progress log every PROGRESS_SOLD records.
    const processed = inserted + updated + rowErrors;
    if (processed % PROGRESS_SOLD < SOLD_BATCH_SIZE) {
      const elapsed = Math.round((Date.now() - started) / 1000);
      const rate = elapsed > 0 ? (processed / elapsed).toFixed(1) : "∞";
      const pct =
        neonCounts.sold_rows > 0
          ? ((processed / neonCounts.sold_rows) * 100).toFixed(1)
          : "?";
      console.log(
        `[sync] ${fmtNum(processed)}/${fmtNum(neonCounts.sold_rows)} records (${pct}%) — ${elapsed}s elapsed — ${rate} rec/s`
      );
    }

    if (neonRows.length < SOLD_BATCH_SIZE) break;
    await sleep(INTER_BATCH_DELAY_MS);
  }

  const afterSoldMs = Date.now() - started;
  console.log(
    `[sync] sold_records pass done: ins=${fmtNum(inserted)} upd=${fmtNum(updated)} ` +
      `err=${rowErrors} rollbacks=${batchRollbacks} touched=${fmtNum(touchedKeys.size)} ` +
      `(${(afterSoldMs / 1000).toFixed(1)}s)`
  );

  // --- media sync -----------------------------------------------------------
  const touchedList = [...touchedKeys];
  console.log(`[sync] media pass starting for ${fmtNum(touchedList.length)} listings`);

  for (const keyGroup of chunks(touchedList, CHILD_KEY_CHUNK)) {
    // Fetch Neon media for this group.
    let neonMedia;
    try {
      const res = await src.query(
        `SELECT * FROM sold.media WHERE mls_number = ANY($1) ORDER BY mls_number, order_index NULLS LAST`,
        [keyGroup]
      );
      neonMedia = res.rows;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push({ phase: "media-fetch", key: keyGroup[0] + "..+" + (keyGroup.length - 1), message: msg });
      console.error(`[sync] media fetch failed for group starting ${keyGroup[0]}: ${msg}`);
      continue;
    }

    // Transaction: delete existing for these keys, then bulk insert.
    try {
      await dst.query("BEGIN");
      const del = await dst.query(
        `DELETE FROM sold.media WHERE mls_number = ANY($1)`,
        [keyGroup]
      );
      mediaDeleted += del.rowCount || 0;

      for (const subBatch of chunks(neonMedia, INSERT_SUB_BATCH_ROWS)) {
        if (subBatch.length === 0) continue;
        const sql = buildBulkInsertSql("sold.media", mediaCols, subBatch.length);
        const vals = bulkValues(subBatch, mediaCols);
        await dst.query(sql, vals);
      }

      await dst.query("COMMIT");
      mediaWritten += neonMedia.length;

      if (mediaWritten % PROGRESS_MEDIA < neonMedia.length) {
        const elapsed = Math.round((Date.now() - started) / 1000);
        console.log(`[sync] media ${fmtNum(mediaWritten)} rows written (${elapsed}s elapsed)`);
      }
    } catch (err) {
      await dst.query("ROLLBACK").catch(() => {});
      batchRollbacks++;
      const msg = err instanceof Error ? err.message : String(err);
      errors.push({ phase: "media-batch", key: keyGroup[0] + "..+" + (keyGroup.length - 1), message: msg });
      console.error(`[sync] media batch rolled back (start ${keyGroup[0]}): ${msg}`);
    }

    await sleep(INTER_BATCH_DELAY_MS);
  }

  const afterMediaMs = Date.now() - started;
  console.log(
    `[sync] media pass done: ${fmtNum(mediaWritten)} rows written, ${fmtNum(mediaDeleted)} deleted ` +
      `(${((afterMediaMs - afterSoldMs) / 1000).toFixed(1)}s)`
  );

  // --- rooms sync -----------------------------------------------------------
  console.log(`[sync] rooms pass starting for ${fmtNum(touchedList.length)} listings`);

  for (const keyGroup of chunks(touchedList, CHILD_KEY_CHUNK)) {
    let neonRooms;
    try {
      const res = await src.query(
        `SELECT * FROM sold.rooms WHERE mls_number = ANY($1) ORDER BY mls_number, order_index NULLS LAST`,
        [keyGroup]
      );
      neonRooms = res.rows;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push({ phase: "rooms-fetch", key: keyGroup[0] + "..+" + (keyGroup.length - 1), message: msg });
      console.error(`[sync] rooms fetch failed for group starting ${keyGroup[0]}: ${msg}`);
      continue;
    }

    try {
      await dst.query("BEGIN");
      const del = await dst.query(
        `DELETE FROM sold.rooms WHERE mls_number = ANY($1)`,
        [keyGroup]
      );
      roomsDeleted += del.rowCount || 0;

      // Prospect uses SERIAL id — don't write the Neon 'id' value.
      const roomsColsNoId = roomsCols.filter((c) => c.name !== "id");

      for (const subBatch of chunks(neonRooms, INSERT_SUB_BATCH_ROWS)) {
        if (subBatch.length === 0) continue;
        const sql = buildBulkInsertSql("sold.rooms", roomsColsNoId, subBatch.length);
        const vals = bulkValues(subBatch, roomsColsNoId);
        await dst.query(sql, vals);
      }

      await dst.query("COMMIT");
      roomsWritten += neonRooms.length;

      if (roomsWritten % PROGRESS_ROOMS < neonRooms.length) {
        const elapsed = Math.round((Date.now() - started) / 1000);
        console.log(`[sync] rooms ${fmtNum(roomsWritten)} rows written (${elapsed}s elapsed)`);
      }
    } catch (err) {
      await dst.query("ROLLBACK").catch(() => {});
      batchRollbacks++;
      const msg = err instanceof Error ? err.message : String(err);
      errors.push({ phase: "rooms-batch", key: keyGroup[0] + "..+" + (keyGroup.length - 1), message: msg });
      console.error(`[sync] rooms batch rolled back (start ${keyGroup[0]}): ${msg}`);
    }

    await sleep(INTER_BATCH_DELAY_MS);
  }

  // --- after counts ---------------------------------------------------------
  const { rows: [after] } = await dst.query(`
    SELECT
      (SELECT COUNT(*)::int FROM sold.sold_records) AS sold_rows,
      (SELECT COUNT(*)::int FROM sold.media)        AS media_rows,
      (SELECT COUNT(*)::int FROM sold.rooms)        AS rooms_rows,
      (SELECT COUNT(*)::int FROM sold.sold_records WHERE raw_vow_data IS NOT NULL) AS enriched_rows
  `);

  // --- retention diff: records in prospect NOT in Neon (the moat) ---------
  // Cheap for our scale: ~7k keys, ~160KB of text both ways.
  const [{ rows: neonAllKeys }, { rows: prospectAllKeys }] = await Promise.all([
    src.query(`SELECT mls_number FROM sold.sold_records`),
    dst.query(`SELECT mls_number FROM sold.sold_records`),
  ]);
  const neonSet = new Set(neonAllKeys.map((r) => r.mls_number));
  const retainedLocally = prospectAllKeys.filter((r) => !neonSet.has(r.mls_number));
  const retainedCount = retainedLocally.length;

  // --- final report --------------------------------------------------------
  const elapsedSec = Math.round((Date.now() - started) / 1000);
  console.log("");
  console.log("=== SYNC COMPLETE ===");
  console.log(`  mode                : ${isFullRefresh ? "FULL REFRESH" : "INCREMENTAL"}`);
  console.log(`  elapsed             : ${elapsedSec}s`);
  console.log("");
  console.log("  sold_records");
  console.log(`    before            : ${fmtNum(before.sold_rows)}`);
  console.log(`    after             : ${fmtNum(after.sold_rows)}`);
  console.log(`    delta             : ${fmtNum(after.sold_rows - before.sold_rows)}`);
  console.log(`    inserted          : ${fmtNum(inserted)}`);
  console.log(`    updated           : ${fmtNum(updated)}`);
  console.log(`    enriched (before) : ${fmtNum(before.enriched_rows)}`);
  console.log(`    enriched (after)  : ${fmtNum(after.enriched_rows)}`);
  console.log("");
  console.log("  sold.media");
  console.log(`    before            : ${fmtNum(before.media_rows)}`);
  console.log(`    after             : ${fmtNum(after.media_rows)}`);
  console.log(`    delta             : ${fmtNum(after.media_rows - before.media_rows)}`);
  console.log(`    written           : ${fmtNum(mediaWritten)}`);
  console.log(`    deleted (churn)   : ${fmtNum(mediaDeleted)}`);
  console.log("");
  console.log("  sold.rooms");
  console.log(`    before            : ${fmtNum(before.rooms_rows)}`);
  console.log(`    after             : ${fmtNum(after.rooms_rows)}`);
  console.log(`    delta             : ${fmtNum(after.rooms_rows - before.rooms_rows)}`);
  console.log(`    written           : ${fmtNum(roomsWritten)}`);
  console.log(`    deleted (churn)   : ${fmtNum(roomsDeleted)}`);
  console.log("");
  console.log(`  historical moat     : ${fmtNum(retainedCount)} records retained locally, no longer in Neon`);
  console.log(`  row errors          : ${fmtNum(rowErrors)}`);
  console.log(`  batch rollbacks     : ${fmtNum(batchRollbacks)}`);

  if (errors.length > 0) {
    console.log("");
    console.log("  first 10 errors:");
    for (const e of errors.slice(0, 10)) {
      console.log(`    [${e.phase}] ${e.key}: ${e.message.slice(0, 150)}`);
    }
  }

  if (retainedCount > 0 && retainedCount <= 20) {
    console.log("");
    console.log(`  retained keys: ${retainedLocally.slice(0, 20).map((r) => r.mls_number).join(", ")}`);
  } else if (retainedCount > 20) {
    console.log(`  first 20 retained keys: ${retainedLocally.slice(0, 20).map((r) => r.mls_number).join(", ")}`);
  }
} finally {
  await src.end().catch(() => {});
  await dst.end().catch(() => {});
}

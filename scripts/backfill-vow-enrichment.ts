// Backfill: re-fetch every existing sold.sold_records row from AMPRE and
// write the full enrichment (all ~260 new columns + raw_vow_data + media + rooms).
//
// Runs locally via pg against Neon (SOLD_DATABASE_URL). Long-running — expect
// ~20–30 min for the full 7,001 records. Vercel Functions would time out;
// the Fluid Compute 300s default is not enough for this job.
//
// Strategy (matches the user's 2026-04-19 plan):
//   - Pull every existing mls_number from sold.sold_records (ordered for stability)
//   - Batch 20 at a time via OR-chain on ListingKey
//   - For each batch in parallel: Property records + Media + Rooms
//   - Upsert property via shared core; DELETE+INSERT media and rooms per listing
//   - 500ms sleep between batches (be kind to AMPRE)
//   - Log progress every 500 records
//   - Idempotent — safe to re-run if interrupted; failed listings retried on next run
//
// Usage: npx tsx scripts/backfill-vow-enrichment.ts [--limit=N] [--start-from=MLS]

import pg from "pg";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  SELECT_FIELDS, // noqa: preserve import so SELECT_FIELDS is bundled
  mapAmpToSoldColumns,
  buildSoldRecordUpsertSql,
  buildSoldRecordValues,
  buildMediaInsertSql,
  buildMediaValues,
  buildRoomsInsertSql,
  buildRoomsValues,
  fetchPropertyBatchByKeys,
  fetchMediaBatch,
  fetchRoomsBatch,
  type AmpConfig,
  type SqlExecutor,
} from "../src/lib/vow-sync";

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

const NEON_URL = (process.env.SOLD_DATABASE_URL || "").trim();
const PROPERTY_URL = (process.env.TREB_API_URL || "https://query.ampre.ca/odata/Property").trim();
const VOW_TOKEN = (process.env.VOW_TOKEN || "").trim();

if (!NEON_URL || !VOW_TOKEN) {
  console.error("Missing SOLD_DATABASE_URL or VOW_TOKEN in .env.local");
  process.exit(1);
}

const BATCH_SIZE = 20;
const INTER_BATCH_DELAY_MS = 500;
const PROGRESS_INTERVAL = 500;

const limitArg = process.argv.find((a) => a.startsWith("--limit="));
const LIMIT = limitArg ? parseInt(limitArg.split("=")[1] || "0", 10) : Infinity;
const startArg = process.argv.find((a) => a.startsWith("--start-from="));
const START_FROM: string | null = startArg ? startArg.split("=")[1] || null : null;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function pgExecutor(client: pg.Client): SqlExecutor {
  return async (text, values) => {
    const r = await client.query(text, values);
    return r.rows as Record<string, unknown>[];
  };
}

async function main() {
  void SELECT_FIELDS;
  const started = Date.now();
  console.log(
    `[backfill] target=Neon (SOLD_DATABASE_URL), limit=${LIMIT === Infinity ? "all" : LIMIT}` +
      (START_FROM ? `, start_from=${START_FROM}` : "")
  );

  const client = new pg.Client({ connectionString: NEON_URL });
  await client.connect();
  const db = pgExecutor(client);

  const amp: AmpConfig = { propertyUrl: PROPERTY_URL, token: VOW_TOKEN };
  const upsertSql = buildSoldRecordUpsertSql();

  let propertyUpdates = 0;
  let propertyInserts = 0;
  let mediaWritten = 0;
  let roomsWritten = 0;
  let amprmMissing = 0; // listings we have locally but AMPRE didn't return
  const failures: Array<{ key: string; phase: string; message: string }> = [];

  try {
    // --- Load target MLS numbers ---------------------------------------------
    const { rows: keyRows } = await client.query<{ mls_number: string }>(
      `SELECT mls_number FROM sold.sold_records
       ${START_FROM ? `WHERE mls_number >= $1` : ""}
       ORDER BY mls_number ASC`,
      START_FROM ? [START_FROM] : []
    );
    const allKeys = keyRows.map((r) => r.mls_number);
    const keys = LIMIT === Infinity ? allKeys : allKeys.slice(0, LIMIT);
    console.log(`[backfill] loaded ${keys.length} target mls_numbers (of ${allKeys.length} total)`);

    const batchCount = Math.ceil(keys.length / BATCH_SIZE);
    let processed = 0;

    for (let bi = 0; bi < batchCount; bi++) {
      const batch = keys.slice(bi * BATCH_SIZE, (bi + 1) * BATCH_SIZE);

      // Parallel fetch: Property + Media + Rooms
      let properties: Awaited<ReturnType<typeof fetchPropertyBatchByKeys>> = [];
      let mediaMap = new Map<string, Awaited<ReturnType<typeof fetchMediaBatch>>["values"] extends IterableIterator<infer X> ? X : never>();
      let roomsMap = new Map<string, Awaited<ReturnType<typeof fetchRoomsBatch>>["values"] extends IterableIterator<infer X> ? X : never>();

      try {
        const [p, m, r] = await Promise.all([
          fetchPropertyBatchByKeys(amp, batch),
          fetchMediaBatch(amp, batch),
          fetchRoomsBatch(amp, batch),
        ]);
        properties = p;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        mediaMap = m as any;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        roomsMap = r as any;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        for (const key of batch) failures.push({ key, phase: "ampre-fetch", message: msg });
        console.error(`[backfill] batch ${bi + 1}/${batchCount} fetch failed: ${msg}`);
        processed += batch.length;
        if ((bi + 1) % 25 === 0) await sleep(INTER_BATCH_DELAY_MS);
        continue;
      }

      const propsByKey = new Map<string, (typeof properties)[number]>();
      for (const p of properties) {
        const k = p.ListingKey as string | undefined;
        if (k) propsByKey.set(k, p);
      }

      for (const key of batch) {
        processed++;
        const item = propsByKey.get(key);
        if (!item) {
          amprmMissing++;
          failures.push({ key, phase: "ampre-missing", message: "AMPRE returned no record" });
          continue;
        }

        // Required NOT NULL columns on sold.sold_records still apply.
        const txn = item.TransactionType as string | undefined;
        if (txn !== "For Sale" && txn !== "For Lease") {
          failures.push({ key, phase: "txn-skip", message: `TransactionType=${txn}` });
          continue;
        }
        const listPrice = Number(item.ListPrice ?? 0);
        const soldPrice = Number(item.ClosePrice ?? 0);
        const closeDate = item.CloseDate as string | null;
        const listDate =
          (item.ListingContractDate as string | null) ??
          (item.OriginalEntryTimestamp as string | null) ??
          closeDate;
        if (!closeDate || !listDate || soldPrice <= 0 || listPrice <= 0) {
          failures.push({ key, phase: "required-fields", message: "missing price/date" });
          continue;
        }

        const mapped = mapAmpToSoldColumns(item);
        const values = buildSoldRecordValues(mapped);

        // Property upsert
        try {
          const res = await db(upsertSql, values);
          if (res[0]?.inserted) propertyInserts++;
          else propertyUpdates++;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          failures.push({ key, phase: "property-upsert", message: msg });
          continue;
        }

        // Media delete+insert
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mediaItems = (mediaMap.get(key) ?? []) as any[];
        try {
          await db(`DELETE FROM sold.media WHERE mls_number = $1`, [key]);
          if (mediaItems.length > 0) {
            const sql = buildMediaInsertSql(mediaItems.length);
            const vals = buildMediaValues(mediaItems, key);
            await db(sql, vals);
            mediaWritten += mediaItems.length;
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          failures.push({ key, phase: "media-write", message: msg });
        }

        // Rooms delete+insert
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const roomItems = (roomsMap.get(key) ?? []) as any[];
        try {
          await db(`DELETE FROM sold.rooms WHERE mls_number = $1`, [key]);
          if (roomItems.length > 0) {
            const sql = buildRoomsInsertSql(roomItems.length);
            const vals = buildRoomsValues(roomItems, key);
            await db(sql, vals);
            roomsWritten += roomItems.length;
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          failures.push({ key, phase: "rooms-write", message: msg });
        }
      }

      // Progress log every PROGRESS_INTERVAL records.
      if (
        processed % PROGRESS_INTERVAL < BATCH_SIZE ||
        bi === batchCount - 1
      ) {
        const elapsed = (Date.now() - started) / 1000;
        const rate = processed / elapsed;
        const eta = rate > 0 ? Math.round((keys.length - processed) / rate) : 0;
        console.log(
          `[backfill] ${processed}/${keys.length} ` +
            `(ins=${propertyInserts} upd=${propertyUpdates} missing=${amprmMissing} ` +
            `media=${mediaWritten} rooms=${roomsWritten} fails=${failures.length}) ` +
            `${rate.toFixed(1)} rec/s, ETA ${eta}s`
        );
      }

      // Inter-batch pacing.
      if (bi < batchCount - 1) await sleep(INTER_BATCH_DELAY_MS);
    }

    const durationMs = Date.now() - started;
    console.log("");
    console.log("=== BACKFILL SUMMARY ===");
    console.log(`  elapsed        : ${(durationMs / 1000).toFixed(1)}s`);
    console.log(`  targets        : ${keys.length}`);
    console.log(`  properties ins : ${propertyInserts}`);
    console.log(`  properties upd : ${propertyUpdates}`);
    console.log(`  missing in AMPRE: ${amprmMissing}`);
    console.log(`  media rows     : ${mediaWritten}`);
    console.log(`  rooms rows     : ${roomsWritten}`);
    console.log(`  failures       : ${failures.length}`);

    if (failures.length > 0) {
      // Surface by phase for quick triage.
      const byPhase: Record<string, number> = {};
      for (const f of failures) byPhase[f.phase] = (byPhase[f.phase] ?? 0) + 1;
      console.log("  failures by phase:");
      for (const [phase, n] of Object.entries(byPhase)) {
        console.log(`    ${phase}: ${n}`);
      }
      console.log("  first 10 failures:");
      for (const f of failures.slice(0, 10)) {
        console.log(`    [${f.phase}] ${f.key}: ${f.message.slice(0, 150)}`);
      }
    }
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error("[backfill] FATAL:", e);
  process.exit(1);
});

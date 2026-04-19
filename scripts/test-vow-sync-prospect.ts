// Local verification harness for migration 004 + the new VOW sync mapping.
// Runs against local prospect ORACLE DB via pg (not Neon). Imports the shared
// mapping + SQL from src/lib/vow-sync.ts — no duplicated logic.
//
// Pulls the 50 most-recently-closed Milton records from AMPRE, runs them
// through the same mapping the production sync uses, writes to prospect's
// sold.sold_records + sold.media + sold.rooms. Idempotent (ON CONFLICT and
// delete-then-insert for children).
//
// Intentionally bypasses the cursor-based backfill/incremental logic — this
// harness exists to exercise the mapping against a fixed set of records,
// not to stay in sync with the feed.
//
// Usage: npx tsx scripts/test-vow-sync-prospect.ts [--limit=50]

import pg from "pg";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  SELECT_FIELDS,
  mapAmpToSoldColumns,
  buildSoldRecordUpsertSql,
  buildSoldRecordValues,
  buildMediaInsertSql,
  buildMediaValues,
  buildRoomsInsertSql,
  buildRoomsValues,
  fetchMediaBatch,
  fetchRoomsBatch,
  type AmpConfig,
  type AmpRecord,
  type SqlExecutor,
} from "../src/lib/vow-sync";

// --- env loader (matches scripts/oracle-sync.mjs pattern) -------------------
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

const ORACLE_URL = (process.env.ORACLE_DATABASE_URL || "").trim();
const PROPERTY_URL = (process.env.TREB_API_URL || "https://query.ampre.ca/odata/Property").trim();
const VOW_TOKEN = (process.env.VOW_TOKEN || "").trim();

const limitArg = process.argv.find((a) => a.startsWith("--limit="));
const LIMIT = limitArg ? parseInt(limitArg.split("=")[1] || "50", 10) : 50;
const SIBLING_BATCH = 20;

// Optional filter: --transaction-type="For Sale" | "For Lease". Default: both.
const txnArg = process.argv.find((a) => a.startsWith("--transaction-type="));
const TXN_FILTER = txnArg ? txnArg.slice(txnArg.indexOf("=") + 1).replace(/^["']|["']$/g, "") : null;
if (TXN_FILTER && TXN_FILTER !== "For Sale" && TXN_FILTER !== "For Lease") {
  console.error(`--transaction-type must be "For Sale" or "For Lease", got: ${TXN_FILTER}`);
  process.exit(1);
}

if (!ORACLE_URL || !VOW_TOKEN) {
  console.error("Missing ORACLE_DATABASE_URL or VOW_TOKEN in .env.local");
  process.exit(1);
}

// --- pg adapter for SqlExecutor interface -----------------------------------
function pgExecutor(client: pg.Client): SqlExecutor {
  return async (text, values) => {
    const r = await client.query(text, values);
    return r.rows as Record<string, unknown>[];
  };
}

// --- fetch the 50 most-recently-closed Milton records -----------------------
async function fetchRecentProperties(): Promise<AmpRecord[]> {
  const baseFilter = `City eq 'Milton' and StandardStatus eq 'Closed'`;
  const filter = TXN_FILTER
    ? `${baseFilter} and TransactionType eq '${TXN_FILTER}'`
    : baseFilter;
  const select = SELECT_FIELDS.join(",");
  const url =
    `${PROPERTY_URL}?$select=${select}` +
    `&$filter=${encodeURIComponent(filter)}` +
    `&$top=${LIMIT}&$orderby=${encodeURIComponent("CloseDate desc")}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${VOW_TOKEN}`, Accept: "application/json" },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`AMPRE error: ${res.status} ${res.statusText} — ${body.slice(0, 500)}`);
  }
  const data = (await res.json()) as { value?: AmpRecord[] };
  return data.value ?? [];
}

// --- main -------------------------------------------------------------------
async function main() {
  const started = Date.now();
  console.log(
    `[test-vow-sync] limit=${LIMIT}, target=prospect` +
      (TXN_FILTER ? `, transaction_type=${TXN_FILTER}` : "")
  );

  const client = new pg.Client({ connectionString: ORACLE_URL });
  await client.connect();
  const db = pgExecutor(client);

  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  let mediaWritten = 0;
  let roomsWritten = 0;
  const errors: Array<{ key: string; phase: string; message: string }> = [];
  const writtenKeys: string[] = [];

  try {
    const records = await fetchRecentProperties();
    console.log(`[test-vow-sync] fetched ${records.length} properties from AMPRE`);

    const upsertSql = buildSoldRecordUpsertSql();

    for (const item of records) {
      const listingKey = (item.ListingKey as string | undefined) || "";
      if (!listingKey) {
        skipped++;
        continue;
      }

      // Same garbage + required-field checks as the production route.
      if (String(item.City ?? "").toLowerCase() === "deleted") { skipped++; continue; }
      if (String(item.StreetName ?? "").toLowerCase() === "deleted") { skipped++; continue; }

      const txn = item.TransactionType as string | undefined;
      if (txn !== "For Sale" && txn !== "For Lease") { skipped++; continue; }

      const listPrice = Number(item.ListPrice ?? 0);
      const soldPrice = Number(item.ClosePrice ?? 0);
      const closeDate = item.CloseDate as string | null;
      const listDate =
        (item.ListingContractDate as string | null) ??
        (item.OriginalEntryTimestamp as string | null) ??
        closeDate;
      if (!closeDate || !listDate || soldPrice <= 0 || listPrice <= 0) {
        skipped++;
        continue;
      }

      const mapped = mapAmpToSoldColumns(item);
      const values = buildSoldRecordValues(mapped);

      try {
        const res = await db(upsertSql, values);
        if (res[0]?.inserted) inserted++;
        else updated++;
        writtenKeys.push(listingKey);
      } catch (err) {
        skipped++;
        const msg = err instanceof Error ? err.message : String(err);
        errors.push({ key: listingKey, phase: "property-upsert", message: msg });
        console.error(`[test-vow-sync] upsert failed for ${listingKey}: ${msg}`);
      }
    }

    console.log(
      `[test-vow-sync] properties: inserted=${inserted} updated=${updated} skipped=${skipped}`
    );

    const amp: AmpConfig = { propertyUrl: PROPERTY_URL, token: VOW_TOKEN };

    for (let i = 0; i < writtenKeys.length; i += SIBLING_BATCH) {
      const batch = writtenKeys.slice(i, i + SIBLING_BATCH);

      const [mediaMap, roomsMap] = await Promise.all([
        fetchMediaBatch(amp, batch).catch((e) => {
          errors.push({ key: batch.join(","), phase: "media-fetch", message: String(e) });
          console.error(`[test-vow-sync] media fetch failed: ${String(e)}`);
          return new Map();
        }),
        fetchRoomsBatch(amp, batch).catch((e) => {
          errors.push({ key: batch.join(","), phase: "rooms-fetch", message: String(e) });
          console.error(`[test-vow-sync] rooms fetch failed: ${String(e)}`);
          return new Map();
        }),
      ]);

      for (const key of batch) {
        const mediaItems = mediaMap.get(key) ?? [];
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
          errors.push({ key, phase: "media-write", message: msg });
          console.error(`[test-vow-sync] media write failed for ${key}: ${msg}`);
        }

        const roomItems = roomsMap.get(key) ?? [];
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
          errors.push({ key, phase: "rooms-write", message: msg });
          console.error(`[test-vow-sync] rooms write failed for ${key}: ${msg}`);
        }
      }
    }

    const elapsedMs = Date.now() - started;
    console.log("");
    console.log("=== SUMMARY ===");
    console.log(`  elapsed           : ${(elapsedMs / 1000).toFixed(1)}s`);
    console.log(`  properties total  : ${records.length}`);
    console.log(`  properties written: ${writtenKeys.length} (inserted=${inserted} updated=${updated})`);
    console.log(`  properties skipped: ${skipped}`);
    console.log(`  media rows        : ${mediaWritten}`);
    console.log(`  rooms rows        : ${roomsWritten}`);
    console.log(`  errors            : ${errors.length}`);
    if (errors.length > 0) {
      console.log("");
      console.log("=== ERRORS ===");
      for (const e of errors.slice(0, 20)) {
        console.log(`  [${e.phase}] ${e.key}: ${e.message}`);
      }
    }
    console.log("");
    console.log(`[test-vow-sync] written listingKeys: ${writtenKeys.join(", ")}`);
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error("[test-vow-sync] FATAL:", e);
  process.exit(1);
});

// Backfill: populate tenure fields on active Listing rows that the /api/sync/detect
// cron created with NULL tenure (BUG 1). detect omitted propertySubType /
// propertyTypeRaw / parcelOfTiedLand, so every detect-created listing since
// ~2026-06-16 is invisible to the freehold/condo tenure hubs (they filter on
// TRIM(property_sub_type)). This re-fetches those listings from the AMPRE feed
// by ListingKey and writes the tenure fields FROM THE FEED — never guessed.
//
// nothing-fake: the mapped `propertyType` alone can't split freehold-townhouse
// from condo-townhouse (both -> "townhouse"), so we do NOT infer tenure from it.
// Only the feed's PropertySubType is authoritative. Rows the feed no longer
// returns (aged out) are LEFT NULL and reported, never guessed.
//
// Mapping mirrors src/lib/sync/treb-sync.ts EXACTLY (raw passthrough, no trim;
// the "Semi-Detached " trailing space PropTx ships is handled by TRIM()/norm()
// at read time in the tenure seam).
//
// Idempotent: only updates rows still NULL (WHERE "propertySubType" IS NULL),
// so re-running is safe and skips already-populated rows.
//
// Usage: npx tsx scripts/backfill-detect-null-tenure.ts [--dry-run] [--limit=N]

import { neon } from "@neondatabase/serverless";
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
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
    if (process.env[k] === undefined) process.env[k] = v;
  }
}
loadEnvLocal();

const DB1_URL = (process.env.DATABASE_URL || "").trim();
const API = (process.env.TREB_API_URL || "https://query.ampre.ca/odata/Property").trim();
const TOKEN = (process.env.TREB_API_TOKEN || process.env.VOW_TOKEN || "").trim();
if (!DB1_URL || !TOKEN) {
  console.error("Missing DATABASE_URL or TREB_API_TOKEN/VOW_TOKEN in .env.local");
  process.exit(1);
}

const DRY_RUN = process.argv.includes("--dry-run");
const limitArg = process.argv.find((a) => a.startsWith("--limit="));
const LIMIT = limitArg ? parseInt(limitArg.split("=")[1], 10) : null;

const db1 = neon(DB1_URL);
const BATCH = 20;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface AmpRow {
  ListingKey: string;
  PropertyType: string | null;
  PropertySubType: string | null;
  ParcelOfTiedLand: string | null;
}

async function fetchTenureBatch(keys: string[]): Promise<Map<string, AmpRow>> {
  const inList = keys.map((k) => `'${k}'`).join(",");
  const sel = ["ListingKey", "PropertyType", "PropertySubType", "ParcelOfTiedLand"].join(",");
  const filter = encodeURIComponent(`ListingKey in (${inList})`);
  const url = `${API}?$select=${sel}&$filter=${filter}&$top=${BATCH * 2}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${TOKEN}`, Accept: "application/json" } });
  if (!res.ok) throw new Error(`AMPRE ${res.status} ${res.statusText}: ${(await res.text()).slice(0, 200)}`);
  const data = (await res.json()) as { value?: AmpRow[] };
  const map = new Map<string, AmpRow>();
  for (const r of data.value || []) map.set(r.ListingKey, r);
  return map;
}

async function main() {
  console.log(`[backfill-detect-null-tenure] mode=${DRY_RUN ? "DRY-RUN" : "APPLY"}${LIMIT ? ` limit=${LIMIT}` : ""}`);

  // Snapshot for the report: NULL tenure across all statuses vs active-only.
  const nullAll = (await db1`SELECT COUNT(*)::int AS n FROM "Listing" WHERE "propertySubType" IS NULL`)[0] as { n: number };
  const nullActive = (await db1`SELECT COUNT(*)::int AS n FROM "Listing" WHERE status='active' AND "propertySubType" IS NULL`)[0] as { n: number };
  console.log(`NULL propertySubType: active=${nullActive.n}, all-statuses=${nullAll.n}`);

  // Target = active rows with NULL tenure (the hub-visible population — "the 129").
  const rows = (await db1`
    SELECT "mlsNumber" FROM "Listing"
    WHERE status='active' AND "propertySubType" IS NULL
    ORDER BY "listedAt" DESC`) as Array<{ mlsNumber: string }>;
  let keys = rows.map((r) => r.mlsNumber);
  if (LIMIT) keys = keys.slice(0, LIMIT);
  console.log(`Targeting ${keys.length} active NULL-tenure listings.`);

  let populated = 0;   // feed returned a usable PropertySubType -> row updated
  let feedNull = 0;    // feed returned the record but PropertySubType was null
  let agedOut = 0;     // feed no longer returns this ListingKey
  const agedOutKeys: string[] = [];
  const feedNullKeys: string[] = [];

  for (let i = 0; i < keys.length; i += BATCH) {
    const batch = keys.slice(i, i + BATCH);
    const feed = await fetchTenureBatch(batch);
    for (const key of batch) {
      const rec = feed.get(key);
      if (!rec) { agedOut++; agedOutKeys.push(key); continue; }
      const sub = rec.PropertySubType || null;
      const raw = rec.PropertyType || null;
      const potl = rec.ParcelOfTiedLand || null;
      if (!sub) { feedNull++; feedNullKeys.push(key); continue; }
      if (!DRY_RUN) {
        // idempotent: only write while still NULL
        await db1`
          UPDATE "Listing"
          SET "propertySubType"=${sub}, "propertyTypeRaw"=${raw}, "parcelOfTiedLand"=${potl}
          WHERE "mlsNumber"=${key} AND "propertySubType" IS NULL`;
      }
      populated++;
    }
    console.log(`  batch ${i / BATCH + 1}: processed ${Math.min(i + BATCH, keys.length)}/${keys.length}`);
    await sleep(400); // be kind to AMPRE
  }

  console.log("\n==== RESULT ====");
  console.log(`targeted        : ${keys.length}`);
  console.log(`populated (feed): ${populated}${DRY_RUN ? " (would populate)" : ""}`);
  console.log(`feed-null subtyp: ${feedNull}  ${feedNullKeys.length ? feedNullKeys.join(",") : ""}`);
  console.log(`aged out (nofeed): ${agedOut}  ${agedOutKeys.length ? agedOutKeys.join(",") : ""}`);

  if (!DRY_RUN) {
    const after = (await db1`SELECT COUNT(*)::int AS n FROM "Listing" WHERE status='active' AND "propertySubType" IS NULL`)[0] as { n: number };
    console.log(`active NULL remaining after backfill: ${after.n} (expected = feed-null + aged-out = ${feedNull + agedOut})`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });

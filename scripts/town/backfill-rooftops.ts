// Backfill resolved rooftop coordinates onto existing records, and apply the DB2 columns.
//
//   npx tsx scripts/town/backfill-rooftops.ts --dry
//   npx tsx scripts/town/backfill-rooftops.ts --apply
//
// Idempotent: re-running resolves only what is still NULL unless --all is passed. The ingest
// write path resolves new records on arrival (src/lib/sync/treb-sync.ts, src/lib/vow-sync.ts);
// this is the one-time catch-up for everything already stored.
//
// Contains information licensed under the Open Government Licence – Milton.
import fs from "node:fs";
import path from "node:path";
import { neon } from "@neondatabase/serverless";
import { PrismaClient } from "@prisma/client";
import { resolveRooftop, isWithinMilton } from "../../src/lib/town/rooftop";

for (const f of [".env", ".env.local"]) {
  const p = path.join(process.cwd(), f);
  if (!fs.existsSync(p)) continue;
  for (const line of fs.readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

async function main(): Promise<void> {
  const APPLY = process.argv.includes("--apply");
  const ALL = process.argv.includes("--all");
  const prisma = new PrismaClient();
  const sold = neon(process.env.SOLD_DATABASE_URL!);

  function report(label: string, total: number, resolved: number, samples: string[]) {
    const pct = total ? ((resolved / total) * 100).toFixed(1) : "0.0";
    console.log(`\n${label}`);
    console.log(`   rows considered : ${total}`);
    console.log(`   resolved        : ${resolved} (${pct}%)`);
    console.log(`   left NULL       : ${total - resolved}`);
    samples.slice(0, 5).forEach((s) => console.log(`      unresolved: ${s}`));
  }

  // ── DB2 · sold.sold_records ──────────────────────────────────────────────────────────────────
  // A dry run does no DDL, so it cannot assume the columns exist — it asks first and treats a
  // missing column as "nothing resolved yet" rather than erroring out mid-report.
  const hasCols = ((await sold`
    SELECT COUNT(*)::int AS n FROM information_schema.columns
    WHERE table_schema = 'sold' AND table_name = 'sold_records' AND column_name = 'town_lat'
  `) as Array<{ n: number }>)[0].n > 0;

  if (APPLY && !hasCols) {
    // Nullable, no default, no sentinel — same contract as the Prisma side.
    await sold`ALTER TABLE sold.sold_records ADD COLUMN IF NOT EXISTS town_lat DOUBLE PRECISION`;
    await sold`ALTER TABLE sold.sold_records ADD COLUMN IF NOT EXISTS town_lng DOUBLE PRECISION`;
    console.log("DB2: town_lat / town_lng created");
  } else if (!hasCols) {
    console.log("DB2: town_lat / town_lng do not exist yet (--apply will create them)");
  }

  const soldRows = (await sold`
    SELECT mls_number, address FROM sold.sold_records
    ${ALL || !hasCols ? sold`` : sold`WHERE town_lat IS NULL`}
  `) as Array<{ mls_number: string; address: string | null }>;

  const soldHits: Array<[string, number, number]> = [];
  const soldMiss: string[] = [];
  for (const r of soldRows) {
    const hit = resolveRooftop(r.address);
    if (hit) soldHits.push([r.mls_number, hit.lat, hit.lng]);
    else soldMiss.push(r.address ?? "(null address)");
  }
  report("DB2 sold.sold_records", soldRows.length, soldHits.length, soldMiss);

  if (APPLY && soldHits.length) {
    for (let i = 0; i < soldHits.length; i += 500) {
      const chunk = soldHits.slice(i, i + 500);
      await sold`
        UPDATE sold.sold_records AS s
        SET town_lat = v.lat, town_lng = v.lng
        FROM (SELECT * FROM UNNEST(
          ${chunk.map((c) => c[0])}::text[],
          ${chunk.map((c) => c[1])}::double precision[],
          ${chunk.map((c) => c[2])}::double precision[]
        ) AS t(mls, lat, lng)) AS v
        WHERE s.mls_number = v.mls
      `;
    }
    console.log(`   DB2 updated: ${soldHits.length}`);
  }

  // ── DB1 · Listing ────────────────────────────────────────────────────────────────────────────
  const listings = await prisma.listing.findMany({
    where: ALL ? {} : { townLat: null },
    select: { mlsNumber: true, address: true },
  });
  const listHits: Array<{ mlsNumber: string; lat: number; lng: number }> = [];
  const listMiss: string[] = [];
  for (const l of listings) {
    const hit = resolveRooftop(l.address);
    if (hit) listHits.push({ mlsNumber: l.mlsNumber, lat: hit.lat, lng: hit.lng });
    else listMiss.push(l.address);
  }
  report("DB1 Listing", listings.length, listHits.length, listMiss);

  if (APPLY && listHits.length) {
    for (const h of listHits) {
      await prisma.listing.update({
        where: { mlsNumber: h.mlsNumber },
        data: { townLat: h.lat, townLng: h.lng },
      });
    }
    console.log(`   DB1 updated: ${listHits.length}`);
  }

  // ── the assertions that matter more than the counts ──────────────────────────────────────────
  const outOfBounds = [...soldHits.map((h) => ({ lat: h[1], lng: h[2] })), ...listHits]
    .filter((h) => !isWithinMilton(h.lat, h.lng));
  const sentinels = [...soldHits.map((h) => ({ lat: h[1], lng: h[2] })), ...listHits]
    .filter((h) => h.lat === 0 || h.lng === 0);
  console.log(`\nASSERT no resolved coordinate is out of bounds : ${outOfBounds.length === 0 ? "PASS" : `FAIL (${outOfBounds.length})`}`);
  console.log(`ASSERT no resolved coordinate is a sentinel    : ${sentinels.length === 0 ? "PASS" : `FAIL (${sentinels.length})`}`);
  console.log(APPLY ? "\napplied." : "\ndry run — pass --apply to write.");

  await prisma.$disconnect();

}

void main();

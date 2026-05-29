// WS3 Step 4 PREVIEW — READ-ONLY recency-weighted VIP classification.
// Proves the method on live DB2 data. NO writes, NO migration. Neighbourhood
// assignment here uses the existing raw neighbourhood STRING (dominant per
// entity) as a stand-in pool key — pending the locked 12-hub mapping (Step 3).
//
// Weights: <=12mo 1.0 | 12-24mo 0.6 | 24-36mo 0.3 | >36mo 0.1. For-Sale only.
// Residential pool = detached|semi|townhouse, entity = street_slug.
// Condo pool = condo, entity = building address (street_number + street_name).
// Top 20% of each pool by weighted sold count, rounded UP, earns VIP.

import pg from "pg";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const content = readFileSync(resolve(__dirname, "..", ".env.local"), "utf8");
for (const line of content.split(/\r?\n/)) {
  const t = line.trim(); if (!t || t.startsWith("#")) continue;
  const eq = t.indexOf("="); if (eq === -1) continue;
  const k = t.slice(0, eq).trim(); let v = t.slice(eq + 1).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  if (process.env[k] === undefined) process.env[k] = v;
}

interface Row { entity: string; neighbourhood: string; weighted: number; raw: number }

const WEIGHTED_SQL = (entityExpr: string, typeFilter: string) => `
  WITH base AS (
    SELECT ${entityExpr} AS entity,
           neighbourhood,
           CASE
             WHEN sold_date >= NOW() - INTERVAL '12 months' THEN 1.0
             WHEN sold_date >= NOW() - INTERVAL '24 months' THEN 0.6
             WHEN sold_date >= NOW() - INTERVAL '36 months' THEN 0.3
             ELSE 0.1 END AS w
    FROM sold.sold_records
    WHERE transaction_type='For Sale' AND ${typeFilter} AND ${entityExpr} IS NOT NULL
  ),
  agg AS (
    SELECT entity, neighbourhood, SUM(w) AS wsum, COUNT(*) AS raw,
           ROW_NUMBER() OVER (PARTITION BY entity ORDER BY COUNT(*) DESC) AS nb_rank
    FROM base GROUP BY entity, neighbourhood
  ),
  dom AS ( SELECT entity FROM agg WHERE nb_rank=1 )
  SELECT a.entity, a.neighbourhood,
         SUM(a.wsum) OVER (PARTITION BY a.entity) AS weighted,
         SUM(a.raw)  OVER (PARTITION BY a.entity) AS raw
  FROM agg a JOIN dom d ON d.entity=a.entity
  WHERE a.nb_rank=1`;

function classify(rows: Row[]) {
  const byNb = new Map<string, Row[]>();
  for (const r of rows) {
    r.weighted = Number(r.weighted); r.raw = Number(r.raw);
    if (!byNb.has(r.neighbourhood)) byNb.set(r.neighbourhood, []);
    byNb.get(r.neighbourhood)!.push(r);
  }
  const result = new Map<string, { pool: Row[]; vipCount: number; vips: Row[] }>();
  for (const [nb, pool] of byNb) {
    pool.sort((a, b) => b.weighted - a.weighted);
    const vipCount = Math.ceil(pool.length * 0.2);
    result.set(nb, { pool, vipCount, vips: pool.slice(0, vipCount) });
  }
  return result;
}

async function main() {
  const c = new pg.Client({ connectionString: (process.env.SOLD_DATABASE_URL || "").trim() });
  await c.connect();
  try {
    const resi = (await c.query<Row>(WEIGHTED_SQL("street_slug", "property_type IN ('detached','semi','townhouse')"))).rows;
    const condo = (await c.query<Row>(WEIGHTED_SQL("(street_number || ' ' || street_name)", "property_type='condo' AND street_number IS NOT NULL"))).rows;

    const resiByNb = classify(resi);
    const condoByNb = classify(condo);

    const allNbs = Array.from(new Set([...resiByNb.keys(), ...condoByNb.keys()])).sort();
    let totalVip = 0;
    console.log("\n===== PER-NEIGHBOURHOOD POOLS & VIP COUNTS (string-keyed preview) =====");
    const table: Array<Record<string, unknown>> = [];
    for (const nb of allNbs) {
      const r = resiByNb.get(nb); const cd = condoByNb.get(nb);
      const rVip = r?.vipCount ?? 0; const cVip = cd?.vipCount ?? 0;
      totalVip += rVip + cVip;
      table.push({
        neighbourhood: nb,
        resi_pool: r?.pool.length ?? 0, resi_vip: rVip,
        condo_pool: cd?.pool.length ?? 0, condo_vip: cVip,
      });
    }
    console.table(table);
    console.log(`\nSITE-WIDE VIP TOTAL (sum across ${allNbs.length} neighbourhoods × 2 pools): ${totalVip}`);

    // VIP names for the 3 largest urban neighbourhoods (illustrative)
    const focus = table
      .filter((t) => String(t.neighbourhood).startsWith("10"))
      .sort((a, b) => (b.resi_pool as number) + (b.condo_pool as number) - ((a.resi_pool as number) + (a.condo_pool as number)))
      .slice(0, 3)
      .map((t) => String(t.neighbourhood));
    for (const nb of focus) {
      console.log(`\n----- ${nb} VIP names -----`);
      console.log("  RESIDENTIAL VIPs:", (resiByNb.get(nb)?.vips ?? []).map((v) => `${v.entity}(w=${v.weighted.toFixed(1)},n=${v.raw})`).join(", ") || "(none)");
      console.log("  CONDO VIPs:      ", (condoByNb.get(nb)?.vips ?? []).map((v) => `${v.entity}(w=${v.weighted.toFixed(1)},n=${v.raw})`).join(", ") || "(none)");
    }

    // Sample VIP + runner-up
    const sampleNb = focus[0];
    const rPool = resiByNb.get(sampleNb)?.pool ?? [];
    const cPool = condoByNb.get(sampleNb)?.pool ?? [];
    console.log(`\n===== SAMPLE VIP vs RUNNER-UP in ${sampleNb} =====`);
    if (rPool.length) {
      const vipCount = Math.ceil(rPool.length * 0.2);
      console.log(`  RESIDENTIAL: VIP #${vipCount} = ${rPool[vipCount-1].entity} (w=${rPool[vipCount-1].weighted.toFixed(2)}) | runner-up #${vipCount+1} = ${rPool[vipCount]?.entity ?? "n/a"} (w=${rPool[vipCount]?.weighted.toFixed(2) ?? "-"})`);
    }
    if (cPool.length) {
      const vipCount = Math.ceil(cPool.length * 0.2);
      console.log(`  CONDO:       VIP #${vipCount} = ${cPool[vipCount-1].entity} (w=${cPool[vipCount-1].weighted.toFixed(2)}) | runner-up #${vipCount+1} = ${cPool[vipCount]?.entity ?? "n/a"} (w=${cPool[vipCount]?.weighted.toFixed(2) ?? "-"})`);
    }
  } finally { await c.end(); }
}
main().catch((e) => { console.error("fatal:", e); process.exit(1); });

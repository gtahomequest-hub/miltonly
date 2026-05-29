// WS3 pre-migration VALIDATION — READ-ONLY. No writes, no migration.
// Produces: (A) full neighbourhood table, (B) Derry Green check,
// (C) MLS name-field audit for condo displayName.
//
// Entity→neighbourhood assignment = dominant raw string (mode by record count).
// Weighted sold = recency weights (<=12mo 1.0/12-24 0.6/24-36 0.3/>36 0.1),
// For-Sale trades only (matches VIP semantics). Entity's full weight attributed
// to its dominant neighbourhood.

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

const W = `CASE
  WHEN sold_date >= NOW()-INTERVAL '12 months' THEN 1.0
  WHEN sold_date >= NOW()-INTERVAL '24 months' THEN 0.6
  WHEN sold_date >= NOW()-INTERVAL '36 months' THEN 0.3
  ELSE 0.1 END`;

// Per-neighbourhood entity count + weighted sold, entity assigned to dominant nb.
const ENTITY_SQL = (entityExpr: string, typeFilter: string) => `
  WITH base AS (
    SELECT ${entityExpr} AS entity, neighbourhood, ${W} AS w
    FROM sold.sold_records
    WHERE transaction_type='For Sale' AND ${typeFilter} AND ${entityExpr} IS NOT NULL
  ),
  ent_nb AS (
    SELECT entity, neighbourhood, COUNT(*) cnt, SUM(w) wsum
    FROM base GROUP BY entity, neighbourhood
  ),
  dom AS (
    SELECT DISTINCT ON (entity) entity, neighbourhood AS dom_nb
    FROM ent_nb ORDER BY entity, cnt DESC
  ),
  ent_tot AS (
    SELECT e.entity, d.dom_nb, SUM(e.wsum) total_w
    FROM ent_nb e JOIN dom d ON d.entity=e.entity
    GROUP BY e.entity, d.dom_nb
  )
  SELECT dom_nb AS neighbourhood, COUNT(*)::int entities, ROUND(SUM(total_w)::numeric,1) weighted
  FROM ent_tot GROUP BY dom_nb`;

// Profile proposal from Brain Claude's locked mapping.
const URBAN = new Set([
  "1023 - BE Beaty","1024 - BM Bronte Meadows","1025 - BW Bowes","1026 - CB Cobban",
  "1027 - CL Clarke","1028 - CO Coates","1029 - DE Dempsey","1031 - DP Dorset Park",
  "1032 - FO Ford","1033 - HA Harrison","1034 - MN Milton North","1035 - OM Old Milton",
  "1036 - SC Scott","1037 - TM Timberlea","1038 - WI Willmott","1051 - Walker",
]);
const RURAL = new Set([
  "1039 - MI Rural Milton","1041 - NA Rural Nassagaweya","1044 - TR Rural Trafalgar",
  "Rural Milton West","Campbellville","Moffat","Brookville/Haltonville","Nassagaweya",
]);
function profile(nb: string): string {
  if (nb === "1030 - DG Derry Green") return "Excluded/Standard (industrial — validate)";
  if (URBAN.has(nb)) return "Urban Hub";
  if (RURAL.has(nb)) return "Rural Hub";
  return "??? UNMAPPED";
}

async function main() {
  const c = new pg.Client({ connectionString: (process.env.SOLD_DATABASE_URL || "").trim() });
  await c.connect();
  try {
    const resi = (await c.query(ENTITY_SQL("street_slug", "property_type IN ('detached','semi','townhouse')"))).rows;
    const condo = (await c.query(ENTITY_SQL("(street_number || ' ' || street_name)", "property_type='condo' AND street_number IS NOT NULL"))).rows;
    // All-records totals (any tx, any type) so thin/lease-only nbhds still appear.
    const allNb = (await c.query(`SELECT neighbourhood, COUNT(*)::int total_records FROM sold.sold_records GROUP BY neighbourhood`)).rows;

    const map = new Map<string, Record<string, unknown>>();
    const ensure = (nb: string) => { if (!map.has(nb)) map.set(nb, { neighbourhood: nb, profile: profile(nb), resi_entities: 0, resi_weighted: 0, condo_buildings: 0, condo_weighted: 0, total_records: 0 }); return map.get(nb)!; };
    for (const r of allNb as Array<{neighbourhood:string; total_records:number}>) ensure(r.neighbourhood).total_records = r.total_records;
    for (const r of resi as Array<{neighbourhood:string; entities:number; weighted:string}>) { const e = ensure(r.neighbourhood); e.resi_entities = r.entities; e.resi_weighted = Number(r.weighted); }
    for (const r of condo as Array<{neighbourhood:string; entities:number; weighted:string}>) { const e = ensure(r.neighbourhood); e.condo_buildings = r.entities; e.condo_weighted = Number(r.weighted); }

    const rows = Array.from(map.values()).sort((a, b) => String(a.neighbourhood).localeCompare(String(b.neighbourhood)));
    console.log("\n===== (A) FULL NEIGHBOURHOOD TABLE =====");
    console.table(rows);
    console.log(`Distinct neighbourhood strings: ${rows.length}`);
    const unmapped = rows.filter((r) => String(r.profile).startsWith("???"));
    if (unmapped.length) console.log("UNMAPPED strings:", unmapped.map((r) => r.neighbourhood));

    // (B) Derry Green
    console.log("\n===== (B) DERRY GREEN CHECK =====");
    console.table(await c.query(`
      SELECT property_type, transaction_type, COUNT(*)::int n
      FROM sold.sold_records WHERE neighbourhood='1030 - DG Derry Green'
      GROUP BY property_type, transaction_type ORDER BY n DESC`).then(r => r.rows));

    // Flag rural coded/uncoded duplicate pairs
    console.log("\n===== RURAL CODED/UNCODED DUPLICATE PAIRS (merge candidates) =====");
    console.table(rows.filter((r) => /nassagaweya|trafalgar|rural milton/i.test(String(r.neighbourhood)))
      .map((r) => ({ neighbourhood: r.neighbourhood, total_records: r.total_records })));

    // (C) Name-field audit
    console.log("\n===== (C) MLS NAME-FIELD AUDIT (condo displayName candidates) =====");
    console.log("Columns in sold_records matching name/building/corp:");
    console.table((await c.query(`SELECT column_name FROM information_schema.columns
      WHERE table_schema='sold' AND table_name='sold_records'
      AND (column_name ILIKE '%name%' OR column_name ILIKE '%building%' OR column_name ILIKE '%corp%' OR column_name ILIKE '%association%' OR column_name ILIKE '%management%')
      ORDER BY column_name`)).rows);

    console.log("\nassociation_name — top values among condo rows:");
    console.table((await c.query(`SELECT association_name, COUNT(*)::int n FROM sold.sold_records
      WHERE property_type='condo' AND association_name IS NOT NULL
      GROUP BY association_name ORDER BY n DESC LIMIT 12`)).rows);

    console.log("\nproperty_management_company — top values among condo rows:");
    console.table((await c.query(`SELECT property_management_company, COUNT(*)::int n FROM sold.sold_records
      WHERE property_type='condo' AND property_management_company IS NOT NULL
      GROUP BY property_management_company ORDER BY n DESC LIMIT 12`)).rows);

    console.log("\nDoes raw_vow_data carry a 'BuildingName' key? (AMPRE $select gate test):");
    console.table((await c.query(`SELECT
      COUNT(*) FILTER (WHERE raw_vow_data ? 'BuildingName')::int has_buildingname,
      COUNT(*) FILTER (WHERE raw_vow_data ? 'BuildingName' AND raw_vow_data->>'BuildingName' IS NOT NULL)::int buildingname_nonnull,
      COUNT(*)::int total_condo
      FROM sold.sold_records WHERE property_type='condo'`)).rows);

    console.log("\nbusiness_name among condo rows (sometimes carries marketed name):");
    console.table((await c.query(`SELECT business_name, COUNT(*)::int n FROM sold.sold_records
      WHERE property_type='condo' AND business_name IS NOT NULL
      GROUP BY business_name ORDER BY n DESC LIMIT 8`)).rows);
  } finally { await c.end(); }
}
main().catch((e) => { console.error("fatal:", e); process.exit(1); });

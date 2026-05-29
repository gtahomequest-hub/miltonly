// WS3 Step 1 — READ-ONLY investigation of the current data model.
// NO writes. Every statement is a SELECT. Safe to run against prod DB1.
//
// Usage: npx tsx scripts/ws3-investigate.ts

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
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (process.env[k] === undefined) process.env[k] = v;
  }
}
loadEnvLocal();

const DB1 = (process.env.DATABASE_URL || "").trim();
const DB2 = (process.env.SOLD_DATABASE_URL || "").trim();
const DB3 = (process.env.ANALYTICS_DATABASE_URL || "").trim();

function hr(label: string) { console.log("\n========== " + label + " =========="); }

async function q<T = Record<string, unknown>>(c: pg.Client, sql: string, vals: unknown[] = []): Promise<T[]> {
  const r = await c.query(sql, vals);
  return r.rows as T[];
}

async function main() {
  const c1 = new pg.Client({ connectionString: DB1 });
  const c2 = new pg.Client({ connectionString: DB2 });
  const c3 = new pg.Client({ connectionString: DB3 });
  await Promise.all([c1.connect(), c2.connect(), c3.connect()]);

  try {
    // ─────────────────────────── DB1 (operational / prod) ───────────────────────
    hr("DB1 StreetContent by status");
    console.table(await q(c1, `SELECT status, COUNT(*)::int n, SUM((("isVipHub")::int))::int vip_hubs
                                FROM "StreetContent" GROUP BY status ORDER BY n DESC`));

    hr("DB1 StreetGeneration by status (the rows that render street pages)");
    console.table(await q(c1, `SELECT status, COUNT(*)::int n FROM "StreetGeneration" GROUP BY status ORDER BY n DESC`));

    hr("DB1 CondoBuilding (the existing standalone model)");
    console.table(await q(c1, `SELECT COUNT(*)::int total FROM "CondoBuilding"`));
    console.table(await q(c1, `SELECT name, slug, neighbourhood, "totalUnits", "yearBuilt" FROM "CondoBuilding" ORDER BY name LIMIT 10`));

    hr("DB1 Listing by propertyType");
    console.table(await q(c1, `SELECT "propertyType", COUNT(*)::int n FROM "Listing" GROUP BY "propertyType" ORDER BY n DESC`));

    hr("DB1 Listing distinct neighbourhood strings (top 30)");
    console.table(await q(c1, `SELECT neighbourhood, COUNT(*)::int n FROM "Listing" GROUP BY neighbourhood ORDER BY n DESC LIMIT 30`));

    hr("DB1 Listing with condoBuilding set (condo entity hint)");
    console.table(await q(c1, `SELECT COUNT(*)::int with_condo_building FROM "Listing" WHERE "condoBuilding" IS NOT NULL AND "condoBuilding" <> ''`));

    // ─────────────────────────── DB2 (sold schema) ──────────────────────────────
    hr("DB2 sold_records total + by transaction_type");
    console.table(await q(c2, `SELECT transaction_type, COUNT(*)::int n FROM sold.sold_records GROUP BY transaction_type ORDER BY n DESC`));

    hr("DB2 sold_records by property_type");
    console.table(await q(c2, `SELECT property_type, COUNT(*)::int n FROM sold.sold_records GROUP BY property_type ORDER BY n DESC`));

    hr("DB2 condo-identifier coverage among property_type='condo' rows");
    console.table(await q(c2, `
      SELECT
        COUNT(*)::int condo_rows,
        COUNT(condo_corp_number) FILTER (WHERE condo_corp_number IS NOT NULL AND condo_corp_number <> '')::int has_corp_no,
        COUNT(*) FILTER (WHERE property_management_company IS NOT NULL)::int has_mgmt_co,
        COUNT(*) FILTER (WHERE association_name IS NOT NULL)::int has_assoc_name,
        COUNT(*) FILTER (WHERE legal_stories IS NOT NULL)::int has_legal_stories,
        COUNT(*) FILTER (WHERE unit_number IS NOT NULL)::int has_unit_no,
        COUNT(DISTINCT condo_corp_number)::int distinct_corp_numbers
      FROM sold.sold_records WHERE property_type='condo'`));

    hr("DB2 candidate condo BUILDINGS — group condo rows by (street_number, street_name)");
    console.table(await q(c2, `
      SELECT COUNT(*)::int distinct_building_addresses
      FROM (
        SELECT street_number, street_name
        FROM sold.sold_records
        WHERE property_type='condo' AND street_number IS NOT NULL
        GROUP BY street_number, street_name
      ) t`));
    console.log("Top 12 condo buildings by sold-record volume (address aggregation):");
    console.table(await q(c2, `
      SELECT street_number || ' ' || street_name AS building, street_slug,
             COUNT(*)::int sold_records,
             COUNT(DISTINCT condo_corp_number)::int corp_numbers,
             MAX(condo_corp_number) AS sample_corp,
             ROUND(AVG(sold_price))::int avg_price
      FROM sold.sold_records
      WHERE property_type='condo' AND street_number IS NOT NULL
      GROUP BY street_number, street_name, street_slug
      ORDER BY sold_records DESC LIMIT 12`));

    hr("DB2 AMBIGUOUS streets — same street_slug carries BOTH condo and non-condo trades");
    console.table(await q(c2, `
      SELECT street_slug,
             COUNT(*) FILTER (WHERE property_type='condo')::int condo_n,
             COUNT(*) FILTER (WHERE property_type<>'condo')::int resi_n,
             COUNT(DISTINCT property_type)::int type_variety
      FROM sold.sold_records
      GROUP BY street_slug
      HAVING COUNT(*) FILTER (WHERE property_type='condo') > 0
         AND COUNT(*) FILTER (WHERE property_type<>'condo') > 0
      ORDER BY condo_n DESC LIMIT 15`));

    hr("DB2 distinct neighbourhood (city_region) strings (top 30)");
    console.table(await q(c2, `SELECT neighbourhood, COUNT(*)::int n FROM sold.sold_records GROUP BY neighbourhood ORDER BY n DESC LIMIT 30`));

    hr("DB2 lat/lng coverage (point-in-polygon feasibility)");
    console.table(await q(c2, `
      SELECT COUNT(*)::int total,
             COUNT(*) FILTER (WHERE lat IS NOT NULL AND lng IS NOT NULL)::int with_coords
      FROM sold.sold_records`));

    // Three sample entities for Step 2 verification preview
    hr("SAMPLE A — clear RESIDENTIAL street (detached-dominant), top by volume");
    console.table(await q(c2, `
      SELECT street_slug, property_type, COUNT(*)::int n, ROUND(AVG(sold_price))::int avg_price
      FROM sold.sold_records
      WHERE street_slug = (
        SELECT street_slug FROM sold.sold_records
        WHERE property_type='detached' AND transaction_type='For Sale'
        GROUP BY street_slug ORDER BY COUNT(*) DESC LIMIT 1)
      GROUP BY street_slug, property_type ORDER BY n DESC`));

    hr("SAMPLE B — clear CONDO building (top condo address)");
    console.table(await q(c2, `
      SELECT street_number || ' ' || street_name AS building, street_slug,
             condo_corp_number, property_management_company,
             COUNT(*)::int sold_records, ROUND(AVG(sold_price))::int avg_price,
             MIN(legal_stories) AS legal_stories
      FROM sold.sold_records
      WHERE property_type='condo' AND street_number IS NOT NULL
      GROUP BY street_number, street_name, street_slug, condo_corp_number, property_management_company
      ORDER BY sold_records DESC LIMIT 1`));

    hr("SAMPLE C — AMBIGUOUS street (mixed condo + residential on one slug)");
    console.table(await q(c2, `
      SELECT street_slug, property_type, COUNT(*)::int n
      FROM sold.sold_records
      WHERE street_slug = (
        SELECT street_slug FROM sold.sold_records
        GROUP BY street_slug
        HAVING COUNT(*) FILTER (WHERE property_type='condo') > 0
           AND COUNT(*) FILTER (WHERE property_type<>'condo') > 0
        ORDER BY COUNT(*) FILTER (WHERE property_type='condo') DESC LIMIT 1)
      GROUP BY street_slug, property_type ORDER BY n DESC`));

    // ─────────────────────────── DB3 (analytics schema) ─────────────────────────
    hr("DB3 analytics tables present");
    console.table(await q(c3, `SELECT table_name FROM information_schema.tables WHERE table_schema='analytics' ORDER BY table_name`));

    hr("DB3 street_sold_stats columns");
    console.table(await q(c3, `SELECT column_name, data_type FROM information_schema.columns
                                WHERE table_schema='analytics' AND table_name='street_sold_stats' ORDER BY ordinal_position`));

    hr("DB3 street_sold_stats row count");
    console.table(await q(c3, `SELECT COUNT(*)::int rows, COUNT(DISTINCT street_slug)::int distinct_slugs FROM analytics.street_sold_stats`));
  } finally {
    await Promise.all([c1.end(), c2.end(), c3.end()]);
  }
}

main().catch((e) => { console.error("fatal:", e); process.exit(1); });

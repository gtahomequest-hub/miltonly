// scripts/diag-analytics-probe.ts
// Direct probe of the analytics DB and sold DB to see actual production-shape
// state. Must be run with `--env-file=.env.local` so SOLD_DATABASE_URL and
// ANALYTICS_DATABASE_URL are present BEFORE src/lib/db.ts evaluates its
// module-load-time exports.
//
// Run: npx tsx --env-file=.env.local scripts/diag-analytics-probe.ts

import { getAnalyticsDb, getSoldDb } from "@/lib/db";

// Resolve once and use locals throughout — getters are cached after first call.
const analyticsDb = getAnalyticsDb();
const soldDb = getSoldDb();

interface AnalyticsRow {
  street_slug: string;
  sold_count_12months: number | null;
  avg_sold_price: string | null;
}

interface CountRow { n: string }
interface DateRangeRow { min_date: string | null; max_date: string | null; n: string }

async function main() {
  if (!analyticsDb) {
    throw new Error(
      "analyticsDb is null at script start — env vars still not present at import time. " +
      "Re-run with `npx tsx --env-file=.env.local scripts/diag-analytics-probe.ts`."
    );
  }
  if (!soldDb) {
    throw new Error(
      "soldDb is null at script start — env vars still not present at import time. " +
      "Re-run with `npx tsx --env-file=.env.local scripts/diag-analytics-probe.ts`."
    );
  }

  console.log("Both analyticsDb and soldDb non-null. Probing.\n");

  // === analytics.street_sold_stats ===
  console.log("=== analytics.street_sold_stats ===");

  const totalRows = await analyticsDb`SELECT COUNT(*)::text AS n FROM analytics.street_sold_stats` as unknown as CountRow[];
  console.log(`Total rows:                                        ${totalRows[0]?.n ?? "?"}`);

  const oneOrMore = await analyticsDb`
    SELECT COUNT(*)::text AS n FROM analytics.street_sold_stats WHERE sold_count_12months >= 1
  ` as unknown as CountRow[];
  console.log(`Rows with sold_count_12months >= 1:               ${oneOrMore[0]?.n ?? "?"}`);

  const fiveOrMore = await analyticsDb`
    SELECT COUNT(*)::text AS n FROM analytics.street_sold_stats WHERE sold_count_12months >= 5
  ` as unknown as CountRow[];
  console.log(`Rows with sold_count_12months >= 5 (full-tier):   ${fiveOrMore[0]?.n ?? "?"}`);

  const top20 = await analyticsDb`
    SELECT street_slug, sold_count_12months, avg_sold_price
    FROM analytics.street_sold_stats
    WHERE sold_count_12months IS NOT NULL
    ORDER BY sold_count_12months DESC NULLS LAST
    LIMIT 20
  ` as unknown as AnalyticsRow[];

  console.log(`\nTop 20 streets by sold_count_12months:`);
  console.log(`${"street_slug".padEnd(45)} ${"sold_12mo".padStart(9)}  ${"avg_sold_price".padStart(14)}`);
  console.log("-".repeat(72));
  for (const r of top20) {
    const price = r.avg_sold_price ? `$${parseFloat(r.avg_sold_price).toLocaleString()}` : "null";
    console.log(`${r.street_slug.padEnd(45)} ${String(r.sold_count_12months ?? "null").padStart(9)}  ${price.padStart(14)}`);
  }

  console.log(`\nSpecific named streets:`);
  const probes = [
    "etheridge-avenue-milton",
    "asleton-boulevard-milton",
    "bronte-street-milton",
    "bronte-street-south-milton",
    "trafalgar-road-milton",
    "main-st-e-milton",
    "main-street-milton",
    "main-street-east-milton",
    "derry-road-milton",
  ];
  const found = await analyticsDb`
    SELECT street_slug, sold_count_12months, avg_sold_price
    FROM analytics.street_sold_stats
    WHERE street_slug = ANY(${probes}::text[])
  ` as unknown as AnalyticsRow[];
  const foundMap = new Map(found.map(r => [r.street_slug, r]));
  for (const slug of probes) {
    const r = foundMap.get(slug);
    if (r) {
      const price = r.avg_sold_price ? `$${parseFloat(r.avg_sold_price).toLocaleString()}` : "null";
      console.log(`  ${slug.padEnd(35)} sold_12mo=${r.sold_count_12months}, avg_sold_price=${price}`);
    } else {
      console.log(`  ${slug.padEnd(35)} (not in analytics.street_sold_stats)`);
    }
  }

  // === sold.sold_records ===
  console.log(`\n=== sold.sold_records ===`);
  const soldTotal = await soldDb`SELECT COUNT(*)::text AS n FROM sold.sold_records` as unknown as CountRow[];
  console.log(`Total rows:                                        ${soldTotal[0]?.n ?? "?"}`);

  const distinctSlugs = await soldDb`
    SELECT COUNT(DISTINCT street_slug)::text AS n FROM sold.sold_records
  ` as unknown as CountRow[];
  console.log(`Distinct street_slugs:                             ${distinctSlugs[0]?.n ?? "?"}`);

  const dateRange = await soldDb`
    SELECT MIN(sold_date)::text AS min_date, MAX(sold_date)::text AS max_date, COUNT(*)::text AS n
    FROM sold.sold_records
    WHERE sold_date IS NOT NULL
  ` as unknown as DateRangeRow[];
  console.log(`sold_date range:                                   ${dateRange[0]?.min_date ?? "null"} to ${dateRange[0]?.max_date ?? "null"}`);
  console.log(`Rows with sold_date populated:                     ${dateRange[0]?.n ?? "?"}`);

  // Recency buckets
  const recent = await soldDb`
    SELECT
      COUNT(*) FILTER (WHERE sold_date >= NOW() - INTERVAL '30 days')::text  AS d30,
      COUNT(*) FILTER (WHERE sold_date >= NOW() - INTERVAL '90 days')::text  AS d90,
      COUNT(*) FILTER (WHERE sold_date >= NOW() - INTERVAL '365 days')::text AS d365,
      COUNT(*) FILTER (WHERE sold_date >= NOW() - INTERVAL '730 days')::text AS d730
    FROM sold.sold_records
  ` as unknown as Array<{ d30: string; d90: string; d365: string; d730: string }>;
  console.log(`Records sold in last 30d / 90d / 365d / 730d:      ${recent[0].d30} / ${recent[0].d90} / ${recent[0].d365} / ${recent[0].d730}`);
}

main().catch((e) => {
  console.error("Probe failed:", e);
  process.exit(2);
});

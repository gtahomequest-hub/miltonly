// scripts/geni-phase3-provenance.ts
// GENI Phase 3 merge-gate provenance check: prove the CLEAN prose grounds on the ACTUAL
// nightly table row, pulled through the REAL path (matchNeighbourhoods -> RankedMatch ->
// StableDrivers -> explainMatch), not a hand-built fixture.
import { readFileSync } from "node:fs"; import { resolve, dirname } from "node:path"; import { fileURLToPath } from "node:url";
const __d = dirname(fileURLToPath(import.meta.url));
for (const f of ["../.env", "../.env.local"]) { try { for (const line of readFileSync(resolve(__d, f), "utf8").split(/\r?\n/)) { const t = line.trim(); if (!t || t.startsWith("#")) continue; const eq = t.indexOf("="); if (eq < 0) continue; const k = t.slice(0, eq).trim(); let v = t.slice(eq + 1).trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!(k in process.env)) process.env[k] = v; } } catch {} }

async function main() {
  const { matchNeighbourhoods } = await import("@/lib/geni/matchNeighbourhoods");
  const { explainMatch, bucketMaxPrice } = await import("@/lib/geni/explainMatch");
  const { findUngroundedInDrivers } = await import("@/lib/geni/groundProse");
  const { neon } = await import("@neondatabase/serverless");
  const an = neon(process.env.ANALYTICS_DATABASE_URL!);

  // (2) CURRENT prod table row
  const rowArr = (await an`SELECT neighbourhood_slug, typical_detached, dist_go_km, sold_12mo, dom_avg
    FROM analytics.neighbourhood_match_stats WHERE neighbourhood_slug='dorset-park'` as any[]);
  const row = rowArr[0];
  console.log("═══ (2) CURRENT prod table row (analytics.neighbourhood_match_stats) ═══");
  console.log(`  ${JSON.stringify(row)}`);

  // (3) REAL path: matcher -> dorset-park RankedMatch -> StableDrivers -> explainMatch
  const parseResult = { outcome: "proceed", criteria: { maxPrice: 1100000, propertyType: "detached", nearGO: true }, declined: [], neutralized: [] } as any;
  const match = await matchNeighbourhoods(parseResult);
  const dp = match.matches.find((m: any) => m.slug === "dorset-park");
  if (!dp) { console.log("dorset-park not in match results"); process.exit(1); }

  const ref = { slug: dp.slug, name: dp.name, profile: dp.profile as any };
  const drivers = { typical: dp.typical, distGoKm: dp.distGoKm, sold12mo: dp.sold12mo, domAvg: dp.domAvg, tags: dp.tags };
  const bucket = { propertyType: "detached" as const, priceBand: "up to $1.1M", maxPriceBucket: bucketMaxPrice(1100000), nearGO: true, activity: null, transaction: "sale" as const };

  console.log("\n═══ (3) REAL drivers pulled via matchNeighbourhoods (RankedMatch → StableDrivers) ═══");
  console.log(`  ${JSON.stringify(drivers)}`);
  console.log(`  provenance: NOT a fixture — typical/distGoKm/sold12mo/domAvg came straight off the RankedMatch, which reads the table.`);

  const noCache = async <T,>(_k: string, _t: number, fn: () => Promise<T>): Promise<T> => fn();
  const r = await explainMatch(ref, bucket, drivers, { cache: noCache });
  console.log("\n═══ prose (real DeepSeek generation) ═══");
  console.log(`  ${r.prose === null ? "null (fail-closed)" : `"${r.prose}"`}`);

  if (r.prose) {
    const pool = {
      prices: dp.profile === "urban_hub" && drivers.typical != null ? [drivers.typical] : [],
      volumes: drivers.sold12mo != null ? [drivers.sold12mo] : [],
      doms: drivers.domAvg != null ? [drivers.domAvg] : [],
      kms: drivers.distGoKm != null ? [drivers.distGoKm] : [],
    };
    const ung = findUngroundedInDrivers(r.prose, pool);
    console.log("\n═══ number-by-number map (prose → table row) ═══");
    console.log(`  table row:  typical_detached=${row.typical_detached}  dist_go_km=${row.dist_go_km}  sold_12mo=${row.sold_12mo}  dom_avg=${row.dom_avg}`);
    console.log(`  drivers:    typical=${drivers.typical}  distGoKm=${drivers.distGoKm}  sold12mo=${drivers.sold12mo}  domAvg=${drivers.domAvg}`);
    console.log(`  driver==row: typical=${Number(drivers.typical) === Number(row.typical_detached)}  GO=${Number(drivers.distGoKm) === Number(row.dist_go_km)}  sold=${Number(drivers.sold12mo) === Number(row.sold_12mo)}  DOM=${Number(drivers.domAvg) === Number(row.dom_avg)}`);
    console.log(`  grounding hits on real prose: ${ung.length} (0 = every number in prose maps to the row)`);
    if (ung.length) ung.forEach((h: any) => console.log(`     UNGROUNDED: "${h.raw}" — ${h.reason}`));
  }
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });

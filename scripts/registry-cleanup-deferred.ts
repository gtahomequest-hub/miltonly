// scripts/registry-cleanup-deferred.ts
// The MERGE-time half of Step-4-proper: the 22 PUBLISHED bad slugs whose 301s are
// now live in next.config. For each source->target: reassign DB2 sold, transfer any
// VIP/neighbourhoodId the target lacks, delete StreetContent + entity, clean DB3.
// The 301 (next.config) already routes source->target, so this is cleanup — no 404.
// Dry-run by default; --commit writes.
import { readFileSync } from "node:fs"; import { resolve, dirname } from "node:path"; import { fileURLToPath } from "node:url";
const __d = dirname(fileURLToPath(import.meta.url));
for (const f of ["../.env", "../.env.local"]) { try { for (const line of readFileSync(resolve(__d, f), "utf8").split(/\r?\n/)) { const t = line.trim(); if (!t || t.startsWith("#")) continue; const eq = t.indexOf("="); if (eq < 0) continue; const k = t.slice(0, eq).trim(); let v = t.slice(eq + 1).trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!(k in process.env)) process.env[k] = v; } } catch {} }
const COMMIT = process.argv.includes("--commit");
const M = "-milton";
const PAIRS: Array<[string, string]> = [
  ["miltonbrock-crescent","miltonbrook-crescent"],["1-line","first-line"],["mcdougall-cross","mcdougall-crossing"],
  ["pineview-trail","pine-view-trail"],["watercres-way","watercress-way"],["weller-cross","weller-crossing"],
  ["symons-cross","symons-crossing"],["fourth-line-nassagaweya-n-a","fourth-line-nassagaweya"],["hwy-7-n-a","highway-7"],
  ["sixth-line-nassagaweya-n-a","sixth-line-nassagaweya"],["campbellville-avenue","campbellville-road"],
  ["lloyd-landing-n-a","lloyd-landing"],["wetenhall-landing-n-a","wetenhall-landing"],["wise-crossing-n-a","wise-crossing"],
  ["marigold-crescent","marigold-court"],["nippising-road","nipissing-road"],["4th-line-nassagaweya-line","fourth-line-nassagaweya"],
  ["french-gardens","french-garden"],["first-line-nassagaweya-n-a","first-line-nassagaweya"],["restivo-line","restivo-lane"],
  ["nassagaweya-puslinch-n-a","nassagaweya-puslinch-townline"],["rigo-crossing-crescent","rigo-crossing"],
].map(([a, b]) => [a + M, b + M]);
async function main() {
  const { PrismaClient } = await import("@prisma/client"); const { neon } = await import("@neondatabase/serverless");
  const p = new PrismaClient(); const sold = neon(process.env.SOLD_DATABASE_URL!); const an = neon(process.env.ANALYTICS_DATABASE_URL!);
  const srcSlugs = PAIRS.map(([s]) => s);
  const srcRows = await p.residentialStreet.findMany({ where: { slug: { in: srcSlugs } }, select: { slug: true, isVip: true, neighbourhoodId: true } });
  const srcBy = new Map(srcRows.map((r) => [r.slug, r]));
  const tgtRows = await p.residentialStreet.findMany({ where: { slug: { in: PAIRS.map(([, t]) => t) } }, select: { slug: true, isVip: true, neighbourhoodId: true } });
  const tgtBy = new Map(tgtRows.map((r) => [r.slug, r]));
  const soldAgg = await sold`SELECT street_slug, COUNT(*)::int c FROM sold.sold_records WHERE street_slug = ANY(${srcSlugs}) GROUP BY street_slug` as any[];
  const soldBy = new Map(soldAgg.map((s: any) => [s.street_slug, s.c]));
  console.log(`=== deferred cleanup ${COMMIT ? "(COMMIT)" : "(DRY)"} — ${PAIRS.length} published bad slugs ===`);
  let moved = 0, vc = 0, nc = 0, delEnt = 0, delContent = 0;
  for (const [src, tgt] of PAIRS) {
    const s = srcBy.get(src); const t = tgtBy.get(tgt); const db2 = soldBy.get(src) ?? 0;
    const xferVip = !!s?.isVip && !t?.isVip; const xferNb = !!s?.neighbourhoodId && !t?.neighbourhoodId;
    console.log(`  ${src.padEnd(38)} -> ${tgt.padEnd(34)} sold=${db2}${xferVip ? " +VIP" : ""}${xferNb ? " +nbId" : ""}${s ? "" : " (no entity)"}`);
    if (COMMIT) {
      if (db2 > 0) { await sold`UPDATE sold.sold_records SET street_slug=${tgt} WHERE street_slug=${src}`; moved += db2; }
      if (s && (xferVip || xferNb)) { const data: any = {}; if (xferVip) { data.isVip = true; data.vipEarnedAt = new Date(); vc++; } if (xferNb) { data.neighbourhoodId = s.neighbourhoodId; nc++; } await p.residentialStreet.update({ where: { slug: tgt }, data }); if (t) { t.isVip = t.isVip || data.isVip; t.neighbourhoodId = t.neighbourhoodId || data.neighbourhoodId; } }
      const dc = await p.streetContent.deleteMany({ where: { streetSlug: src } }); delContent += dc.count;
      const de = await p.residentialStreet.deleteMany({ where: { slug: src } }); delEnt += de.count;
      try { await an`DELETE FROM analytics.street_sold_stats WHERE street_slug=${src}`; await an`DELETE FROM analytics.street_monthly_stats WHERE street_slug=${src}`; } catch {}
    }
  }
  if (COMMIT) { const total = await p.residentialStreet.count(); console.log(`\n[commit] sold moved ~${moved}, VIP xfer ${vc}, nbId xfer ${nc}, StreetContent deleted ${delContent}, entities deleted ${delEnt}. entities now: ${total}`); }
  else console.log("\n(dry run)");
  await p.$disconnect(); process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });

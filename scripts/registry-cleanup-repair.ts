// scripts/registry-cleanup-repair.ts
// Repairs Step-4-proper: several merge TARGETS (official registry slugs, or kept
// off-registry roads) received reassigned sold_records but had NO ResidentialStreet
// entity (they were "covered" by a now-deleted bare row). Create the missing entity
// from the reassigned sold_records so the street is surfaced with correct stats.
// Dry-run by default; --commit writes.
import { readFileSync } from "node:fs"; import { resolve, dirname } from "node:path"; import { fileURLToPath } from "node:url";
const __d = dirname(fileURLToPath(import.meta.url));
for (const f of ["../.env", "../.env.local"]) { try { for (const line of readFileSync(resolve(__d, f), "utf8").split(/\r?\n/)) { const t = line.trim(); if (!t || t.startsWith("#")) continue; const eq = t.indexOf("="); if (eq < 0) continue; const k = t.slice(0, eq).trim(); let v = t.slice(eq + 1).trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!(k in process.env)) process.env[k] = v; } } catch {} }
const COMMIT = process.argv.includes("--commit");
const titleCase = (s: string) => s.toLowerCase().split(/\s+/).map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w)).join(" ");
async function main() {
  const { PrismaClient } = await import("@prisma/client"); const { neon } = await import("@neondatabase/serverless");
  const { MILTON_STREET_REGISTRY: REG } = await import("../src/data/miltonStreetRegistry");
  const { OFF_REGISTRY_SET } = await import("../src/data/offRegistryStreets");
  const regBySlug = new Map(REG.map((r) => [r.slug, r]));
  const p = new PrismaClient(); const soldDb = neon(process.env.SOLD_DATABASE_URL!);
  // recency-weighted (matches ws3-backfill WEIGHT) + 12mo count + dominant neighbourhood, per slug
  const agg = await soldDb`
    SELECT street_slug slug, MAX(street_name) name,
      COUNT(*) FILTER (WHERE transaction_type='For Sale' AND sold_date>=NOW()-INTERVAL '12 months')::int count12,
      COALESCE(SUM(CASE WHEN transaction_type='For Sale' THEN CASE
        WHEN sold_date>=NOW()-INTERVAL '12 months' THEN 1.0
        WHEN sold_date>=NOW()-INTERVAL '24 months' THEN 0.6
        WHEN sold_date>=NOW()-INTERVAL '36 months' THEN 0.3 ELSE 0.1 END ELSE 0 END),0)::float weighted
    FROM sold.sold_records WHERE street_slug IS NOT NULL GROUP BY street_slug` as any[];
  const nbAgg = await soldDb`SELECT street_slug slug, neighbourhood, COUNT(*)::int c FROM sold.sold_records WHERE neighbourhood IS NOT NULL GROUP BY street_slug, neighbourhood` as any[];
  const domNbBySlug = new Map<string, string>(); { const m = new Map<string, Map<string, number>>(); for (const r of nbAgg) { if (!m.has(r.slug)) m.set(r.slug, new Map()); m.get(r.slug)!.set(r.neighbourhood, r.c); } for (const [slug, mm] of m) { let best = "", bc = 0; for (const [k, v] of mm) if (v > bc) { bc = v; best = k; } domNbBySlug.set(slug, best); } }
  const nbs = await p.neighbourhood.findMany({ select: { id: true, rawStrings: true } });
  const nbByRaw = new Map<string, string>(); for (const nb of nbs) for (const rs of nb.rawStrings) nbByRaw.set(rs, nb.id);

  const existing = new Set((await p.residentialStreet.findMany({ select: { slug: true } })).map((r) => r.slug));
  const missing = agg.filter((a) => !existing.has(a.slug) && (regBySlug.has(a.slug) || OFF_REGISTRY_SET.has(a.slug)));
  console.log(`=== repair ${COMMIT ? "(COMMIT)" : "(DRY)"} — registry/off-registry slugs with sold but NO entity: ${missing.length} ===`);
  for (const a of missing.sort((x, y) => y.weighted - x.weighted)) {
    const reg = regBySlug.get(a.slug); const nm = reg ? titleCase(reg.name) : titleCase(a.name || a.slug);
    const raw = domNbBySlug.get(a.slug); const nbId = raw ? nbByRaw.get(raw) ?? null : null;
    console.log(`  ${a.slug.padEnd(34)} count12=${a.count12} wt=${a.weighted.toFixed(2)} nb=${raw ?? "?"} -> ${nbId ? "nbId" : "NULL"}  name="${nm}"`);
    if (COMMIT) {
      await p.residentialStreet.create({ data: { slug: a.slug, name: nm, streetType: reg?.type ?? null, neighbourhoodId: nbId, soldCount12mo: a.count12, recencyWeightedSold: Number(a.weighted.toFixed(4)), isVip: false, hasPublishedPage: false, crossStreets: [], lastClassifiedAt: new Date() } });
    }
  }
  if (COMMIT) { const total = await p.residentialStreet.count(); console.log(`\n[commit] entities now: ${total}`); }
  else console.log("\n(dry run)");
  await p.$disconnect(); process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });

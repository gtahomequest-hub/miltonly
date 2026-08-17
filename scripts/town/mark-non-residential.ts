// scripts/town/mark-non-residential.ts
// Mark the industrial road stubs isResidential=false so activity can never auto-promote them.
//
//   npx tsx --tsconfig tsconfig.test.json scripts/town/mark-non-residential.ts          (dry run)
//   npx tsx --tsconfig tsconfig.test.json scripts/town/mark-non-residential.ts --apply
//
// The surfacing rule promotes an entity as soon as it acquires a sale or a listing. That is right
// for a residential street with no history yet and wrong for wheelabrator-way: one industrial unit
// trading should not put "Wheelabrator Way" into hero autocomplete beside Laurier Avenue.
//
// THE POPULATION IS DERIVED FROM THE POLYGON, NOT A FROZEN LIST OF SLUGS. A hard-coded roll-call
// cannot grow — a twenty-third industrial stub added to the registry next year would silently stay
// residential. The rule is: the street's centreline centroid falls inside a Town polygon that
// src/data/townNeighbourhoodMap.ts maps to null FOR INDUSTRIAL REASONS, and the street has no
// sale, no listing and no published page.
//
// The last clause matters and is not decoration. It is the safety catch: if any of these ever
// turns out to have real residential activity, this script declines to mark it and says so,
// rather than burying a street because of where a polygon boundary happens to fall.
import { readFileSync } from "node:fs"; import { resolve, dirname } from "node:path"; import { fileURLToPath } from "node:url";
const __d = dirname(fileURLToPath(import.meta.url));
for (const f of ["../../.env", "../../.env.local"]) { try { for (const line of readFileSync(resolve(__d, f), "utf8").split(/\r?\n/)) { const t = line.trim(); if (!t || t.startsWith("#")) continue; const eq = t.indexOf("="); if (eq < 0) continue; const k = t.slice(0, eq).trim(); let v = t.slice(eq + 1).trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!(k in process.env)) process.env[k] = v; } } catch {} }

/** Polygons whose null mapping is an INDUSTRIAL judgement, not an ambiguity one.
 *  Nassagaweya is also null-mapped, but because it spans five of our neighbourhoods — its
 *  streets are residential and must NOT be marked. */
const INDUSTRIAL_POLYGONS = new Set(["401 Industrial Area"]);

const APPLY = process.argv.includes("--apply");
const pad = (s: unknown, n: number) => String(s).padEnd(n);
const lp = (s: unknown, n: number) => String(s).padStart(n);

async function main() {
  const { prisma } = await import("@/lib/prisma");
  const { getSoldDb } = await import("@/lib/db");
  const { TOWN_NEIGHBOURHOODS } = await import("@/data/townNeighbourhoods");
  const { TOWN_POLYGON_TO_NEIGHBOURHOOD } = await import("@/data/townNeighbourhoodMap");
  const { TOWN_ROAD_FACTS } = await import("@/data/townRoadFacts");
  const { identityFromSlug } = await import("@/lib/town/identity");
  const { polygonAt } = await import("@/lib/town/polygons");
  const sold = getSoldDb()!;
  const L = (s = "") => console.log(s);

  for (const p of INDUSTRIAL_POLYGONS) {
    if (!TOWN_NEIGHBOURHOODS.some((x) => x.name === p)) throw new Error(`"${p}" is not a polygon in the Town layer`);
    if (TOWN_POLYGON_TO_NEIGHBOURHOOD[p] !== null) throw new Error(`"${p}" is mapped to a neighbourhood — it must be null-mapped to be treated as industrial`);
  }

  const streets = await prisma.residentialStreet.findMany({
    select: { id: true, slug: true, isResidential: true, recencyWeightedSold: true, soldCount12mo: true, hasPublishedPage: true },
  });
  const publishedSlugs = new Set(
    (await prisma.streetContent.findMany({ where: { status: "published" }, select: { streetSlug: true } })).map((r) => r.streetSlug),
  );
  const db2 = new Map(((await sold`SELECT street_slug s, COUNT(*)::int n FROM sold.sold_records WHERE perm_advertise=TRUE AND sold_date <= NOW() GROUP BY 1`) as Array<{ s: string; n: number }>).map((r) => [r.s, r.n]));
  const listings = new Map((await prisma.listing.groupBy({ by: ["streetSlug"], _count: { _all: true }, where: { permAdvertise: true } })).map((l) => [l.streetSlug, l._count._all]));

  const mark: Array<{ id: string; slug: string; poly: string }> = [];
  const declined: Array<{ slug: string; why: string }> = [];

  for (const s of streets) {
    const f = (TOWN_ROAD_FACTS as Record<string, { lat: number; lng: number } | undefined>)[identityFromSlug(s.slug).key];
    if (!f) continue;
    const p = polygonAt([f.lng, f.lat], TOWN_NEIGHBOURHOODS);
    if (!p || !INDUSTRIAL_POLYGONS.has(p.name)) continue;

    const reasons: string[] = [];
    if ((db2.get(s.slug) ?? 0) > 0) reasons.push(`${db2.get(s.slug)} sold record(s)`);
    if ((listings.get(s.slug) ?? 0) > 0) reasons.push(`${listings.get(s.slug)} listing(s)`);
    if (publishedSlugs.has(s.slug)) reasons.push("published page");
    if (s.recencyWeightedSold > 0) reasons.push(`rws=${s.recencyWeightedSold}`);

    if (reasons.length) declined.push({ slug: s.slug, why: reasons.join(", ") });
    else mark.push({ id: s.id, slug: s.slug, poly: p.name });
  }

  L("═".repeat(96));
  L(`MARK NON-RESIDENTIAL   ${APPLY ? "[APPLY]" : "[DRY RUN]"}`);
  L("═".repeat(96));
  L(`    industrial polygons ....................... ${[...INDUSTRIAL_POLYGONS].join(", ")}`);
  L(`    ResidentialStreet rows scanned ............ ${streets.length}`);
  L(`    already isResidential=false ............... ${streets.filter((s) => !s.isResidential).length}`);
  L(`    => TO MARK ................................ ${mark.length}`);
  L();
  for (const m of mark.sort((a, b) => a.slug.localeCompare(b.slug))) L(`      ${pad(m.slug, 34)} [${m.poly}]`);
  L();
  L(`    DECLINED — inside the polygon but carrying real activity, left residential: ${declined.length}`);
  for (const d of declined) L(`      ${pad(d.slug, 34)} ${d.why}`);
  if (!declined.length) L(`      (none)`);

  if (APPLY && mark.length) {
    const r = await prisma.residentialStreet.updateMany({ where: { id: { in: mark.map((m) => m.id) } }, data: { isResidential: false } });
    L();
    L(`    MARKED ${r.count} street(s) isResidential=false.`);
  } else if (mark.length) {
    L();
    L(`    DRY RUN — nothing written. Re-run with --apply.`);
  }

  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });

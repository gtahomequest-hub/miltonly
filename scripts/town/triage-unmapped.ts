// scripts/town/triage-unmapped.ts — READ-ONLY. Step (e).
//
// The streets that land only inside a deliberately unmapped Town polygon. They are NOT assigned
// and this script does not assign them; it reports what they are so the decision about them is
// made on evidence rather than on the fact that a number exists.
import { readFileSync } from "node:fs"; import { resolve, dirname } from "node:path"; import { fileURLToPath } from "node:url";
const __d = dirname(fileURLToPath(import.meta.url));
for (const f of ["../../.env", "../../.env.local"]) { try { for (const line of readFileSync(resolve(__d, f), "utf8").split(/\r?\n/)) { const t = line.trim(); if (!t || t.startsWith("#")) continue; const eq = t.indexOf("="); if (eq < 0) continue; const k = t.slice(0, eq).trim(); let v = t.slice(eq + 1).trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!(k in process.env)) process.env[k] = v; } } catch {} }

const pad = (s: unknown, n: number) => String(s).padEnd(n);
const lp = (s: unknown, n: number) => String(s).padStart(n);

async function main() {
  const { prisma } = await import("@/lib/prisma");
  const { getSoldDb } = await import("@/lib/db");
  const { TOWN_NEIGHBOURHOODS } = await import("@/data/townNeighbourhoods");
  const { TOWN_POLYGON_TO_NEIGHBOURHOOD } = await import("@/data/townNeighbourhoodMap");
  const { TOWN_ROAD_FACTS } = await import("@/data/townRoadFacts");
  const { MILTON_STREET_REGISTRY } = await import("@/data/miltonStreetRegistry");
  const { identityFromSlug } = await import("@/lib/town/identity");
  const { polygonAt } = await import("@/lib/town/polygons");
  const sold = getSoldDb()!;
  const L = (s = "") => console.log(s);

  const inRegistry = new Set((MILTON_STREET_REGISTRY as Array<{ slug: string }>).map((r) => r.slug));
  const streets = await prisma.residentialStreet.findMany({
    where: { neighbourhoodId: null },
    select: { slug: true, recencyWeightedSold: true, soldCount12mo: true },
  });
  // Publication is derived from StreetContent — the hasPublishedPage column was dropped.
  const publishedSlugs = new Set(
    (await prisma.streetContent.findMany({ where: { status: "published" }, select: { streetSlug: true } })).map((r) => r.streetSlug),
  );
  const listings = await prisma.listing.groupBy({ by: ["streetSlug"], _count: { _all: true }, where: { permAdvertise: true } });
  const listingBySlug = new Map(listings.map((l) => [l.streetSlug, l._count._all]));
  const db2 = new Map(((await sold`SELECT street_slug s, COUNT(*)::int n FROM sold.sold_records WHERE perm_advertise=TRUE AND sold_date <= NOW() GROUP BY 1`) as Array<{ s: string; n: number }>).map((r) => [r.s, r.n]));

  const groups = new Map<string, Array<{ slug: string; reg: boolean; db2: number; listings: number; surfaced: boolean }>>();
  for (const s of streets) {
    const f = (TOWN_ROAD_FACTS as Record<string, { lat: number; lng: number } | undefined>)[identityFromSlug(s.slug).key];
    if (!f) continue;
    const p = polygonAt([f.lng, f.lat], TOWN_NEIGHBOURHOODS);
    if (!p || TOWN_POLYGON_TO_NEIGHBOURHOOD[p.name] !== null) continue;
    if (!groups.has(p.name)) groups.set(p.name, []);
    groups.get(p.name)!.push({
      slug: s.slug, reg: inRegistry.has(s.slug), db2: db2.get(s.slug) ?? 0,
      listings: listingBySlug.get(s.slug) ?? 0, surfaced: s.recencyWeightedSold > 0 || publishedSlugs.has(s.slug),
    });
  }

  L("═".repeat(100));
  L("(e) TRIAGE — streets inside a deliberately unmapped polygon. NOT ASSIGNED.");
  L("═".repeat(100));
  let total = 0;
  for (const [poly, rows] of [...groups.entries()].sort((a, b) => b[1].length - a[1].length)) {
    total += rows.length;
    L();
    L(`── ${poly}  (${rows.length} streets)`);
    L(`   ${pad("slug", 36)} ${lp("in Town registry", 17)} ${lp("DB2 rows", 9)} ${lp("listings", 9)} ${lp("surfaced", 9)}`);
    for (const r of rows.sort((a, b) => a.slug.localeCompare(b.slug))) {
      L(`   ${pad(r.slug, 36)} ${lp(r.reg ? "yes" : "NO", 17)} ${lp(r.db2, 9)} ${lp(r.listings, 9)} ${lp(r.surfaced ? "yes" : "no", 9)}`);
    }
    L(`   -> in registry: ${rows.filter((r) => r.reg).length}/${rows.length} · any DB2 record: ${rows.filter((r) => r.db2 > 0).length} · any listing: ${rows.filter((r) => r.listings > 0).length} · surfaced: ${rows.filter((r) => r.surfaced).length}`);
  }
  L();
  L(`   TOTAL: ${total}`);
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });

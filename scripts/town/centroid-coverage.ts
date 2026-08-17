// scripts/town/centroid-coverage.ts — READ-ONLY.
// Which streets currently throw NoCentroidError, and which of them the street-level Town
// centreline step clears. Derived by predicate, not read off the error log.
import { readFileSync } from "node:fs"; import { resolve, dirname } from "node:path"; import { fileURLToPath } from "node:url";
const __d = dirname(fileURLToPath(import.meta.url));
for (const f of ["../../.env", "../../.env.local"]) { try { for (const line of readFileSync(resolve(__d, f), "utf8").split(/\r?\n/)) { const t = line.trim(); if (!t || t.startsWith("#")) continue; const eq = t.indexOf("="); if (eq < 0) continue; const k = t.slice(0, eq).trim(); let v = t.slice(eq + 1).trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!(k in process.env)) process.env[k] = v; } } catch {} }
const pad = (s: unknown, n: number) => String(s).padEnd(n);

async function main() {
  const { prisma } = await import("@/lib/prisma");
  const { getSoldDb } = await import("@/lib/db");
  const { NEIGHBOURHOOD_CENTROIDS } = await import("@/lib/geo");
  const { TOWN_ROAD_FACTS } = await import("@/data/townRoadFacts");
  const { identityFromSlug } = await import("@/lib/town/identity");
  const sold = getSoldDb()!;
  const L = (s = "") => console.log(s);

  // The population: every street with a queue row carrying a NoCentroidError, PLUS every street
  // whose dominant raw neighbourhood has no centroid entry — so a street that has not been tried
  // yet is counted too.
  const q = await prisma.streetQueue.findMany({
    where: { lastError: { contains: "NoCentroidError" } },
    select: { streetSlug: true, status: true, lastError: true },
  });

  const rawBySlug = new Map<string, string>();
  for (const r of (await sold`SELECT street_slug s, neighbourhood nb, COUNT(*)::int n
                              FROM sold.sold_records WHERE perm_advertise = TRUE AND neighbourhood IS NOT NULL
                              GROUP BY 1,2 ORDER BY 3 DESC`) as Array<{ s: string; nb: string; n: number }>) {
    if (!rawBySlug.has(r.s)) rawBySlug.set(r.s, r.nb);
  }
  for (const l of await prisma.listing.groupBy({ by: ["streetSlug", "neighbourhood"], _count: { _all: true }, where: { permAdvertise: true } })) {
    if (l.neighbourhood && !rawBySlug.has(l.streetSlug)) rawBySlug.set(l.streetSlug, l.neighbourhood);
  }

  const hasTown = (slug: string) => Boolean((TOWN_ROAD_FACTS as Record<string, unknown>)[identityFromSlug(slug).key]);
  const hasNbhd = (slug: string) => {
    const raw = rawBySlug.get(slug);
    return Boolean(raw && NEIGHBOURHOOD_CENTROIDS[raw]);
  };

  L("═".repeat(96));
  L("CENTROID COVERAGE — who was throwing, and what the street-level step clears");
  L("═".repeat(96));
  L(`    queue rows carrying NoCentroidError ......... ${q.length}`);
  L();
  L(`    ${pad("slug", 38)} ${pad("queue", 12)} ${pad("Town centreline?", 18)} ${pad("nbhd centroid?", 16)} verdict`);
  let cleared = 0, still = 0;
  for (const r of q.sort((a, b) => a.streetSlug.localeCompare(b.streetSlug))) {
    const t = hasTown(r.streetSlug), n = hasNbhd(r.streetSlug);
    const verdict = t ? "CLEARED by street centreline" : n ? "cleared by neighbourhood" : "STILL THROWS";
    if (t || n) cleared++; else still++;
    L(`    ${pad(r.streetSlug, 38)} ${pad(r.status, 12)} ${pad(t ? "yes" : "no", 18)} ${pad(n ? "yes" : "no", 16)} ${verdict}`);
  }
  L();
  L(`    => cleared: ${cleared}   still throwing: ${still}`);

  // corpus-wide: how many streets could not resolve a centroid at all
  const all = await prisma.residentialStreet.findMany({ select: { slug: true } });
  const noneAtAll = all.filter((s) => !hasTown(s.slug) && !hasNbhd(s.slug));
  L();
  L(`    corpus-wide, streets with NEITHER a Town centreline NOR a neighbourhood centroid: ${noneAtAll.length} of ${all.length}`);
  L(`    (these are unaffected by this change and keep throwing — absence is never evidence)`);
  for (const s of noneAtAll.slice(0, 15)) L(`      ${s.slug}`);
  if (noneAtAll.length > 15) L(`      ...(${noneAtAll.length - 15} more)`);

  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });

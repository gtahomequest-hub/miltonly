// READ-ONLY. Names the streets inside the low-n polygons so the hand calls in
// src/data/townNeighbourhoodMap.ts are evidenced rather than guessed.
import { readFileSync } from "node:fs"; import { resolve, dirname } from "node:path"; import { fileURLToPath } from "node:url";
const __d = dirname(fileURLToPath(import.meta.url));
for (const f of ["../../.env", "../../.env.local"]) { try { for (const line of readFileSync(resolve(__d, f), "utf8").split(/\r?\n/)) { const t = line.trim(); if (!t || t.startsWith("#")) continue; const eq = t.indexOf("="); if (eq < 0) continue; const k = t.slice(0, eq).trim(); let v = t.slice(eq + 1).trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!(k in process.env)) process.env[k] = v; } } catch {} }

const THIN = ["Esquesing", "Milton Heights", "Valley View", "Forest Grove", "401 Industrial Area", "Derry Green Industrial", "Nelson", "Trafalgar", "Bronte Meadows", "Nassagaweya"];

async function main() {
  const { prisma } = await import("@/lib/prisma");
  const { TOWN_NEIGHBOURHOODS } = await import("@/data/townNeighbourhoods");
  const { TOWN_ROAD_FACTS } = await import("@/data/townRoadFacts");
  const { identityFromSlug } = await import("@/lib/town/identity");
  const { polygonAt } = await import("@/lib/town/polygons");
  const L = (s = "") => console.log(s);

  const nbhds = await prisma.neighbourhood.findMany();
  const byId = new Map(nbhds.map((n) => [n.id, n]));
  // Publication derives from StreetContent — the hasPublishedPage column was dropped.
  const published = new Set(
    (await prisma.streetContent.findMany({ where: { status: "published" }, select: { streetSlug: true } })).map((r) => r.streetSlug),
  );
  const streets = await prisma.residentialStreet.findMany({
    select: { slug: true, neighbourhoodId: true, recencyWeightedSold: true },
  });

  for (const name of THIN) {
    const poly = TOWN_NEIGHBOURHOODS.find((p) => p.name === name);
    if (!poly) { L(`\n── ${name}: NO SUCH POLYGON`); continue; }
    L(`\n── ${name}`);
    const known: string[] = [], orphan: string[] = [];
    for (const s of streets) {
      const f = (TOWN_ROAD_FACTS as Record<string, { lat: number; lng: number } | undefined>)[identityFromSlug(s.slug).key];
      if (!f) continue;
      if (polygonAt([f.lng, f.lat], TOWN_NEIGHBOURHOODS)?.name !== name) continue;
      const surfaced = s.recencyWeightedSold > 0 || published.has(s.slug);
      if (s.neighbourhoodId) known.push(`${s.slug} -> ${byId.get(s.neighbourhoodId)!.slug}`);
      else orphan.push(`${s.slug}${surfaced ? " [SURFACED]" : ""}`);
    }
    L(`   known-TREB inside (${known.length}):`);
    for (const k of known.slice(0, 14)) L(`     ${k}`);
    if (known.length > 14) L(`     ...(${known.length - 14} more)`);
    L(`   orphans inside (${orphan.length}):`);
    for (const o of orphan.slice(0, 24)) L(`     ${o}`);
    if (orphan.length > 24) L(`     ...(${orphan.length - 24} more)`);
  }
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });

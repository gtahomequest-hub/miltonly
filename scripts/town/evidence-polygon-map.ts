// scripts/town/evidence-polygon-map.ts — READ-ONLY.
// The evidence behind src/data/townNeighbourhoodMap.ts. For every Town polygon, which of OUR
// neighbourhoods do the streets inside it actually belong to, according to TREB? A mapping
// hand-written from intuition is a guess; one written from this table is a reading of the record.
import { readFileSync } from "node:fs"; import { resolve, dirname } from "node:path"; import { fileURLToPath } from "node:url";
const __d = dirname(fileURLToPath(import.meta.url));
for (const f of ["../../.env", "../../.env.local"]) { try { for (const line of readFileSync(resolve(__d, f), "utf8").split(/\r?\n/)) { const t = line.trim(); if (!t || t.startsWith("#")) continue; const eq = t.indexOf("="); if (eq < 0) continue; const k = t.slice(0, eq).trim(); let v = t.slice(eq + 1).trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!(k in process.env)) process.env[k] = v; } } catch {} }

const pad = (s: unknown, n: number) => String(s).padEnd(n);
const lp = (s: unknown, n: number) => String(s).padStart(n);

async function main() {
  const { prisma } = await import("@/lib/prisma");
  const { TOWN_NEIGHBOURHOODS } = await import("@/data/townNeighbourhoods");
  const { TOWN_ROAD_FACTS } = await import("@/data/townRoadFacts");
  const { identityFromSlug } = await import("@/lib/town/identity");
  const { polygonAt } = await import("@/lib/town/polygons");
  const L = (s = "") => console.log(s);

  const nbhds = await prisma.neighbourhood.findMany();
  const byId = new Map(nbhds.map((n) => [n.id, n]));
  const streets = await prisma.residentialStreet.findMany({
    select: { slug: true, neighbourhoodId: true, recencyWeightedSold: true },
  });

  // polygon -> our-neighbourhood tally, over streets whose TREB neighbourhood we already know
  const tally = new Map<string, Map<string, number>>();
  for (const p of TOWN_NEIGHBOURHOODS) tally.set(p.name, new Map());
  let placed = 0;
  for (const s of streets) {
    if (!s.neighbourhoodId) continue;
    const f = (TOWN_ROAD_FACTS as Record<string, { lat: number; lng: number } | undefined>)[identityFromSlug(s.slug).key];
    if (!f) continue;
    const p = polygonAt([f.lng, f.lat], TOWN_NEIGHBOURHOODS);
    if (!p) continue;
    const ours = byId.get(s.neighbourhoodId)!.slug;
    const m = tally.get(p.name)!;
    m.set(ours, (m.get(ours) ?? 0) + 1);
    placed++;
  }

  L("═".repeat(100));
  L("EVIDENCE FOR THE TOWN-POLYGON -> OUR-NEIGHBOURHOOD MAP");
  L("═".repeat(100));
  L(`    Town polygons ....................... ${TOWN_NEIGHBOURHOODS.length}`);
  L(`    known-TREB streets placed in one .... ${placed}`);
  L();
  for (const p of [...TOWN_NEIGHBOURHOODS].sort((a, b) => a.name.localeCompare(b.name))) {
    const m = tally.get(p.name)!;
    const ranked = [...m.entries()].sort((a, b) => b[1] - a[1]);
    const tot = ranked.reduce((a, x) => a + x[1], 0);
    const top = ranked[0];
    L(`  ${pad(p.name, 26)} n=${lp(tot, 4)}  ${top ? `top=${pad(top[0], 20)} ${lp(Math.round((top[1] / tot) * 100) + "%", 5)}` : pad("(no known street inside)", 32)}`);
    if (ranked.length > 1) L(`  ${" ".repeat(26)}       all: ${ranked.map(([k, v]) => `${k}:${v}`).join("  ")}`);
  }

  // dormant streets that land in each polygon — the size of what the map would unlock
  L();
  L("    DORMANT/ORPHAN STREETS PER POLYGON (what the map would assign):");
  const orphanTally = new Map<string, number>();
  for (const s of streets) {
    if (s.neighbourhoodId) continue;
    const f = (TOWN_ROAD_FACTS as Record<string, { lat: number; lng: number } | undefined>)[identityFromSlug(s.slug).key];
    if (!f) continue;
    const p = polygonAt([f.lng, f.lat], TOWN_NEIGHBOURHOODS);
    if (!p) continue;
    orphanTally.set(p.name, (orphanTally.get(p.name) ?? 0) + 1);
  }
  for (const [k, v] of [...orphanTally.entries()].sort((a, b) => b[1] - a[1])) L(`      ${pad(k, 26)} ${lp(v, 4)}`);

  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });

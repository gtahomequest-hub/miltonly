// scripts/town/derive-rural-centroids.ts — READ-ONLY. Prints the entries; does not edit geo.ts.
//
// NEIGHBOURHOOD_CENTROIDS is missing the rural neighbourhoods, and ~25 streets sit in the
// generation queue on NoCentroidError because of it.
//
// A HAND-ESTIMATED CENTROID IS EXACTLY WHAT WE JUST SPENT A PASS REMOVING. These are the
// neighbourhoods with no Town polygon, so there is no boundary to take a centre-of-mass from.
// What there IS: the Town's own road centrelines for the streets we have already assigned to each
// one. So each new entry is the mean of its member streets' centreline centroids, and every entry
// records how many streets it was computed from.
//
// ABSENCE IS NEVER EVIDENCE: a neighbourhood with no street carrying Town geometry gets NO entry.
// The caller keeps throwing NoCentroidError for it, which is the honest outcome — better than a
// plausible point in the middle of a township.
import { readFileSync } from "node:fs"; import { resolve, dirname } from "node:path"; import { fileURLToPath } from "node:url";
const __d = dirname(fileURLToPath(import.meta.url));
for (const f of ["../../.env", "../../.env.local"]) { try { for (const line of readFileSync(resolve(__d, f), "utf8").split(/\r?\n/)) { const t = line.trim(); if (!t || t.startsWith("#")) continue; const eq = t.indexOf("="); if (eq < 0) continue; const k = t.slice(0, eq).trim(); let v = t.slice(eq + 1).trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!(k in process.env)) process.env[k] = v; } } catch {} }

const MILTON_BBOX = { minLng: -80.3, maxLng: -79.6, minLat: 43.3, maxLat: 43.75 };
const pad = (s: unknown, n: number) => String(s).padEnd(n);
const lp = (s: unknown, n: number) => String(s).padStart(n);

async function main() {
  const { prisma } = await import("@/lib/prisma");
  const { getSoldDb } = await import("@/lib/db");
  const { NEIGHBOURHOOD_CENTROIDS } = await import("@/lib/geo");
  const { TOWN_ROAD_FACTS } = await import("@/data/townRoadFacts");
  const { identityFromSlug } = await import("@/lib/town/identity");
  const sold = getSoldDb()!;
  const L = (s = "") => console.log(s);

  const have = new Set(Object.keys(NEIGHBOURHOOD_CENTROIDS));
  const nbhds = await prisma.neighbourhood.findMany({ orderBy: { slug: "asc" } });
  const streets = await prisma.residentialStreet.findMany({
    select: { slug: true, neighbourhoodId: true, neighbourhoodSource: true },
  });

  // Which raw strings actually appear on records and are currently unresolvable — the population
  // that is throwing, derived rather than copied from the error log.
  const rawInUse = new Set<string>();
  for (const r of (await sold`SELECT DISTINCT neighbourhood nb FROM sold.sold_records
                              WHERE perm_advertise = TRUE AND neighbourhood IS NOT NULL`) as Array<{ nb: string }>) rawInUse.add(r.nb);
  for (const l of await prisma.listing.findMany({ where: { permAdvertise: true }, select: { neighbourhood: true }, distinct: ["neighbourhood"] })) {
    if (l.neighbourhood) rawInUse.add(l.neighbourhood);
  }

  L("═".repeat(100));
  L("RURAL CENTROIDS — derived from Town road centrelines");
  L("═".repeat(100));
  L(`    raw neighbourhood strings seen on records ...... ${rawInUse.size}`);
  L(`    already in NEIGHBOURHOOD_CENTROIDS ............. ${[...rawInUse].filter((r) => have.has(r)).length}`);
  L(`    MISSING (these throw NoCentroidError) .......... ${[...rawInUse].filter((r) => !have.has(r)).length}`);
  L();

  const emit: string[] = [];
  for (const n of nbhds) {
    const missingRaw = n.rawStrings.filter((r) => rawInUse.has(r) && !have.has(r));
    if (!missingRaw.length) continue;

    const members = streets.filter((s) => s.neighbourhoodId === n.id);
    const pts: Array<{ slug: string; lat: number; lng: number; src: string | null }> = [];
    for (const s of members) {
      const f = (TOWN_ROAD_FACTS as Record<string, { lat: number; lng: number } | undefined>)[identityFromSlug(s.slug).key];
      if (f) pts.push({ slug: s.slug, lat: f.lat, lng: f.lng, src: s.neighbourhoodSource });
    }

    L(`── ${n.slug}   (${n.name})`);
    L(`     raw strings still missing: ${missingRaw.map((r) => `"${r}"`).join(", ")}`);
    L(`     member streets: ${members.length}   with Town centreline geometry: ${pts.length}`);
    if (!pts.length) {
      L(`     => NO ENTRY. No member street carries Town geometry; the caller keeps throwing.`);
      L();
      continue;
    }
    const lat = pts.reduce((a, p) => a + p.lat, 0) / pts.length;
    const lng = pts.reduce((a, p) => a + p.lng, 0) / pts.length;
    if (lng < MILTON_BBOX.minLng || lng > MILTON_BBOX.maxLng || lat < MILTON_BBOX.minLat || lat > MILTON_BBOX.maxLat) {
      throw new Error(`${n.slug}: derived centroid ${lat},${lng} is outside Milton's bounding box`);
    }
    // Spread, so a mean over a township is not quoted as if it were a point.
    const spreadKm = Math.max(...pts.map((p) => Math.hypot((p.lng - lng) * 80.5, (p.lat - lat) * 111.0)));
    const bySrc = pts.reduce((a, p) => { a[p.src ?? "?"] = (a[p.src ?? "?"] ?? 0) + 1; return a; }, {} as Record<string, number>);
    L(`     provenance of members: ${Object.entries(bySrc).map(([k, v]) => `${k}=${v}`).join(" ")}`);
    L(`     => centroid ${lat.toFixed(4)}, ${lng.toFixed(4)}   (mean of ${pts.length}, max member distance ${spreadKm.toFixed(1)} km)`);
    for (const raw of missingRaw) {
      emit.push(`  ${JSON.stringify(raw).padEnd(32)} { lat: ${lat.toFixed(4)}, lng: ${lng.toFixed(4)} }, // derived: mean of ${pts.length} Town centrelines, spread ${spreadKm.toFixed(1)}km`);
    }
    L();
  }

  L("─".repeat(100));
  L("PASTE INTO src/lib/geo.ts:");
  L("─".repeat(100));
  for (const e of emit) L(e);
  if (!emit.length) L("  (nothing derivable)");

  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });

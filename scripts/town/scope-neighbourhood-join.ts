// scripts/town/scope-neighbourhood-join.ts
// THE SCOPING PASS that decided the neighbourhood join was worth building. READ-ONLY — it writes
// nothing, assigns nothing, and is safe to re-run whenever the Town republishes a layer.
//
//   npx tsx --tsconfig tsconfig.test.json scripts/town/scope-neighbourhood-join.ts
//
// It answers, from the record:
//   (a) how many orphan streets Town geometry can place, and what the rest are
//   (b) whether the Town's 26 polygons correspond to our neighbourhoods
//   (c) how often one street crosses more than one of them
//   (d) which orphans have a neighbourhood DECLARED on a record we simply never applied
//   (e) what an assignment would actually unlock
//
// ─────────────────────────────────────────────────────────────────────────────────────────────
// THE CONTROL IS THE POINT OF THIS FILE.
//
// The first two versions of this analysis reported "0 of 187 streets assignable" and were
// completely, confidently wrong. ArcGIS writes outer polygon rings clockwise and holes
// counter-clockwise; the hand-written orientation test had the sign backwards, so every outer
// ring was classified as a hole and point-in-polygon returned false everywhere on Earth. It did
// not throw, it did not look broken, and the number it produced — zero — is exactly the number a
// genuinely empty result would produce.
//
// Two things now prevent that. The point-in-polygon lives in src/lib/town/polygons.ts and uses
// EVEN-ODD ring counting, which needs no orientation convention at all. And this script runs a
// CONTROL first: streets whose TREB neighbourhood we already know, put through the same geometry,
// which must still agree. A silent zero fails the control immediately. Never read the numbers
// below without reading the control above them.
//
// The control is also wired into the battery permanently, as scripts/verify/checks/
// geometry-control.mjs, so a future Town refresh that moves a boundary is caught by a gate rather
// than by someone re-reading this script.
// ─────────────────────────────────────────────────────────────────────────────────────────────
import { readFileSync } from "node:fs"; import { resolve, dirname } from "node:path"; import { fileURLToPath } from "node:url";
const __d = dirname(fileURLToPath(import.meta.url));
for (const f of ["../../.env", "../../.env.local"]) { try { for (const line of readFileSync(resolve(__d, f), "utf8").split(/\r?\n/)) { const t = line.trim(); if (!t || t.startsWith("#")) continue; const eq = t.indexOf("="); if (eq < 0) continue; const k = t.slice(0, eq).trim(); let v = t.slice(eq + 1).trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!(k in process.env)) process.env[k] = v; } } catch {} }
import path from "node:path";

const pad = (s: unknown, n: number) => String(s).padEnd(n);
const lp = (s: unknown, n: number) => String(s).padStart(n);
const pct = (x: number) => `${Math.round(x * 100)}%`;

interface RoadFeature { attributes: Record<string, unknown>; geometry?: { paths?: number[][][] } }

async function main() {
  const { prisma } = await import("@/lib/prisma");
  const { getSoldDb } = await import("@/lib/db");
  const { TOWN_NEIGHBOURHOODS, TOWN_NEIGHBOURHOODS_PULLED } = await import("@/data/townNeighbourhoods");
  const { TOWN_POLYGON_TO_NEIGHBOURHOOD } = await import("@/data/townNeighbourhoodMap");
  const { TOWN_ROAD_FACTS } = await import("@/data/townRoadFacts");
  const { identityFromSlug, identityFromTown } = await import("@/lib/town/identity");
  const { polygonAt, lengthByPolygon, dominantPolygon, DOMINANT_SHARE_FLOOR } = await import("@/lib/town/polygons");
  const sold = getSoldDb()!;
  const L = (s = "") => console.log(s);
  const centroid = (slug: string) => {
    const f = (TOWN_ROAD_FACTS as Record<string, { lat: number; lng: number } | undefined>)[identityFromSlug(slug).key];
    return f ? [f.lng, f.lat] : null;
  };

  L("═".repeat(104));
  L(`SCOPING THE NEIGHBOURHOOD JOIN — read-only. Town layer pulled ${TOWN_NEIGHBOURHOODS_PULLED}.`);
  L("═".repeat(104));
  L(`    Town neighbourhood polygons .......... ${TOWN_NEIGHBOURHOODS.length}`);
  L(`    road-facts centroids ................. ${Object.keys(TOWN_ROAD_FACTS).length}`);

  const nbhds = await prisma.neighbourhood.findMany({ orderBy: { slug: "asc" } });
  const byId = new Map(nbhds.map((n) => [n.id, n]));
  const streets = await prisma.residentialStreet.findMany({
    select: { slug: true, neighbourhoodId: true, neighbourhoodSource: true, hasPublishedPage: true, recencyWeightedSold: true },
  });

  // ── CONTROL ─────────────────────────────────────────────────────────────────────────────────
  // Population is 'treb'-sourced ONLY. Including geometry's own assignments would be checking the
  // inference against itself — the guard-verified-by-its-own-predicate failure.
  L();
  L("─".repeat(104));
  L("CONTROL — geometry must still reproduce what TREB already told us");
  L("─".repeat(104));
  let agree = 0, disagree = 0, ctrlUnmapped = 0, ctrlOutside = 0, ctrlNoCentroid = 0;
  const disagreements: string[] = [];
  const known = streets.filter((s) => s.neighbourhoodId && s.neighbourhoodSource === "treb");
  for (const s of known) {
    const c = centroid(s.slug);
    if (!c) { ctrlNoCentroid++; continue; }
    const hit = polygonAt(c, TOWN_NEIGHBOURHOODS);
    if (!hit) { ctrlOutside++; continue; }
    const ours = TOWN_POLYGON_TO_NEIGHBOURHOOD[hit.name];
    if (!ours) { ctrlUnmapped++; continue; }
    if (ours === byId.get(s.neighbourhoodId!)!.slug) agree++;
    else { disagree++; if (disagreements.length < 25) disagreements.push(`${pad(s.slug, 34)} TREB=${pad(byId.get(s.neighbourhoodId!)!.slug, 20)} Town=${hit.name}`); }
  }
  const comparable = agree + disagree;
  const rate = comparable ? agree / comparable : 0;
  L(`    treb-sourced assignments ............. ${known.length}`);
  L(`    comparable (landed in a mapped polygon) ${comparable}`);
  L(`      AGREE .............................. ${lp(agree, 5)}  ${pct(rate)}`);
  L(`      DISAGREE ........................... ${lp(disagree, 5)}`);
  L(`    excluded: unmapped polygon ${lp(ctrlUnmapped, 4)} · outside ${lp(ctrlOutside, 3)} · no centroid ${lp(ctrlNoCentroid, 3)}`);
  if (comparable === 0) L(`    !! CONTROL READ NOTHING — every number below is unverified.`);
  else if (rate < 0.95) L(`    !! CONTROL BELOW 95% — treat everything below as unproven.`);
  L(`    disagreements (a finding about boundaries, not necessarily an error):`);
  for (const d of disagreements) L(`      ${d}`);
  if (!disagreements.length) L(`      (none)`);

  // ── (b) correspondence ──────────────────────────────────────────────────────────────────────
  L();
  L("─".repeat(104));
  L("(b) TOWN POLYGONS vs OUR NEIGHBOURHOODS");
  L("─".repeat(104));
  const mappedTargets = new Set(Object.values(TOWN_POLYGON_TO_NEIGHBOURHOOD).filter(Boolean) as string[]);
  for (const p of [...TOWN_NEIGHBOURHOODS].sort((a, b) => a.name.localeCompare(b.name))) {
    const ours = TOWN_POLYGON_TO_NEIGHBOURHOOD[p.name];
    L(`    ${pad(p.name, 28)} -> ${ours ?? "(null — deliberately unmapped)"}`);
  }
  L();
  L(`    ours with NO Town polygon mapping to them:`);
  for (const n of nbhds) if (!mappedTargets.has(n.slug)) L(`      ${pad(n.slug, 26)} ${n.profile}`);

  // ── (a) coverage ────────────────────────────────────────────────────────────────────────────
  L();
  L("─".repeat(104));
  L("(a) CAN TOWN GEOMETRY PLACE THE ORPHANS?");
  L("─".repeat(104));
  const orphans = streets.filter((s) => !s.neighbourhoodId);
  let inMapped = 0, inUnmapped = 0, outside = 0, noCentroid = 0;
  const outsideNames: string[] = [], noCentroidNames: string[] = [];
  for (const s of orphans) {
    const c = centroid(s.slug);
    if (!c) { noCentroid++; noCentroidNames.push(s.slug); continue; }
    const hit = polygonAt(c, TOWN_NEIGHBOURHOODS);
    if (!hit) { outside++; outsideNames.push(s.slug); continue; }
    if (TOWN_POLYGON_TO_NEIGHBOURHOOD[hit.name]) inMapped++; else inUnmapped++;
  }
  L(`    ResidentialStreet rows ............... ${streets.length}`);
  L(`    still unassigned ..................... ${orphans.length}`);
  L(`      inside a MAPPED polygon ............ ${inMapped}`);
  L(`      inside a null-mapped polygon ....... ${inUnmapped}`);
  L(`      outside every polygon .............. ${outside}   [${outsideNames.join(", ")}]`);
  L(`      absent from the Town road layer .... ${noCentroid}`);
  L(`      (absence is never evidence — those ${outside + noCentroid} lose nothing)`);

  // ── (c) straddling, measured on the real centrelines ────────────────────────────────────────
  L();
  L("─".repeat(104));
  L(`(c) STRADDLING — measured by centreline length, floor ${pct(DOMINANT_SHARE_FLOOR)}`);
  L("─".repeat(104));
  const cache = path.join(__d, ".cache/roads.json");
  try {
    const roads: { features: RoadFeature[] } = JSON.parse(readFileSync(cache, "utf8"));
    const pathsByKey = new Map<string, number[][][]>();
    for (const f of roads.features) {
      const key = identityFromTown(f.attributes.GEOSTNAME as string, f.attributes.SUFSTTYPE as string).key;
      if (!key || key === "||") continue;
      if (!pathsByKey.has(key)) pathsByKey.set(key, []);
      pathsByKey.get(key)!.push(...(f.geometry?.paths ?? []));
    }
    let single = 0, multi = 0, none = 0;
    const multiNames: string[] = [];
    for (const [key, paths] of pathsByKey) {
      const d = dominantPolygon(lengthByPolygon(paths, TOWN_NEIGHBOURHOODS));
      const ours = new Set(d.ranked.map((r) => TOWN_POLYGON_TO_NEIGHBOURHOOD[r.name]).filter(Boolean));
      if (ours.size === 0) none++;
      else if (ours.size === 1) single++;
      else { multi++; if (multiNames.length < 25) multiNames.push(`${pad(key, 32)} ${[...ours].join(", ")}`); }
    }
    L(`    street identities with centreline geometry ... ${pathsByKey.size}`);
    L(`      touching ONE of our neighbourhoods ........ ${single}`);
    L(`      touching TWO OR MORE ...................... ${multi}`);
    L(`      touching NONE (unmapped / outside) ........ ${none}`);
    for (const m of multiNames) L(`      ${m}`);
  } catch (e) {
    L(`    roads cache absent — run: node scripts/town/fetch-layers.mjs`);
    L(`    (${(e as Error).message})`);
    L(`    STRADDLE ANALYSIS NOT RUN — reported as not measured, never as zero.`);
  }

  // ── (d) declared-but-unapplied ──────────────────────────────────────────────────────────────
  L();
  L("─".repeat(104));
  L("(d) ORPHANS WITH A NEIGHBOURHOOD ALREADY DECLARED ON A RECORD");
  L("─".repeat(104));
  const rawToNbhd = new Map<string, string>();
  for (const n of nbhds) for (const raw of n.rawStrings) rawToNbhd.set(raw, n.slug);
  const orphanSlugs = new Set(orphans.map((o) => o.slug));
  const declared = new Map<string, Set<string>>();
  for (const r of (await sold`SELECT DISTINCT street_slug s, neighbourhood nb FROM sold.sold_records
                              WHERE perm_advertise = TRUE AND neighbourhood IS NOT NULL AND sold_date <= NOW()`) as Array<{ s: string; nb: string }>) {
    if (!orphanSlugs.has(r.s)) continue;
    const ours = rawToNbhd.get(r.nb); if (!ours) continue;
    if (!declared.has(r.s)) declared.set(r.s, new Set());
    declared.get(r.s)!.add(ours);
  }
  for (const r of await prisma.listing.groupBy({ by: ["streetSlug", "neighbourhood"], _count: { _all: true }, where: { permAdvertise: true, streetSlug: { in: [...orphanSlugs] } } })) {
    const ours = r.neighbourhood ? rawToNbhd.get(r.neighbourhood) : null; if (!ours) continue;
    if (!declared.has(r.streetSlug)) declared.set(r.streetSlug, new Set());
    declared.get(r.streetSlug)!.add(ours);
  }
  L(`    orphans with a declared neighbourhood: ${declared.size}`);
  for (const [slug, set] of declared) L(`      ${pad(slug, 34)} ${[...set].join(" | ")}${set.size > 1 ? "   AMBIGUOUS" : ""}`);
  if (!declared.size) L(`      (none — every declared assignment has been applied)`);

  // ── (e) what it unlocks ─────────────────────────────────────────────────────────────────────
  L();
  L("─".repeat(104));
  L("(e) WHAT ASSIGNMENT UNLOCKS");
  L("─".repeat(104));
  const db2 = new Map(((await sold`SELECT street_slug s, COUNT(*)::int n FROM sold.sold_records WHERE perm_advertise=TRUE AND sold_date <= NOW() GROUP BY 1`) as Array<{ s: string; n: number }>).map((r) => [r.s, r.n]));
  const geo = streets.filter((s) => s.neighbourhoodSource === "town-geometry");
  L(`    geometry-assigned streets ............ ${geo.length}`);
  L(`      with ANY record in DB2 ............. ${geo.filter((s) => (db2.get(s.slug) ?? 0) > 0).length}`);
  L(`      surfaced (would enter a hub ladder)  ${geo.filter((s) => s.recencyWeightedSold > 0 || s.hasPublishedPage).length}`);
  L();
  L(`    A neighbourhood does not create a sale. These streets are orphans precisely BECAUSE no`);
  L(`    record names them, so they gain hub CONTEXT and a non-orphan internal link — not numbers.`);

  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });

// scripts/town/assign-neighbourhoods.ts
// STEP (b). Assign a neighbourhood to streets that have none, by DOMINANT CENTRELINE LENGTH
// against the Town of Milton Neighbourhoods layer.
//
//   npx tsx --tsconfig tsconfig.test.json scripts/town/assign-neighbourhoods.ts          (dry run)
//   npx tsx --tsconfig tsconfig.test.json scripts/town/assign-neighbourhoods.ts --apply
//
// THE FOUR CONSTRAINTS THIS SCRIPT IS BUILT AROUND
//
//  1. PROVENANCE. Everything written here gets neighbourhoodSource='town-geometry'. It is an
//     INFERENCE about position and must stay distinguishable from a TREB record's DECLARATION —
//     kelso-road-milton is declared "Rural Milton West" and computed "Nassagaweya", and the
//     declaration is right. This script therefore refuses to touch any street that already has a
//     neighbourhood, whatever the geometry says.
//
//  2. GEOMETRY NEVER DRIVES A K-ANON POOL. Nothing here can. Hub aggregates are computed in
//     buildHubInput from Neighbourhood.rawStrings against sold.sold_records.neighbourhood — a
//     TREB-keyed path that never reads ResidentialStreet. And the hub street ladder is filtered by
//     SURFACED_STREET_WHERE (recencyWeightedSold>0 OR hasPublishedPage), which every street this
//     script assigns fails by definition: they are dormant precisely because no record names them.
//     The assertion for this is in scripts/town/assert-no-aggregate-moved.ts, not in a comment.
//
//  3. THE TOWN IS A POSITION ORACLE. Polygon names go through src/data/townNeighbourhoodMap.ts.
//     A polygon mapped to null assigns nothing — notably the Town's single "Nassagaweya" polygon,
//     which covers five TREB neighbourhoods at 29% agreement.
//
//  4. ABSENCE IS NEVER EVIDENCE. A street with no centreline in the Town layer, or whose
//     centreline lands outside every polygon, is left exactly as it was and loses nothing.
import { readFileSync } from "node:fs"; import { resolve, dirname } from "node:path"; import { fileURLToPath } from "node:url";
const __d = dirname(fileURLToPath(import.meta.url));
for (const f of ["../../.env", "../../.env.local"]) { try { for (const line of readFileSync(resolve(__d, f), "utf8").split(/\r?\n/)) { const t = line.trim(); if (!t || t.startsWith("#")) continue; const eq = t.indexOf("="); if (eq < 0) continue; const k = t.slice(0, eq).trim(); let v = t.slice(eq + 1).trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!(k in process.env)) process.env[k] = v; } } catch {} }
import path from "node:path";

const APPLY = process.argv.includes("--apply");
const pad = (s: unknown, n: number) => String(s).padEnd(n);
const lp = (s: unknown, n: number) => String(s).padStart(n);
const pct = (x: number) => `${Math.round(x * 100)}%`;

interface RoadFeature { attributes: Record<string, unknown>; geometry?: { paths?: number[][][] } }

async function main() {
  const { prisma } = await import("@/lib/prisma");
  const { TOWN_NEIGHBOURHOODS } = await import("@/data/townNeighbourhoods");
  const { TOWN_POLYGON_TO_NEIGHBOURHOOD, UNMAPPED_POLYGONS } = await import("@/data/townNeighbourhoodMap");
  const { identityFromSlug, identityFromTown } = await import("@/lib/town/identity");
  const { lengthByPolygon, dominantPolygon, DOMINANT_SHARE_FLOOR } = await import("@/lib/town/polygons");
  const L = (s = "") => console.log(s);

  // Centrelines come from the raw layer cache, because dominant LENGTH needs the geometry itself —
  // townRoadFacts carries only the centroid, which is one point standing in for a line.
  const cache = path.join(__d, ".cache/roads.json");
  let roads: { features: RoadFeature[] };
  try {
    roads = JSON.parse(readFileSync(cache, "utf8"));
  } catch {
    throw new Error(`roads cache missing at ${cache} — run: node scripts/town/fetch-layers.mjs`);
  }
  const pathsByKey = new Map<string, number[][][]>();
  for (const f of roads.features) {
    const key = identityFromTown(f.attributes.GEOSTNAME as string, f.attributes.SUFSTTYPE as string).key;
    if (!key || key === "||") continue;
    if (!pathsByKey.has(key)) pathsByKey.set(key, []);
    pathsByKey.get(key)!.push(...(f.geometry?.paths ?? []));
  }

  const nbhds = await prisma.neighbourhood.findMany();
  const idBySlug = new Map(nbhds.map((n) => [n.slug, n.id]));
  const streets = await prisma.residentialStreet.findMany({
    select: { id: true, slug: true, neighbourhoodId: true, recencyWeightedSold: true },
  });

  // PUBLICATION IS StreetContent, NOT THE DENORMALISED FLAG. The first run of this script trusted
  // ResidentialStreet.hasPublishedPage — the repo's own surfacing predicate — to mean "this street
  // does not render a page", and that column is STALE on 6 rows: geddes-landing-milton carries
  // hasPublishedPage=false while StreetContent.status='published', so it is in the sitemap and it
  // renders. A geometry assignment reached it and put its neighbourhood's area context
  // ($1.09M / 106 sales) onto a live page. No aggregate moved, but "change no published street
  // page" is its own boundary and geometry crossed it. So the published set is read from
  // StreetContent directly and excluded here, and the flag is never trusted again.
  const publishedContentSlugs = new Set(
    (await prisma.streetContent.findMany({ where: { status: "published" }, select: { streetSlug: true } })).map((r) => r.streetSlug),
  );

  // Sanity: every mapped target must be a real neighbourhood of ours.
  for (const [poly, ours] of Object.entries(TOWN_POLYGON_TO_NEIGHBOURHOOD)) {
    if (ours && !idBySlug.has(ours)) throw new Error(`townNeighbourhoodMap: "${poly}" -> "${ours}", which is not a Neighbourhood slug`);
  }
  const polyNames = new Set(TOWN_NEIGHBOURHOODS.map((p) => p.name));
  for (const poly of Object.keys(TOWN_POLYGON_TO_NEIGHBOURHOOD)) {
    if (!polyNames.has(poly)) throw new Error(`townNeighbourhoodMap: "${poly}" is not a polygon in the Town layer`);
  }
  const missingFromMap = [...polyNames].filter((n) => !(n in TOWN_POLYGON_TO_NEIGHBOURHOOD));
  if (missingFromMap.length) throw new Error(`polygons with no entry in townNeighbourhoodMap: ${missingFromMap.join(", ")}`);

  L("═".repeat(104));
  L(`(b) ASSIGNMENT BY DOMINANT CENTRELINE LENGTH   ${APPLY ? "[APPLY]" : "[DRY RUN]"}`);
  L("═".repeat(104));
  L(`    Town polygons ................................ ${TOWN_NEIGHBOURHOODS.length}`);
  L(`    mapped to one of ours ........................ ${TOWN_NEIGHBOURHOODS.length - UNMAPPED_POLYGONS.length}`);
  L(`    deliberately unmapped ........................ ${UNMAPPED_POLYGONS.length}  [${UNMAPPED_POLYGONS.join(", ")}]`);
  L(`    road identities with centreline geometry ..... ${pathsByKey.size}`);
  L(`    dominant-share floor ......................... ${pct(DOMINANT_SHARE_FLOOR)}`);
  L();

  const targets = streets.filter((s) => !s.neighbourhoodId && !publishedContentSlugs.has(s.slug));
  const excludedPublished = streets.filter((s) => !s.neighbourhoodId && publishedContentSlugs.has(s.slug));
  const assign: Array<{ id: string; slug: string; to: string; poly: string; share: number; metres: number }> = [];
  const spans: Array<{ id: string; slug: string; span: string[]; detail: string }> = [];
  const insufficient: Array<{ slug: string; detail: string }> = [];
  const unmappedHit: Array<{ slug: string; poly: string; share: number }> = [];
  const outside: string[] = [];
  const noGeom: string[] = [];

  for (const s of targets) {
    const key = identityFromSlug(s.slug).key;
    const paths = pathsByKey.get(key);
    if (!paths?.length) { noGeom.push(s.slug); continue; }

    const l = lengthByPolygon(paths, TOWN_NEIGHBOURHOODS);
    const d = dominantPolygon(l);
    if (!d.dominant) { outside.push(s.slug); continue; }

    // Map polygon names to OUR slugs first, then re-rank: two Town polygons that both map to
    // old-milton are ONE neighbourhood as far as we are concerned, and splitting a street's
    // length between them would manufacture a span that does not exist in our scheme.
    const oursShare = new Map<string, number>();
    let unmappedMetres = 0;
    for (const r of d.ranked) {
      const ours = TOWN_POLYGON_TO_NEIGHBOURHOOD[r.name];
      if (!ours) { unmappedMetres += r.metres; continue; }
      oursShare.set(ours, (oursShare.get(ours) ?? 0) + r.metres);
    }
    const rankedOurs = [...oursShare.entries()].sort((a, b) => b[1] - a[1]);
    if (!rankedOurs.length) {
      unmappedHit.push({ slug: s.slug, poly: d.dominant, share: d.share });
      continue;
    }
    const [topSlug, topMetres] = rankedOurs[0];
    const share = topMetres / d.total;                    // share of the WHOLE street, not of the mapped part

    const parts = rankedOurs.map(([k, m]) => `${k} ${pct(m / d.total)}`);
    if (unmappedMetres > 0) parts.push(`(unmapped ${pct(unmappedMetres / d.total)})`);

    if (share >= DOMINANT_SHARE_FLOOR) {
      assign.push({ id: s.id, slug: s.slug, to: topSlug, poly: d.dominant, share, metres: Math.round(d.total) });
    } else if (rankedOurs.length >= 2) {
      // A SPAN is a street that genuinely runs through two or more of OUR neighbourhoods with no
      // clear majority. "Main Street runs through Old Milton, Dempsey and Dorset Park" is truer
      // than picking one. Unmapped ground is named in the detail so the span never silently omits
      // where the rest of the street actually runs.
      spans.push({ id: s.id, slug: s.slug, span: rankedOurs.map(([k]) => k), detail: parts.join("  ") });
    } else {
      // ONE neighbourhood, below the floor — i.e. most of this street is on ground we have no
      // mapping for. That is not a span; recording [rural-trafalgar] for a road that is 94%
      // outside every mapped polygon would assert a relationship the geometry does not support.
      // It gets nothing at all, which is the correct outcome under "absence is never evidence".
      insufficient.push({ slug: s.slug, detail: parts.join("  ") });
    }
  }

  L(`    EXCLUDED — unassigned but StreetContent IS published: ${excludedPublished.length}${excludedPublished.length ? `  [${excludedPublished.map((s) => s.slug).join(", ")}]` : ""}`);
  L(`      geometry must not move a page that is already live; those wait for a declared source.`);
  L();
  L(`    TARGETS (unassigned AND unpublished) ......... ${targets.length}`);
  L(`      assignable at >= ${pct(DOMINANT_SHARE_FLOOR)} of length .......... ${assign.length}`);
  L(`      SPAN recorded (>=2 of ours), left unassigned ${spans.length}`);
  L(`      one of ours but below the floor ............ ${insufficient.length}`);
  L(`      inside only unmapped polygons .............. ${unmappedHit.length}`);
  L(`      centreline outside every polygon ........... ${outside.length}`);
  L(`      no centreline in the Town layer ............ ${noGeom.length}`);
  L();

  const byTarget = new Map<string, number>();
  for (const a of assign) byTarget.set(a.to, (byTarget.get(a.to) ?? 0) + 1);
  L(`    ASSIGNMENTS BY NEIGHBOURHOOD:`);
  for (const [k, v] of [...byTarget.entries()].sort((a, b) => b[1] - a[1])) L(`      ${pad(k, 24)} ${lp(v, 4)}`);
  L();
  L(`    THE ASSIGNMENTS (slug -> ours, share of centreline length, street length m):`);
  for (const a of assign.sort((x, y) => x.to.localeCompare(y.to) || x.slug.localeCompare(y.slug))) {
    L(`      ${pad(a.slug, 36)} -> ${pad(a.to, 20)} ${lp(pct(a.share), 5)}  ${lp(a.metres, 6)}m   [Town: ${a.poly}]`);
  }
  L();
  L(`    SPANS — no neighbourhood holds ${pct(DOMINANT_SHARE_FLOOR)} of the length, so none is claimed:`);
  for (const s of spans) L(`      ${pad(s.slug, 36)} ${s.detail}`);
  if (!spans.length) L(`      (none)`);
  L();
  L(`    BELOW THE FLOOR ON A SINGLE NEIGHBOURHOOD — mostly on unmapped ground, so nothing claimed:`);
  for (const s of insufficient) L(`      ${pad(s.slug, 36)} ${s.detail}`);
  if (!insufficient.length) L(`      (none)`);
  L();
  L(`    INSIDE ONLY UNMAPPED POLYGONS — left alone by design (constraint 3):`);
  for (const u of unmappedHit) L(`      ${pad(u.slug, 36)} ${pad(u.poly, 26)} ${pct(u.share)}`);
  L();
  L(`    OUTSIDE EVERY POLYGON — absence is not evidence, nothing withheld:`);
  for (const o of outside) L(`      ${o}`);
  L();
  L(`    NO CENTRELINE IN THE TOWN LAYER (${noGeom.length}) — same rule:`);
  for (const n of noGeom.slice(0, 40)) L(`      ${n}`);
  if (noGeom.length > 40) L(`      ...(${noGeom.length - 40} more)`);

  if (APPLY) {
    for (const a of assign) {
      await prisma.residentialStreet.update({
        where: { id: a.id },
        data: { neighbourhoodId: idBySlug.get(a.to)!, neighbourhoodSource: "town-geometry" },
      });
    }
    for (const s of spans) {
      await prisma.residentialStreet.update({
        where: { id: s.id },
        data: { neighbourhoodSpan: s.span },   // neighbourhoodId deliberately untouched
      });
    }
    L();
    L(`    APPLIED: ${assign.length} assignment(s) source='town-geometry', ${spans.length} span(s) recorded with NO assignment.`);
  } else {
    L();
    L(`    DRY RUN — nothing written. Re-run with --apply.`);
  }

  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });

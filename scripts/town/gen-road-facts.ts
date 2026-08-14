// Generates src/data/townRoadFacts.ts from the Town of Milton Road Segments layer.
//
//   node scripts/town/fetch-layers.mjs && npx tsx scripts/town/gen-road-facts.ts
//
// BUILD 1 populates only what the coordinate work needs: centroid, segment count, connecting
// streets. The row shape carries the Build-2 columns as optional so they can be filled without
// reshaping the file or touching a consumer.
import fs from "node:fs";
import path from "node:path";
import { identityFromTown } from "../../src/lib/town/identity";
import { assertMilton, CACHE, LAYERS } from "./fetch-layers.mjs";

interface RoadFeature {
  attributes: Record<string, unknown>;
  geometry?: { paths?: number[][][] };
}

const roads: { features: RoadFeature[] } = JSON.parse(
  fs.readFileSync(path.join(CACHE, "roads.json"), "utf8"),
);

// ── ASSERT THE REPROJECTION ──────────────────────────────────────────────────────────────────
// outSR=4326 is a request, not a guarantee. A service that ignored it would return UTM 17N
// metres — ~600000, ~4800000 — which are finite, non-zero, and nowhere near Ontario. Every
// vertex is checked against Milton's bounding box before a single row is written.
const allVertices = roads.features.flatMap((f) => (f.geometry?.paths ?? []).flat());
assertMilton(allVertices, "Roads geometry");

// ── geometry ─────────────────────────────────────────────────────────────────────────────────
const RAD = Math.PI / 180;
function metresBetween(a: number[], b: number[]): number {
  const dx = (b[0] - a[0]) * Math.cos(((a[1] + b[1]) / 2) * RAD) * 111_320;
  const dy = (b[1] - a[1]) * 110_540;
  return Math.hypot(dx, dy);
}
const round6 = (n: number) => Math.round(n * 1e6) / 1e6;
const nodeKey = (pt: number[]) => `${pt[0].toFixed(5)},${pt[1].toFixed(5)}`;
const endpointsOf = (f: RoadFeature) => (f.geometry?.paths ?? []).map((p) => [p[0], p[p.length - 1]]).flat();

// group segments by street identity
const byKey = new Map<string, RoadFeature[]>();
for (const f of roads.features) {
  const id = identityFromTown(f.attributes.GEOSTNAME as string, f.attributes.SUFSTTYPE as string);
  if (!id.base) continue;
  if (!byKey.has(id.key)) byKey.set(id.key, []);
  byKey.get(id.key)!.push(f);
}

// which street identities meet at each node — the connecting-street graph, free from geometry
const nodeToStreets = new Map<string, Set<string>>();
for (const [key, feats] of byKey) {
  for (const f of feats) for (const e of endpointsOf(f)) {
    const nk = nodeKey(e);
    if (!nodeToStreets.has(nk)) nodeToStreets.set(nk, new Set());
    nodeToStreets.get(nk)!.add(key);
  }
}

interface Row {
  key: string;
  lat: number;
  lng: number;
  segments: number;
  connects: string[];
}

const rows: Row[] = [];
for (const [key, feats] of byKey) {
  // Centroid = the LENGTH-WEIGHTED midpoint of every vertex pair, not the mean of vertices:
  // a street whose eastern half is finely segmented would otherwise pull its own centroid east.
  let wLat = 0, wLng = 0, wSum = 0;
  for (const f of feats) {
    for (const pathPts of f.geometry?.paths ?? []) {
      for (let i = 1; i < pathPts.length; i++) {
        const seg = metresBetween(pathPts[i - 1], pathPts[i]);
        if (!(seg > 0)) continue;
        wLng += ((pathPts[i - 1][0] + pathPts[i][0]) / 2) * seg;
        wLat += ((pathPts[i - 1][1] + pathPts[i][1]) / 2) * seg;
        wSum += seg;
      }
    }
  }
  if (!(wSum > 0)) continue;                       // zero-length geometry carries no centroid

  const connects = new Set<string>();
  for (const f of feats) for (const e of endpointsOf(f)) {
    for (const other of nodeToStreets.get(nodeKey(e)) ?? []) if (other !== key) connects.add(other);
  }

  rows.push({
    key,
    lat: round6(wLat / wSum),
    lng: round6(wLng / wSum),
    segments: feats.length,
    connects: [...connects].sort(),
  });
}
rows.sort((a, b) => a.key.localeCompare(b.key));

assertMilton(rows.map((r) => [r.lng, r.lat]), "derived centroids");

const pulled = new Date(fs.statSync(path.join(CACHE, "roads.json")).mtime).toISOString().slice(0, 10);
const out = `// src/data/townRoadFacts.ts
// GENERATED — do not hand-edit. Re-run:
//   node scripts/town/fetch-layers.mjs && npx tsx scripts/town/gen-road-facts.ts
//
// Source : Town of Milton Road Segments (${LAYERS.roads.url})
//          portal https://discover-milton.hub.arcgis.com/
// Pulled : ${pulled}
// Rows   : ${rows.length} street identities from ${roads.features.length} road segments
//
// Contains information licensed under the Open Government Licence – Milton.
//
// THE RULE THIS FILE IS GOVERNED BY: absence is never evidence. A street missing from here is a
// street the Town's 2022 centreline has not caught up to — 22 streets in the Town's own 2026 name
// registry are absent from both its spatial layers, and one of them (Kennedy Circle West) has two
// recorded sales. \`roadFactsFor()\` returns null and the page renders exactly as it did before.
// Nothing here may withhold a page, contradict a sale, or mark an entity unreal.

export interface TownRoadFacts {
  /** length-weighted centroid of the street's centreline, WGS84 */
  lat: number;
  lng: number;
  /** how many centreline segments the Town splits this street into */
  segments: number;
  /** street identity keys sharing a geometry endpoint with this one */
  connects: readonly string[];

  // ── Build 2 (dormant tier) — generated empty today, filled without a reshape ──
  /** LOCAL | COLLECTOR | MINOR ARTERIAL | MAJOR ARTERIAL | HIGHWAY | PRIVATE | … */
  category?: string;
  /** centreline length in metres */
  lengthM?: number;
  culDeSac?: boolean;
  speedLimit?: number;
  lanes?: number;
  ownership?: string;
  plowClass?: string;
  /** municipal address points on this street — the ONLY honest home count. The L/R address
   *  range is an NG911 allocation, not occupancy: summed it reads 134,477 homes against 30,450
   *  real address points, and one rural line reads 48,647 against 104. */
  addressPoints?: number;
}

/** Keyed by \`\${base}||\${type}\` — see src/lib/town/identity.ts. */
export const TOWN_ROAD_FACTS: Record<string, TownRoadFacts> = {
${rows.map((r) => `  ${JSON.stringify(r.key)}: { lat: ${r.lat}, lng: ${r.lng}, segments: ${r.segments}, connects: ${JSON.stringify(r.connects)} },`).join("\n")}
};

export const TOWN_ROAD_FACTS_PULLED = ${JSON.stringify(pulled)};
export const OGL_MILTON_ATTRIBUTION =
  "Contains information licensed under the Open Government Licence – Milton.";
`;

const target = path.join(process.cwd(), "src/data/townRoadFacts.ts");
fs.writeFileSync(target, out);
console.log(`wrote ${target}`);
console.log(`  ${rows.length} street identities · ${roads.features.length} segments · pulled ${pulled}`);
console.log(`  ${(out.length / 1024).toFixed(0)} KB`);

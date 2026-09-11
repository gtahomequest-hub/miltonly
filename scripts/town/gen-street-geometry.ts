// Generates src/data/streetGeometry.ts: the physical facts of a street, from the Town of Milton
// Road Segments layer first and OpenStreetMap second, with QUEUE item 5's Gate A rulings
// (MC-003, 2026-09-11) applied HERE, once, so the accessor is a lookup and the page renders
// exactly what this file says.
//
//   node scripts/town/fetch-layers.mjs && npx tsx --tsconfig tsconfig.test.json scripts/town/gen-street-geometry.ts
//
// THE RULINGS, AS APPLIED:
//   · Town first for lanes, speed limit, length and category. Each is published only when the
//     Town gives ONE value across every segment of the street (0 and null are "not stated", not
//     values). A street with 40 on one block and 60 on the next has no speed limit fact.
//   · OSM for surface and sidewalk, only where single-valued after normalisation. Sidewalk
//     collapses to a side count because OSM's left/right depends on the way's drawing direction.
//   · Terminus: a Town dead-end node (an endpoint of exactly one segment of this street that no
//     other street's geometry touches), guarded: at least BOUNDARY_GUARD_M inside the layer's
//     extent, so a rural line that simply leaves the Town does not read as a cul-de-sac, and
//     never on an arterial or highway. "cul-de-sac" needs the Town type to be one that ends
//     (court, close, place, gate, circle); on another LOCAL type it is "dead end"; else null.
//   · Orientation only above the axis threshold: the length-weighted axial resultant must be at
//     least AXIS_MIN, or the street has no dominant axis and gets no phrase. Milton's grid is
//     rotated off north, so the phrase is one of four axes, never a single compass point.
//   · Everything nullable. Absence renders nothing. Nothing here is a prompt input.
//
// Contains information licensed under the Open Government Licence – Milton. OSM data
// © OpenStreetMap contributors, ODbL.
import fs from "node:fs";
import path from "node:path";
import { identityFromTown, identityFromSlug } from "../../src/lib/town/identity";
import { streetNameToSlug } from "../../src/lib/streetUtils";
import { assertMilton, CACHE, LAYERS } from "./fetch-layers.mjs";

const OSM_GEOJSON = process.env.OSM_ROADS || "D:/dashcam/work/milton-roads.geojson";
const BOUNDARY_GUARD_M = 500;
const AXIS_MIN = 0.6;
const CUL_DE_SAC_TYPES = new Set(["court", "close", "place", "gate", "circle"]);
const THROUGH_CATEGORIES = new Set(["MINOR ARTERIAL", "MAJOR ARTERIAL", "HIGHWAY", "ARTERIAL"]);

interface RoadFeature { attributes: Record<string, unknown>; geometry?: { paths?: number[][][] } }
interface OsmFeature { properties: Record<string, unknown>; geometry: { type: string; coordinates: unknown } }

const roads: { features: RoadFeature[] } = JSON.parse(fs.readFileSync(path.join(CACHE, "roads.json"), "utf8"));
const osm: { features: OsmFeature[] } = JSON.parse(fs.readFileSync(OSM_GEOJSON, "utf8"));

const allVertices = roads.features.flatMap((f) => (f.geometry?.paths ?? []).flat());
assertMilton(allVertices, "Roads geometry");

// ── geometry helpers ─────────────────────────────────────────────────────────────────────────
const RAD = Math.PI / 180;
function metres(a: number[], b: number[]): number {
  const dx = (b[0] - a[0]) * Math.cos(((a[1] + b[1]) / 2) * RAD) * 111_320;
  const dy = (b[1] - a[1]) * 110_540;
  return Math.hypot(dx, dy);
}
/** axial bearing in degrees, 0..180, 0 = north: a street has no direction of travel here */
function axialBearing(a: number[], b: number[]): number {
  const dx = (b[0] - a[0]) * Math.cos(((a[1] + b[1]) / 2) * RAD);
  const dy = b[1] - a[1];
  const deg = (Math.atan2(dx, dy) * 180) / Math.PI;
  return ((deg % 180) + 180) % 180;
}
const nodeKey = (pt: number[]) => `${pt[0].toFixed(5)},${pt[1].toFixed(5)}`;
const linesOf = (g: OsmFeature["geometry"]): number[][][] =>
  g.type === "LineString" ? [g.coordinates as number[][]] : g.type === "MultiLineString" ? (g.coordinates as number[][][]) : [];

/** ONE value or nothing. The rule every attribute fact obeys. */
function single<T>(values: Iterable<T>): T | null {
  const set = new Set([...values].filter((v) => v !== null && v !== undefined && v !== "" && v !== 0));
  return set.size === 1 ? [...set][0] : null;
}

// ── extent, for the boundary guard ───────────────────────────────────────────────────────────
let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
for (const [lng, lat] of allVertices) {
  if (lng < minLng) minLng = lng; if (lng > maxLng) maxLng = lng;
  if (lat < minLat) minLat = lat; if (lat > maxLat) maxLat = lat;
}
function insideGuard(pt: number[]): boolean {
  const toEdge = Math.min(
    metres(pt, [minLng, pt[1]]), metres(pt, [maxLng, pt[1]]),
    metres(pt, [pt[0], minLat]), metres(pt, [pt[0], maxLat]),
  );
  return toEdge >= BOUNDARY_GUARD_M;
}

// ── Town: group by identity, index every vertex by the streets that touch it ─────────────────
const townByKey = new Map<string, RoadFeature[]>();
const townNodes = new Map<string, Set<string>>();
for (const f of roads.features) {
  const id = identityFromTown(f.attributes.GEOSTNAME as string, f.attributes.SUFSTTYPE as string);
  if (!id.base) continue;
  if (!townByKey.has(id.key)) townByKey.set(id.key, []);
  townByKey.get(id.key)!.push(f);
  for (const p of f.geometry?.paths ?? []) for (const v of p) {
    const k = nodeKey(v);
    if (!townNodes.has(k)) townNodes.set(k, new Set());
    townNodes.get(k)!.add(id.key);
  }
}

// ── OSM: same identity, a trailing direction token dropped so "Main Street East" joins MAIN/ST
const DIRECTION_TAIL = /-(north|south|east|west|n|s|e|w)$/;
const osmByKey = new Map<string, OsmFeature[]>();
for (const f of osm.features) {
  const name = String(f.properties?.name ?? "");
  if (!name) continue;
  const slug = streetNameToSlug(name).replace(/-milton$/, "").replace(DIRECTION_TAIL, "");
  const key = identityFromSlug(slug).key;
  if (!identityFromSlug(slug).base) continue;
  if (!osmByKey.has(key)) osmByKey.set(key, []);
  osmByKey.get(key)!.push(f);
}

// ── sidewalk normalisation ───────────────────────────────────────────────────────────────────
function sidewalkOf(p: Record<string, unknown>): string | null {
  const v = (k: string) => (p[k] === undefined || p[k] === null ? null : String(p[k]).toLowerCase());
  const yes = (s: string | null) => s !== null && s !== "no" && s !== "none";
  const sw = v("sidewalk");
  if (sw === "both") return "both sides";
  if (sw === "left" || sw === "right") return "one side";
  if (sw === "no" || sw === "none") return "none";
  if (sw === "separate") return "separate path";
  if (sw !== null) return null;                       // an unknown tagging: not stated
  const both = v("sidewalk:both");
  if (both !== null) return both === "separate" ? "separate path" : yes(both) ? "both sides" : "none";
  const l = v("sidewalk:left"), r = v("sidewalk:right");
  if (l === null && r === null) return null;
  const n = (yes(l) ? 1 : 0) + (yes(r) ? 1 : 0);
  return n === 2 ? "both sides" : n === 1 ? "one side" : "none";
}
const SURFACE_LABEL: Record<string, string> = {
  asphalt: "asphalt", paved: "paved", concrete: "concrete", gravel: "gravel", fine_gravel: "gravel",
  unpaved: "unpaved", dirt: "dirt", ground: "unpaved", compacted: "gravel",
};
const CATEGORY_LABEL: Record<string, string> = {
  LOCAL: "local road", COLLECTOR: "collector road", "MINOR ARTERIAL": "minor arterial",
  "MAJOR ARTERIAL": "major arterial", ARTERIAL: "arterial road", HIGHWAY: "highway", PRIVATE: "private road",
};

// ── the rows ─────────────────────────────────────────────────────────────────────────────────
export interface StreetGeometryRow {
  lengthM: number | null;
  lanes: number | null;
  speedLimit: number | null;
  category: string | null;
  surface: string | null;
  sidewalk: string | null;
  terminus: "cul-de-sac" | "dead end" | null;
  axis: string | null;
  osm: boolean;
}

const rows: Array<[string, StreetGeometryRow]> = [];
const tally = { town: 0, lengthM: 0, lanes: 0, speedLimit: 0, category: 0, surface: 0, sidewalk: 0, terminus: 0, axis: 0, osmJoined: 0 };

for (const [key, feats] of townByKey) {
  const type = key.split("||")[1] ?? "";
  // length, axis, dead ends
  let len = 0, sx = 0, sy = 0;
  const endpointCount = new Map<string, { n: number; pt: number[]; through: boolean }>();
  for (const f of feats) {
    const cat = String(f.attributes.CATEGORY ?? "").toUpperCase();
    for (const p of f.geometry?.paths ?? []) {
      for (let i = 1; i < p.length; i++) {
        const d = metres(p[i - 1], p[i]);
        len += d;
        const b = axialBearing(p[i - 1], p[i]) * 2 * RAD;
        sx += Math.cos(b) * d; sy += Math.sin(b) * d;
      }
      if (p.length) for (const e of [p[0], p[p.length - 1]]) {
        const k = nodeKey(e);
        const cur = endpointCount.get(k) ?? { n: 0, pt: e, through: false };
        cur.n++; cur.through = cur.through || THROUGH_CATEGORIES.has(cat);
        endpointCount.set(k, cur);
      }
    }
  }
  if (!(len > 0)) continue;
  tally.town++;

  const R = Math.hypot(sx, sy) / len;
  const mean = (((Math.atan2(sy, sx) / RAD) / 2) + 180) % 180;
  let axis: string | null = null;
  if (R >= AXIS_MIN) {
    axis = mean < 22.5 || mean >= 157.5 ? "north to south"
      : mean < 67.5 ? "northeast to southwest"
      : mean < 112.5 ? "east to west"
      : "northwest to southeast";
  }

  let guardedDeadEnds = 0;
  for (const [k, e] of endpointCount) {
    if (e.n !== 1 || e.through) continue;
    const others = townNodes.get(k);
    if (others && [...others].some((o) => o !== key)) continue;
    if (!insideGuard(e.pt)) continue;
    guardedDeadEnds++;
  }
  const category = single(feats.map((f) => String(f.attributes.CATEGORY ?? "").toUpperCase()));
  let terminus: StreetGeometryRow["terminus"] = null;
  if (guardedDeadEnds > 0 && category !== null && !THROUGH_CATEGORIES.has(category)) {
    if (CUL_DE_SAC_TYPES.has(type)) terminus = "cul-de-sac";
    else if (category === "LOCAL") terminus = "dead end";
  }

  const lanesRaw = single(feats.map((f) => Number(f.attributes.LANES ?? 0)));
  const speedRaw = single(feats.map((f) => Number(f.attributes.SPEED_LIMIT ?? 0)));

  const o = osmByKey.get(key) ?? [];
  const surfaceRaw = single(o.map((f) => String(f.properties.surface ?? "").toLowerCase()));
  const sidewalkRaw = single(o.map((f) => sidewalkOf(f.properties) ?? ""));

  const row: StreetGeometryRow = {
    lengthM: Math.round(len / 10) * 10,
    lanes: lanesRaw !== null && Number.isInteger(lanesRaw) && lanesRaw > 0 ? lanesRaw : null,
    speedLimit: speedRaw !== null && speedRaw > 0 ? speedRaw : null,
    category: category !== null ? (CATEGORY_LABEL[category] ?? null) : null,
    surface: surfaceRaw !== null ? (SURFACE_LABEL[surfaceRaw] ?? null) : null,
    sidewalk: sidewalkRaw !== null ? sidewalkRaw : null,
    terminus,
    axis,
    osm: o.length > 0,
  };
  if (row.osm) tally.osmJoined++;
  for (const k of ["lengthM", "lanes", "speedLimit", "category", "surface", "sidewalk", "terminus", "axis"] as const) {
    if (row[k] !== null) tally[k]++;
  }
  rows.push([key, row]);
}
rows.sort((a, b) => a[0].localeCompare(b[0]));

const pulled = new Date(fs.statSync(path.join(CACHE, "roads.json")).mtime).toISOString().slice(0, 10);
const osmDate = new Date(fs.statSync(OSM_GEOJSON).mtime).toISOString().slice(0, 10);
const literal = `{\n${rows.map(([k, r]) => `  ${JSON.stringify(k)}: ${JSON.stringify(r)}`).join(",\n")}\n}`;

const out = `// src/data/streetGeometry.ts
// GENERATED — do not hand-edit. Re-run:
//   node scripts/town/fetch-layers.mjs && npx tsx --tsconfig tsconfig.test.json scripts/town/gen-street-geometry.ts
//
// Source : Town of Milton Road Segments (${LAYERS.roads.url}), pulled ${pulled}
//          OpenStreetMap ways for Milton (local export dated ${osmDate}), © OpenStreetMap contributors, ODbL
// Rows   : ${rows.length} street identities from ${roads.features.length} Town segments; ${tally.osmJoined} also joined to OSM
// Facts  : length ${tally.lengthM} · lanes ${tally.lanes} · speed ${tally.speedLimit} · category ${tally.category} · surface ${tally.surface} · sidewalk ${tally.sidewalk} · terminus ${tally.terminus} · axis ${tally.axis}
//
// Contains information licensed under the Open Government Licence – Milton.
//
// EVERY FIELD IS NULLABLE AND NULL RENDERS NOTHING. A value is present only when the layer gives
// ONE value for the whole street (lanes, speed, category, surface, sidewalk), when the dead end
// is real and inside the Town (terminus), or when the street has a dominant axis (axis). The
// rulings live in the generator; this file is their output and the page is its mirror.
//
// NOTHING HERE IS A PROMPT INPUT. scripts/test-geometry-boundary.ts asserts that no field of
// this shape reaches StreetGeneratorInput and that src/lib/ai never imports this file.

export interface StreetGeometryRow {
  /** Town centreline length in metres, to the nearest 10 */
  lengthM: number | null;
  lanes: number | null;
  /** km/h, the Town's posted limit */
  speedLimit: number | null;
  /** "local road" | "collector road" | "minor arterial" | "major arterial" | "highway" | "private road" */
  category: string | null;
  /** OSM surface, normalised: "asphalt" | "paved" | "concrete" | "gravel" | "unpaved" | "dirt" */
  surface: string | null;
  /** OSM sidewalk, as a side count: "both sides" | "one side" | "none" | "separate path" */
  sidewalk: string | null;
  terminus: "cul-de-sac" | "dead end" | null;
  /** one of four axes, only where the street has a dominant one */
  axis: string | null;
  /** whether an OSM way joined this identity at all */
  osm: boolean;
}

/** Keyed by \`\${base}||\${type}\` — see src/lib/town/identity.ts. A JSON literal on purpose: the
 *  verification battery parses it directly. */
export const STREET_GEOMETRY: Record<string, StreetGeometryRow> = ${literal};

export const STREET_GEOMETRY_PULLED = ${JSON.stringify(pulled)};
`;

const target = path.join(process.cwd(), "src/data/streetGeometry.ts");
fs.writeFileSync(target, out);
console.log(`wrote ${target}`);
console.log(`  ${rows.length} identities · Town ${pulled} · OSM export ${osmDate} · ${(out.length / 1024).toFixed(0)} KB`);
console.log(`  facts:`, tally);

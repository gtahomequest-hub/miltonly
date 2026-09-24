// MC-045 read-only scratch: street vertices, downtown reference, landmarks. Reads files only.
// Run from D:\miltonly:  npx tsx <this file>
import fs from "node:fs";
import path from "node:path";
// eslint-disable-next-line
const { identityFromSlug, identityFromTown } = require("D:/miltonly/src/lib/town/identity.ts");
const { TOWN_ROAD_FACTS } = require("D:/miltonly/src/data/townRoadFacts.ts");
const { STREET_GEOMETRY } = require("D:/miltonly/src/data/streetGeometry.ts");

const REPO = "D:/miltonly";
const WORK = "C:/Users/amazo/AppData/Local/Temp/claude/D--miltonly/2c120ff9-e1bd-4ead-a528-076577c194d9/scratchpad/mc045/work";
const MC = path.dirname(WORK);
const slugs: string[] = JSON.parse(fs.readFileSync(path.join(MC, "slugs.json"), "utf8"));
const roads = JSON.parse(fs.readFileSync(path.join(REPO, "scripts/town/.cache/roads.json"), "utf8"));
const nbhd = JSON.parse(fs.readFileSync(path.join(REPO, "scripts/town/.cache/neighbourhoods.json"), "utf8"));

const RAD = Math.PI / 180;
// same planar metre approximation as scripts/town/gen-road-facts.ts:31-35 ([lng,lat] order)
function metres(a: number[], b: number[]): number {
  const dx = (b[0] - a[0]) * Math.cos(((a[1] + b[1]) / 2) * RAD) * 111_320;
  const dy = (b[1] - a[1]) * 110_540;
  return Math.hypot(dx, dy);
}
const r6 = (n: number) => Math.round(n * 1e6) / 1e6;
const nodeKey = (pt: number[]) => `${pt[0].toFixed(5)},${pt[1].toFixed(5)}`;

// group by identity exactly as gen-road-facts.ts:43-49
const byKey = new Map<string, any[]>();
for (const f of roads.features) {
  const id = identityFromTown(f.attributes.GEOSTNAME, f.attributes.SUFSTTYPE);
  if (!id.base) continue;
  if (!byKey.has(id.key)) byKey.set(id.key, []);
  byKey.get(id.key)!.push(f);
}

function summarise(feats: any[]) {
  let wLat = 0, wLng = 0, wSum = 0;
  const vertices: number[][] = [];
  const paths: number[][][] = [];
  let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
  const dirs = new Set<string>(), cats = new Set<string>(), names = new Set<string>();
  for (const f of feats) {
    dirs.add(String(f.attributes.SUFSTDIR ?? ""));
    cats.add(String(f.attributes.CATEGORY ?? ""));
    names.add(String(f.attributes.STREET_NAME ?? ""));
    for (const p of f.geometry?.paths ?? []) {
      const pl: number[][] = [];
      for (let i = 0; i < p.length; i++) {
        const [lng, lat] = p[i];
        pl.push([r6(lat), r6(lng)]);
        vertices.push([r6(lat), r6(lng)]);
        if (lat < minLat) minLat = lat; if (lat > maxLat) maxLat = lat;
        if (lng < minLng) minLng = lng; if (lng > maxLng) maxLng = lng;
        if (i > 0) {
          const s = metres(p[i - 1], p[i]);
          if (s > 0) { wLng += ((p[i - 1][0] + p[i][0]) / 2) * s; wLat += ((p[i - 1][1] + p[i][1]) / 2) * s; wSum += s; }
        }
      }
      paths.push(pl);
    }
  }
  return {
    cacheCentroid: wSum > 0 ? [r6(wLat / wSum), r6(wLng / wSum)] : null,
    lengthM: Math.round(wSum),
    vertices, paths,
    bbox: [r6(minLat), r6(minLng), r6(maxLat), r6(maxLng)],
    dirs: [...dirs].filter(Boolean).sort(),
    categories: [...cats].filter(Boolean).sort(),
    townNames: [...names].sort(),
  };
}

// ── neighbourhood polygons (Town layer), even-odd like src/lib/town/polygons.ts ──
function inRing(pt: number[], ring: number[][]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
const polys = nbhd.features.map((f: any) => ({ name: f.attributes.NAME as string, rings: f.geometry.rings as number[][][] }));
const polyOf = (lng: number, lat: number) =>
  polys.filter((p: any) => p.rings.filter((r: number[][]) => inRing([lng, lat], r)).length % 2 === 1).map((p: any) => p.name);
function distToSegM(p: number[], a: number[], b: number[]) {
  // local planar projection around p
  const kx = Math.cos(p[1] * RAD) * 111_320, ky = 110_540;
  const ax = (a[0] - p[0]) * kx, ay = (a[1] - p[1]) * ky, bx = (b[0] - p[0]) * kx, by = (b[1] - p[1]) * ky;
  const dx = bx - ax, dy = by - ay;
  const L = dx * dx + dy * dy;
  let t = L > 0 ? -(ax * dx + ay * dy) / L : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(ax + t * dx, ay + t * dy);
}
const RURAL = new Set(["Nassagaweya", "Nelson", "Trafalgar", "Esquesing", "Milton Heights"]);
const ruralEdges: Array<[number[], number[]]> = [];
for (const p of polys) if (RURAL.has(p.name)) for (const r of p.rings) for (let i = 1; i < r.length; i++) ruralEdges.push([r[i - 1], r[i]]);
function distToRural(lng: number, lat: number) {
  let m = Infinity;
  for (const [a, b] of ruralEdges) { const d = distToSegM([lng, lat], a, b); if (d < m) m = d; }
  return Math.round(m);
}

// ── downtown reference candidates (computed in landmarks.ts from the same cache) ──
const REFS: Record<string, [number, number]> = {
  mainMartin: [43.513465, -79.88282],   // Main St E x Martin St shared vertex
  mainBronte: [43.508585, -79.88814],   // Main St E/W x Bronte St N/S, the address-grid origin
  townHall: [43.510627, -79.883881],    // 150 Mary St address point
};
function bearing(a: number[], b: number[]) { // [lng,lat] -> degrees, planar local
  const dx = (b[0] - a[0]) * Math.cos(((a[1] + b[1]) / 2) * RAD) * 111_320;
  const dy = (b[1] - a[1]) * 110_540;
  return ((Math.atan2(dx, dy) / RAD) + 360) % 360;
}

// ── per slug ──
const out: Record<string, any> = {};
const unresolved: Array<{ slug: string; key: string; reason: string }> = [];
let driftMax = 0, driftSlug = "";
for (const slug of slugs) {
  const key = identityFromSlug(slug).key;
  const facts = TOWN_ROAD_FACTS[key];
  const feats = byKey.get(key);
  if (!facts || !feats) {
    unresolved.push({ slug, key, reason: !facts && !feats ? "key absent from TOWN_ROAD_FACTS and from roads.json cache" : !facts ? "absent from TOWN_ROAD_FACTS only" : "absent from cache only" });
    continue;
  }
  const s = summarise(feats);
  const drift = s.cacheCentroid ? Math.round(metres([facts.lng, facts.lat], [s.cacheCentroid[1], s.cacheCentroid[0]])) : null;
  if (drift !== null && drift > driftMax) { driftMax = drift; driftSlug = slug; }
  const inPolys = polyOf(facts.lng, facts.lat);
  out[slug] = {
    key,
    centroid: [facts.lat, facts.lng],            // TOWN_ROAD_FACTS (src/data/townRoadFacts.ts), authoritative
    cacheCentroidDriftM: drift,                   // vs centroid recomputed from the 2026-09-11 cache
    lengthM: s.lengthM,
    geometryLengthM: STREET_GEOMETRY[key]?.lengthM ?? null,
    segments: facts.segments,
    cacheSegments: feats.length,
    dirs: s.dirs,
    categories: s.categories,
    townNames: s.townNames,
    bbox: s.bbox,
    townPolygon: inPolys,                         // Town neighbourhood polygon(s) containing the centroid
    ruralPolygonEdgeM: inPolys.some((n: string) => RURAL.has(n)) ? 0 : distToRural(facts.lng, facts.lat),
    spanM: Math.round(metres([s.bbox[1], s.bbox[0]], [s.bbox[3], s.bbox[2]])),
    toRef: Object.fromEntries(Object.entries(REFS).map(([name, [rlat, rlng]]) => {
      const vd = s.vertices.map(([la, ln]) => metres([rlng, rlat], [ln, la]));
      return [name, {
        centroidM: Math.round(metres([rlng, rlat], [facts.lng, facts.lat])),
        bearingDeg: Math.round(bearing([rlng, rlat], [facts.lng, facts.lat])),   // from reference to centroid, 0 = true north, clockwise
        nearestVertexM: Math.round(Math.min(...vd)),
        farthestVertexM: Math.round(Math.max(...vd)),
      }];
    })),
    vertices: s.vertices,
    paths: s.paths,
  };
}
fs.writeFileSync(path.join(WORK, "street-vertices.json"), JSON.stringify(out));
fs.writeFileSync(path.join(WORK, "street-unresolved.json"), JSON.stringify(unresolved, null, 1));

// shared identities (two slugs -> one Town key)
const keyToSlugs = new Map<string, string[]>();
for (const [slug, v] of Object.entries(out)) { const k = (v as any).key; keyToSlugs.set(k, [...(keyToSlugs.get(k) ?? []), slug]); }
const shared = [...keyToSlugs].filter(([, s]) => s.length > 1);

// multi-direction / multi-cluster identities: bbox span over 5 km flags a possible union of distinct places
const wide = Object.entries(out).map(([slug, v]: any) => {
  const [a, b, c, d] = v.bbox; return { slug, spanM: Math.round(metres([b, a], [d, c])), dirs: v.dirs, segs: v.segments };
}).filter((x) => x.spanM > 5000).sort((x, y) => y.spanM - x.spanM);

console.log(JSON.stringify({
  slugs: slugs.length, resolved: Object.keys(out).length, unresolved: unresolved.length,
  unresolvedList: unresolved,
  maxCentroidDriftM: driftMax, driftSlug,
  driftOver25m: Object.entries(out).filter(([, v]: any) => v.cacheCentroidDriftM > 25).map(([s, v]: any) => `${s}:${v.cacheCentroidDriftM}m segs ${v.segments}->${v.cacheSegments}`),
  segCountDiffers: Object.entries(out).filter(([, v]: any) => v.segments !== v.cacheSegments).length,
  sharedKeys: shared,
  withDirs: Object.entries(out).filter(([, v]: any) => v.dirs.length).map(([s, v]: any) => `${s}:${v.dirs.join('/')}`),
  wideSpanOver5km: wide.length, wideTop: wide.slice(0, 25),
  polygonCounts: Object.entries(Object.values(out).reduce((m: any, v: any) => { const k = v.townPolygon.join("+") || "(none)"; m[k] = (m[k] ?? 0) + 1; return m; }, {})).sort((a: any, b: any) => b[1] - a[1]),
}, null, 1));

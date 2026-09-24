// MC-045 read-only scratch: downtown reference candidates and landmark geometry. Reads files only.
import fs from "node:fs";
import path from "node:path";

const REPO = "D:/miltonly";
const WORK = "C:/Users/amazo/AppData/Local/Temp/claude/D--miltonly/2c120ff9-e1bd-4ead-a528-076577c194d9/scratchpad/mc045/work";
const roads = JSON.parse(fs.readFileSync(path.join(REPO, "scripts/town/.cache/roads.json"), "utf8"));
const nbhd = JSON.parse(fs.readFileSync(path.join(REPO, "scripts/town/.cache/neighbourhoods.json"), "utf8"));

const RAD = Math.PI / 180;
function metres(a: number[], b: number[]): number { // [lng,lat]
  const dx = (b[0] - a[0]) * Math.cos(((a[1] + b[1]) / 2) * RAD) * 111_320;
  const dy = (b[1] - a[1]) * 110_540;
  return Math.hypot(dx, dy);
}
const r6 = (n: number) => Math.round(n * 1e6) / 1e6;
const nk = (p: number[]) => `${p[0].toFixed(5)},${p[1].toFixed(5)}`;
const A = (f: any, k: string) => (f.attributes[k] ?? "") as string;

function lineLandmark(name: string, filterDesc: string, pred: (f: any) => boolean, notes = "") {
  const feats = roads.features.filter(pred);
  let wLat = 0, wLng = 0, wSum = 0;
  let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
  const paths: number[][][] = [];
  const names = new Set<string>();
  for (const f of feats) {
    names.add(`${A(f, "STREET_NAME")}${A(f, "SUFSTDIR") ? " [" + A(f, "SUFSTDIR") + "]" : ""}`);
    for (const p of f.geometry?.paths ?? []) {
      paths.push(p.map(([lng, lat]: number[]) => [r6(lat), r6(lng)]));
      for (let i = 0; i < p.length; i++) {
        const [lng, lat] = p[i];
        if (lat < minLat) minLat = lat; if (lat > maxLat) maxLat = lat;
        if (lng < minLng) minLng = lng; if (lng > maxLng) maxLng = lng;
        if (i > 0) { const s = metres(p[i - 1], p[i]); wLng += ((p[i - 1][0] + p[i][0]) / 2) * s; wLat += ((p[i - 1][1] + p[i][1]) / 2) * s; wSum += s; }
      }
    }
  }
  return {
    name, kind: "line", source: "Town of Milton Road Segments, scripts/town/.cache/roads.json (pulled 2026-09-11)",
    filter: filterDesc, segments: feats.length, townNames: [...names].sort(),
    lengthM: Math.round(wSum), centroid: wSum ? [r6(wLat / wSum), r6(wLng / wSum)] : null,
    bbox: feats.length ? [r6(minLat), r6(minLng), r6(maxLat), r6(maxLng)] : null,
    vertexCount: paths.reduce((n, p) => n + p.length, 0), paths, notes,
  };
}
const isRamp = (f: any) => /^EXIT /.test(A(f, "GEOSTNAME"));
const gs = (g: string, types: string[], dirs?: string[]) => (f: any) =>
  !isRamp(f) && A(f, "GEOSTNAME") === g && types.includes(A(f, "SUFSTTYPE")) && (!dirs || dirs.includes(A(f, "SUFSTDIR")));

// ── downtown reference candidates ──
function sharedNodes(pa: (f: any) => boolean, pb: (f: any) => boolean) {
  const m = new Map<string, number[]>();
  for (const f of roads.features.filter(pa)) for (const p of f.geometry.paths) for (const v of p) m.set(nk(v), v);
  const hits: number[][] = [];
  for (const f of roads.features.filter(pb)) for (const p of f.geometry.paths) for (const v of p) if (m.has(nk(v))) hits.push(v);
  const uniq = new Map(hits.map((v) => [nk(v), v]));
  return [...uniq.values()].map(([lng, lat]) => [r6(lat), r6(lng)]);
}
const mainEW = gs("MAIN", ["STREET"], ["E", "W"]);
const mainMartin = sharedNodes(mainEW, gs("MARTIN", ["STREET"]));
const mainBronte = sharedNodes(mainEW, gs("BRONTE", ["STREET"], ["N", "S"]));
const mainOntario = sharedNodes(mainEW, gs("ONTARIO", ["STREET"], ["N", "S"]));

// polygon area-weighted centroid (shoelace, planar in degrees; fine at this scale)
function polyCentroid(ring: number[][]) {
  let a = 0, cx = 0, cy = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [x0, y0] = ring[j], [x1, y1] = ring[i];
    const c = x0 * y1 - x1 * y0; a += c; cx += (x0 + x1) * c; cy += (y0 + y1) * c;
  }
  a /= 2; return [r6(cy / (6 * a)), r6(cx / (6 * a))];
}
const oldMilton = nbhd.features.find((f: any) => f.attributes.NAME === "Old Milton");
const oldMiltonCentroid = polyCentroid(oldMilton.geometry.rings[0]);

const pts: Record<string, { latlng: number[]; source: string }> = {
  "Main St E x Martin St (Town road layer shared vertex)": { latlng: mainMartin[0], source: "roads.json: MAIN STREET E (OBJECTID 1040) and MARTIN STREET (OBJECTID 378) share this vertex; Martin St T-ends at Main St E" },
  "Main St E/W x Bronte St N/S (Town address-grid origin)": { latlng: mainBronte[0], source: "roads.json: the one node where MAIN STREET E, MAIN STREET W, BRONTE STREET N and BRONTE STREET S all end" },
  "Town Hall, 150 Mary St (Town address point)": { latlng: [43.510627, -79.883881], source: "src/data/townAddressPoints.ts packed row '150|mary||street|510627|1116119'; cache addressPoints.json OBJECTID 5495 '150 MARY ST' x=-79.88388076539057 y=43.51062713849841" },
  "Milton GO, 780 Main St E (Town address point)": { latlng: [43.523624, -79.867221], source: "src/data/townAddressPoints.ts packed row '780|main||street|523624|1132779'; cache OBJECTID 16136 '780 MAIN ST E' (the only 780 MAIN in the layer). 780 Main St E as the station's address is outside knowledge, not a repo fact" },
  "Milton GO, src/lib/geo.ts:91 GO_STATION": { latlng: [43.5173, -79.8693], source: "hand constant; used by buildGeneratorInput nearby/commute" },
  "Milton GO, src/lib/geo.ts:191 TRANSIT[0]": { latlng: [43.515, -79.8534], source: "hand constant" },
  "Old Milton polygon centroid (Town Neighbourhoods layer)": { latlng: oldMiltonCentroid, source: "scripts/town/.cache/neighbourhoods.json NAME='Old Milton', area-weighted ring centroid" },
};
const names = Object.keys(pts);
const dist: Record<string, Record<string, number>> = {};
for (const a of names) { dist[a] = {}; for (const b of names) dist[a][b] = Math.round(metres([pts[a].latlng[1], pts[a].latlng[0]], [pts[b].latlng[1], pts[b].latlng[0]])); }

const landmarks = [
  lineLandmark("Highway 401", "GEOSTNAME='401' AND SUFSTTYPE='HIGHWAY' (both carriageways), ramps (GEOSTNAME 'EXIT ...') excluded", gs("401", ["HIGHWAY"])),
  lineLandmark("Highway 407", "GEOSTNAME='407' AND SUFSTTYPE IN ('HIGHWAY','HY'), ramps excluded", gs("407", ["HIGHWAY", "HY"])),
  lineLandmark("Highway 403 (for completeness)", "GEOSTNAME='403' AND SUFSTTYPE='HIGHWAY'", gs("403", ["HIGHWAY"])),
  lineLandmark("Derry Road", "GEOSTNAME='DERRY' AND SUFSTTYPE='ROAD'", gs("DERRY", ["ROAD"])),
  lineLandmark("Steeles Avenue", "GEOSTNAME='STEELES' AND SUFSTTYPE='AVENUE' (E, W and undirected)", gs("STEELES", ["AVENUE"])),
  lineLandmark("Main Street (E/W, the Milton urban street)", "GEOSTNAME='MAIN' AND SUFSTTYPE='STREET' AND SUFSTDIR IN ('E','W')", mainEW),
  lineLandmark("Main Street N/S (Campbellville, NOT the Milton Main Street)", "GEOSTNAME='MAIN' AND SUFSTTYPE='STREET' AND SUFSTDIR IN ('N','S')", gs("MAIN", ["STREET"], ["N", "S"]),
    "identityFromSlug('main-street-milton') = 'main||street' unions these 5 Campbellville segments with the 27 E/W ones"),
  lineLandmark("Martin Street", "GEOSTNAME='MARTIN' AND SUFSTTYPE='STREET'", gs("MARTIN", ["STREET"])),
  lineLandmark("Ontario Street", "GEOSTNAME='ONTARIO' AND SUFSTTYPE='STREET' (N, S)", gs("ONTARIO", ["STREET"])),
  lineLandmark("Thompson Road", "GEOSTNAME='THOMPSON' AND SUFSTTYPE='ROAD' (N, S)", gs("THOMPSON", ["ROAD"])),
  lineLandmark("James Snow Parkway", "GEOSTNAME='JAMES SNOW' AND SUFSTTYPE='PARKWAY' (N, S)", gs("JAMES SNOW", ["PARKWAY"])),
  lineLandmark("Britannia Road", "GEOSTNAME='BRITANNIA' AND SUFSTTYPE='ROAD' (Old Britannia Road excluded)", gs("BRITANNIA", ["ROAD"])),
  lineLandmark("Louis St Laurent Avenue", "GEOSTNAME='LOUIS ST LAURENT' AND SUFSTTYPE='AVENUE'", gs("LOUIS ST LAURENT", ["AVENUE"])),
  lineLandmark("Bronte Street", "GEOSTNAME='BRONTE' AND SUFSTTYPE='STREET' (N, S; Bronte Street Service Road excluded)", gs("BRONTE", ["STREET"])),
  lineLandmark("Regional Road 25", "GEOSTNAME='REGIONAL ROAD NO 25' (SUFSTTYPE null)", (f: any) => !isRamp(f) && A(f, "GEOSTNAME") === "REGIONAL ROAD NO 25"),
  lineLandmark("Kelso Road", "GEOSTNAME='KELSO' AND SUFSTTYPE='ROAD'", gs("KELSO", ["ROAD"]), "one segment; the road, not the conservation area"),
  lineLandmark("Trafalgar Road (extra)", "GEOSTNAME='TRAFALGAR' AND SUFSTTYPE='ROAD'", gs("TRAFALGAR", ["ROAD"])),
  lineLandmark("Tremaine Road (extra)", "GEOSTNAME='TREMAINE' AND SUFSTTYPE='ROAD'", gs("TREMAINE", ["ROAD"])),
  lineLandmark("Fifth Line (extra)", "GEOSTNAME='FIFTH' AND SUFSTTYPE='LINE'", (f: any) => !isRamp(f) && A(f, "GEOSTNAME") === "FIFTH" && A(f, "SUFSTTYPE") === "LINE"),
];

const points = [
  ...Object.entries(pts).map(([name, v]) => ({ name, kind: "point", latlng: v.latlng, source: v.source })),
  { name: "Kelso Conservation Area", kind: "point", latlng: [43.5167, -79.9333], source: "src/lib/geo.ts CONSERVATION_AREAS (hand coordinate; Conservation Halton land, not in any Town layer)" },
  { name: "Rattlesnake Point Conservation", kind: "point", latlng: [43.5056, -79.9567], source: "src/lib/geo.ts CONSERVATION_AREAS (hand coordinate)" },
  { name: "Milton District Hospital", kind: "point", latlng: [43.5158, -79.8861], source: "src/lib/geo.ts:90 HOSPITAL (hand coordinate)" },
  { name: "Centennial Park (50 Martin St, by the Mill Pond)", kind: "point", latlng: [43.514235, -79.884501], source: "src/data/townPlaces.ts:93 (Town Parks layer, area-weighted centroid)" },
  { name: "Victoria Park (44 Brown St)", kind: "point", latlng: [43.510083, -79.88418], source: "src/data/townPlaces.ts:158" },
];
const polygons = [
  { name: "Old Milton (Town Neighbourhoods polygon)", kind: "polygon", centroid: oldMiltonCentroid,
    rings: oldMilton.geometry.rings.map((r: number[][]) => r.map(([lng, lat]) => [r6(lat), r6(lng)])),
    source: "scripts/town/.cache/neighbourhoods.json; same geometry as src/data/townNeighbourhoods.ts" },
];
const unavailable = [
  { name: "Niagara Escarpment", reason: "no escarpment line/polygon anywhere in src/data, src/lib or scripts/town/.cache. 'ESCARPMENT WAY' in the road layer is a 1-segment street name, not the landform. Only proxies are the two hand conservation-area points in src/lib/geo.ts." },
  { name: "Downtown core (as an area)", reason: "no 'downtown' polygon or BIA boundary in the repo. Candidates: the Old Milton Town neighbourhood polygon (1.86 km2) or a point (see reference candidates)." },
];

const out = { referenceCandidates: pts, referenceDistancesM: dist, mainMartinAll: mainMartin, mainBronteAll: mainBronte, mainOntarioAll: mainOntario, landmarks, points, polygons, unavailable };
fs.writeFileSync(path.join(WORK, "landmarks.json"), JSON.stringify(out));
console.log(JSON.stringify({
  referenceCandidates: pts, referenceDistancesM: dist, mainMartin, mainBronte, mainOntario,
  landmarks: landmarks.map(({ paths, ...rest }) => rest),
}, null, 1));

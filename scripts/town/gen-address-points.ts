// Generates src/data/townAddressPoints.ts from the Town of Milton Address Points layer.
//
//   node scripts/town/fetch-layers.mjs && npx tsx scripts/town/gen-address-points.ts
//
// 46,379 municipal address points -> one rooftop coordinate per (street number, street identity).
//
// WHY A COMPACT STRING AND NOT AN OBJECT LITERAL. 40k object literals parse into 40k objects at
// module load whether or not anything asks for a coordinate. This ships one newline-delimited
// string and builds the Map on FIRST LOOKUP, so a route that imports the module transitively and
// never resolves an address pays for a string constant and nothing else.
import fs from "node:fs";
import path from "node:path";
import { identityFromTown, rooftopKey } from "../../src/lib/town/identity";
import { assertMilton, CACHE, LAYERS } from "./fetch-layers.mjs";

interface PointFeature {
  attributes: { ADDRESS_NUM?: number; GEOSTNAME?: string; STREET_TYPE?: string };
  geometry?: { x: number; y: number };
}

const layer: { features: PointFeature[] } = JSON.parse(
  fs.readFileSync(path.join(CACHE, "addressPoints.json"), "utf8"),
);

assertMilton(
  layer.features.filter((f) => f.geometry).map((f) => [f.geometry!.x, f.geometry!.y]),
  "Address Points geometry",
);

const round6 = (n: number) => Math.round(n * 1e6) / 1e6;

// One point per (number, street). Units in a tower share a rooftop, so the first wins — and the
// count of collapsed duplicates is reported, because a silent collapse is how a join starts
// lying about its own coverage.
const seen = new Map<string, { lat: number; lng: number }>();
let duplicates = 0;
let skipped = 0;
for (const f of layer.features) {
  const a = f.attributes;
  if (!f.geometry || !Number.isFinite(a.ADDRESS_NUM)) { skipped++; continue; }
  const id = identityFromTown(a.GEOSTNAME ?? null, a.STREET_TYPE ?? null);
  if (!id.base) { skipped++; continue; }
  const k = rooftopKey(Math.round(a.ADDRESS_NUM as number), id);
  if (seen.has(k)) { duplicates++; continue; }
  seen.set(k, { lat: round6(f.geometry.y), lng: round6(f.geometry.x) });
}

const keys = [...seen.keys()].sort();
// Milton is one small bbox, so a fixed origin plus an integer offset at 1e-6 degrees (~11 cm)
// stores each coordinate in far fewer characters than a signed decimal, with no loss that a
// rooftop pin could notice.
const ORIGIN_LAT = 43;
const ORIGIN_LNG = -81;
const lines = keys.map((k) => {
  const p = seen.get(k)!;
  return `${k}|${Math.round((p.lat - ORIGIN_LAT) * 1e6)}|${Math.round((p.lng - ORIGIN_LNG) * 1e6)}`;
});

const pulled = new Date(fs.statSync(path.join(CACHE, "addressPoints.json")).mtime).toISOString().slice(0, 10);
const out = `// src/data/townAddressPoints.ts
// GENERATED — do not hand-edit. Re-run:
//   node scripts/town/fetch-layers.mjs && npx tsx scripts/town/gen-address-points.ts
//
// Source : Town of Milton Address Points (${LAYERS.addressPoints.url})
//          portal https://discover-milton.hub.arcgis.com/
// Pulled : ${pulled}
// Rows   : ${keys.length} rooftop coordinates from ${layer.features.length} address points
//          (${duplicates} units collapsed onto a shared rooftop, ${skipped} unusable)
//
// Contains information licensed under the Open Government Licence – Milton.
//
// INGEST-TIME ONLY. Nothing that renders a page imports this — it resolves a coordinate when a
// record is WRITTEN, and the resolved value is stored on the record. Absence is never evidence:
// an address the Town has no point for gets NULL, and NULL renders exactly as today.

const ORIGIN_LAT = ${ORIGIN_LAT};
const ORIGIN_LNG = ${ORIGIN_LNG};

/** "\${number}|\${base}||\${type}|\${latOffset}|\${lngOffset}", one per line. */
const PACKED = \`${lines.join("\\n")}\`;

let index: Map<string, { lat: number; lng: number }> | null = null;

/** Built on first lookup, not at module load. */
function getIndex(): Map<string, { lat: number; lng: number }> {
  if (index) return index;
  const m = new Map<string, { lat: number; lng: number }>();
  for (const line of PACKED.split("\\n")) {
    const cut = line.lastIndexOf("|");
    const cut2 = line.lastIndexOf("|", cut - 1);
    m.set(line.slice(0, cut2), {
      lat: ORIGIN_LAT + Number(line.slice(cut2 + 1, cut)) / 1e6,
      lng: ORIGIN_LNG + Number(line.slice(cut + 1)) / 1e6,
    });
  }
  index = m;
  return m;
}

/** Rooftop coordinate for a lookup key from \`rooftopKey()\`, or null. */
export function rooftopFor(key: string): { lat: number; lng: number } | null {
  return getIndex().get(key) ?? null;
}

export const TOWN_ADDRESS_POINT_COUNT = ${keys.length};
export const TOWN_ADDRESS_POINTS_PULLED = ${JSON.stringify(pulled)};
`;

const target = path.join(process.cwd(), "src/data/townAddressPoints.ts");
fs.writeFileSync(target, out);
console.log(`wrote ${target}`);
console.log(`  ${keys.length} rooftops · ${duplicates} shared · ${skipped} unusable · pulled ${pulled}`);
console.log(`  ${(out.length / 1024).toFixed(0)} KB`);

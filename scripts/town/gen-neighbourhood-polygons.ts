// Generates src/data/townNeighbourhoods.ts from the Town of Milton Neighbourhoods layer.
//
//   node scripts/town/fetch-layers.mjs && npx tsx scripts/town/gen-neighbourhood-polygons.ts
//
// Committed as a generated artifact for the same reason townRoadFacts.ts is: the .cache is not in
// the repo, so the reviewable thing — and the thing the battery reads without touching the
// network — has to be the generated file.
import fs from "node:fs";
import path from "node:path";
import { assertMilton, CACHE, LAYERS } from "./fetch-layers.mjs";

interface Feature { attributes: Record<string, unknown>; geometry?: { rings?: number[][][] } }
const src: { features: Feature[] } = JSON.parse(fs.readFileSync(path.join(CACHE, "neighbourhoods.json"), "utf8"));

// ASSERT THE REPROJECTION. outSR=4326 is a request, not a guarantee; a service that ignored it
// hands back UTM 17N metres (~600000, ~4800000), which are finite, non-zero, pass every null
// check, and are nowhere near Ontario.
assertMilton(src.features.flatMap((f) => (f.geometry?.rings ?? []).flat()), "Neighbourhoods geometry");

const round6 = (n: number) => Math.round(n * 1e6) / 1e6;

const polys = src.features
  .map((f) => ({
    name: String(f.attributes.NAME ?? "").trim(),
    rings: (f.geometry?.rings ?? []).map((r) => r.map((p) => [round6(p[0]), round6(p[1])])),
  }))
  .filter((p) => p.name && p.rings.length)
  .sort((a, b) => a.name.localeCompare(b.name));

if (!polys.length) throw new Error("no named polygons with geometry — check the parser, not the data");
const dupes = polys.map((p) => p.name).filter((n, i, a) => a.indexOf(n) !== i);
if (dupes.length) throw new Error(`duplicate polygon names: ${[...new Set(dupes)].join(", ")}`);

const vertices = polys.reduce((a, p) => a + p.rings.reduce((b, r) => b + r.length, 0), 0);
const pulled = new Date(fs.statSync(path.join(CACHE, "neighbourhoods.json")).mtime).toISOString().slice(0, 10);

const out = `// src/data/townNeighbourhoods.ts
// GENERATED — do not hand-edit. Re-run:
//   node scripts/town/fetch-layers.mjs && npx tsx scripts/town/gen-neighbourhood-polygons.ts
//
// Source : Town of Milton Neighbourhoods (${LAYERS.neighbourhoods.url})
//          portal https://discover-milton.hub.arcgis.com/
// Pulled : ${pulled}
// Rows   : ${polys.length} polygons, ${vertices} vertices, WGS84, reprojection asserted
//
// Contains information licensed under the Open Government Licence – Milton.
//
// A POSITION ORACLE, NOT A NAMING AUTHORITY. These names are the Town's and are finer-grained
// than TREB's: our \`old-milton\` alone fans out into Fallingbrook, Mountain View, Valley View and
// Forest Grove here, and 8 of our rural neighbourhoods have no polygon at all. Nothing may render
// a name from this file. Everything goes through src/data/townNeighbourhoodMap.ts.
//
// THE STALENESS RULE, as everywhere in this directory: a street outside every polygon is a street
// this layer has not caught up to, or a road the Town does not place in a neighbourhood. It is
// never grounds to withhold a page and never evidence that the street is unreal.
import type { TownPolygon } from "@/lib/town/polygons";

export const TOWN_NEIGHBOURHOODS_PULLED = "${pulled}";

export const TOWN_NEIGHBOURHOODS: readonly TownPolygon[] = ${JSON.stringify(polys)};
`;

const dest = path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "../../src/data/townNeighbourhoods.ts");
fs.writeFileSync(dest, out);
console.log(`${polys.length} polygons, ${vertices} vertices -> src/data/townNeighbourhoods.ts (${(out.length / 1024).toFixed(0)} KB)`);
console.log(polys.map((p) => p.name).join(", "));

// Generates src/data/townPlaces.ts — schools and parks, with the Town's own geometry.
//
//   npx tsx scripts/town/gen-places.ts
//
// WHY THIS IS IN THE COORDINATE PASS. Un-suppressing per-street distances computes them from an
// authoritative street centroid. Pointing that at a hand-guessed destination publishes a precise
// figure to an approximate place — the same defect in a new costume. src/lib/schools.ts says so
// in its own comment ("via neighbourhood centroid (approximate, ±300m)") for 18 of its schools,
// and geo.ts PARKS[] carries 9 hand-entered centroids. The Town publishes 36 school points and
// 93 park polygons.
//
// Contains information licensed under the Open Government Licence – Milton.
import fs from "node:fs";
import path from "node:path";
import { assertMilton } from "./fetch-layers.mjs";

const SRC = {
  schools: "https://api.milton.ca/arcgis/rest/services/Datasets/Schools/MapServer/0",
  parks: "https://api.milton.ca/arcgis/rest/services/Datasets/Parks/MapServer/0",
};

async function pull(url: string) {
  const r = await fetch(`${url}/query?where=1%3D1&outFields=*&returnGeometry=true&outSR=4326&f=json&resultRecordCount=9999`);
  const j = await r.json();
  if (j.error || !j.features?.length) throw new Error(`pull failed: ${url}`);
  return j.features as Array<{ attributes: Record<string, unknown>; geometry: Record<string, unknown> }>;
}

const round6 = (n: number) => Math.round(n * 1e6) / 1e6;

/** Area-weighted centroid of a polygon ring set — the park's middle, not its first vertex. */
function polygonCentroid(rings: number[][][]): { lat: number; lng: number } | null {
  let area2 = 0, cx = 0, cy = 0;
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const cross = ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
      area2 += cross;
      cx += (ring[j][0] + ring[i][0]) * cross;
      cy += (ring[j][1] + ring[i][1]) * cross;
    }
  }
  if (Math.abs(area2) < 1e-12) {
    const pts = rings.flat();
    if (!pts.length) return null;
    return { lat: round6(pts.reduce((s, p) => s + p[1], 0) / pts.length), lng: round6(pts.reduce((s, p) => s + p[0], 0) / pts.length) };
  }
  return { lat: round6(cy / (3 * area2)), lng: round6(cx / (3 * area2)) };
}

const titleCase = (s: string) =>
  s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase()).replace(/\s+/g, " ").trim();

async function main(): Promise<void> {
  const schoolFeatures = await pull(SRC.schools);
  const parkFeatures = await pull(SRC.parks);

  const schools = schoolFeatures
    .map((f) => {
      const g = f.geometry as { x: number; y: number };
      return {
        name: titleCase(String(f.attributes.NAME ?? "")),
        type: String(f.attributes.TYPE ?? ""),
        address: titleCase(String(f.attributes.ADDRESS ?? "")),
        lat: round6(g.y),
        lng: round6(g.x),
      };
    })
    .filter((s) => s.name && Number.isFinite(s.lat))
    .sort((a, b) => a.name.localeCompare(b.name));

  const parks = parkFeatures
    .map((f) => {
      const c = polygonCentroid((f.geometry as { rings: number[][][] }).rings ?? []);
      if (!c) return null;
      return {
        name: titleCase(String(f.attributes.NAME ?? "")),
        classification: String(f.attributes.CLASSIFICATION ?? ""),
        address: titleCase(String(f.attributes.ADDRESS ?? "")),
        ...c,
      };
    })
    .filter((p): p is NonNullable<typeof p> => !!p && !!p.name)
    .sort((a, b) => a.name.localeCompare(b.name));

  assertMilton([...schools, ...parks].map((p) => [p.lng, p.lat]), "places geometry");

  const pulled = new Date().toISOString().slice(0, 10);
  const out = `// src/data/townPlaces.ts
// GENERATED — do not hand-edit. Re-run: npx tsx scripts/town/gen-places.ts
//
// Source : Town of Milton Schools (${SRC.schools})
//          Town of Milton Parks   (${SRC.parks})
// Pulled : ${pulled}
// Rows   : ${schools.length} school points · ${parks.length} park polygons (area-weighted centroids)
//
// Contains information licensed under the Open Government Licence – Milton.
//
// These REPLACE hand-entered coordinates. A distance is only as good as both of its endpoints:
// computing one from an authoritative street centroid to a "±300m via neighbourhood centroid"
// school would publish a precise number to an approximate place.

export interface TownPlace {
  name: string;
  lat: number;
  lng: number;
  address: string;
}

export interface TownSchool extends TownPlace {
  /** PUBLIC SCHOOL | CATHOLIC SCHOOL | … as the Town classifies it */
  type: string;
}

export interface TownPark extends TownPlace {
  /** VILLAGE | NEIGHBOURHOOD | DISTRICT | … */
  classification: string;
}

export const TOWN_SCHOOLS: readonly TownSchool[] = [
${schools.map((s) => `  { name: ${JSON.stringify(s.name)}, type: ${JSON.stringify(s.type)}, address: ${JSON.stringify(s.address)}, lat: ${s.lat}, lng: ${s.lng} },`).join("\n")}
];

export const TOWN_PARKS: readonly TownPark[] = [
${parks.map((p) => `  { name: ${JSON.stringify(p.name)}, classification: ${JSON.stringify(p.classification)}, address: ${JSON.stringify(p.address)}, lat: ${p.lat}, lng: ${p.lng} },`).join("\n")}
];

export const TOWN_PLACES_PULLED = ${JSON.stringify(pulled)};
`;

  const target = path.join(process.cwd(), "src/data/townPlaces.ts");
  fs.writeFileSync(target, out);
  console.log(`wrote ${target}`);
  console.log(`  ${schools.length} schools · ${parks.length} parks · ${(out.length / 1024).toFixed(0)} KB`);

}

void main();

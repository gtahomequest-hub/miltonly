// scripts/town/gen-address-directions.ts
// GENERATES src/data/addressDirections.ts — the Town's own directional suffix, per civic address.
//
// WHY THIS EXISTS. The MLS-derived strings on CondoBuilding carry a direction that is not
// trustworthy: four Milton streets carry contradictory directions across their own buildings
// (Gordon Krantz Avenue appears as E, S and W at once), and "1050 Main St W" is stored for an
// address the Town records as MAIN STREET E. So the stored string cannot be the authority and
// neither can dropping every direction, because Main Street East and Main Street West are
// opposite ends of Milton. The Town's ST_DIR_SUFFIX is the authority. Recon in report 061.
//
// NOT FOLDED INTO townAddressPoints.ts. That module is a rooftop-coordinate projection keyed by
// (number, identity) and its key deliberately has no direction slot; widening it would change a
// 1.4 MB ingest-only table and the row-count assertion five other things depend on. 1,976 of
// 46,396 address points carry a direction, so the honest shape is a narrow module of its own.
//
// FETCHES ITS OWN SLICE rather than reading scripts/town/.cache. The filter is server-side and
// returns ~4% of the layer; pulling 46,396 points to keep 1,976 is the wrong trade, and the
// cache is not committed.
import fs from "node:fs";
import path from "node:path";
import { identityFromTown } from "../../src/lib/town/identity";

const URL = "https://api.milton.ca/arcgis/rest/services/Datasets/Address_Pts/MapServer/0/query";
const WHERE = "ST_DIR_SUFFIX IS NOT NULL AND ST_DIR_SUFFIX <> ''";
const PAGE = 1000;

interface Row {
  attributes: {
    ADDRESS_NUM: number | null;
    GEOSTNAME: string | null;
    STREET_TYPE: string | null;
    ST_DIR_SUFFIX: string | null;
  };
}

async function count(): Promise<number> {
  const u = `${URL}?where=${encodeURIComponent(WHERE)}&returnCountOnly=true&f=json`;
  const r = await fetch(u);
  if (!r.ok) throw new Error(`count failed: ${r.status}`);
  return (await r.json()).count as number;
}

async function page(offset: number): Promise<Row[]> {
  const u =
    `${URL}?where=${encodeURIComponent(WHERE)}` +
    `&outFields=ADDRESS_NUM,GEOSTNAME,STREET_TYPE,ST_DIR_SUFFIX` +
    `&returnGeometry=false&resultOffset=${offset}&resultRecordCount=${PAGE}&f=json`;
  const r = await fetch(u);
  if (!r.ok) throw new Error(`page ${offset} failed: ${r.status}`);
  const j = await r.json();
  if (j.error) throw new Error(`page ${offset}: ${JSON.stringify(j.error)}`);
  return (j.features ?? []) as Row[];
}

const VALID = new Set(["N", "E", "S", "W"]);

async function main() {
  const expected = await count();
  const rows: Row[] = [];
  for (let off = 0; off < expected; off += PAGE) {
    const got = await page(off);
    if (!got.length) break;
    rows.push(...got);
  }
  // A short read is a silent hole in the table, so it fails the generator instead of drifting.
  if (rows.length !== expected) {
    throw new Error(`fetched ${rows.length} of ${expected} directional address points — refusing to write a partial table`);
  }

  // One entry per (number, identity). A tower's units share a civic address, so the first wins;
  // a CONTRADICTION between two points at the same address is reported and dropped, because a
  // direction we cannot state confidently is one we must not render.
  const seen = new Map<string, string>();
  const contradictions = new Set<string>();
  let skipped = 0;
  for (const f of rows) {
    const a = f.attributes;
    const dir = String(a.ST_DIR_SUFFIX ?? "").trim().toUpperCase();
    if (!Number.isFinite(a.ADDRESS_NUM) || !VALID.has(dir)) { skipped++; continue; }
    const id = identityFromTown(a.GEOSTNAME ?? null, a.STREET_TYPE ?? null);
    if (!id.base) { skipped++; continue; }
    const k = `${Math.round(a.ADDRESS_NUM as number)}|${id.key}`;
    const prev = seen.get(k);
    if (prev && prev !== dir) contradictions.add(k);
    else if (!prev) seen.set(k, dir);
  }
  for (const k of contradictions) seen.delete(k);

  const keys = [...seen.keys()].sort();
  const lines = keys.map((k) => `${k}|${seen.get(k)}`);
  const streets = new Set(keys.map((k) => k.split("|").slice(1, -1).join("|") || k.split("|")[1]));

  const out = `// src/data/addressDirections.ts
// GENERATED — do not hand-edit. Re-run:
//   npx tsx scripts/town/gen-address-directions.ts
//
// Source : Town of Milton Address Points (${URL.replace("/query", "")}), field ST_DIR_SUFFIX
//          portal https://discover-milton.hub.arcgis.com/
// Pulled : ${new Date().toISOString().slice(0, 10)}
// Rows   : ${keys.length} directional civic addresses from ${rows.length} directional address points
//          (${skipped} unusable, ${contradictions.size} dropped for contradicting themselves)
//
// Contains information licensed under the Open Government Licence – Milton.
//
// THE AUTHORITY ON A DIRECTION. The MLS-derived strings disagree with the Town and with each
// other; this does not. ABSENCE IS NEVER EVIDENCE: an address with no row here has no direction
// to render, which is the same thing the page did before this module existed.

/** "\${number}|\${identityKey}|\${DIR}", one per line. */
const PACKED = \`${lines.join("\n")}\`;

export const ADDRESS_DIRECTION_COUNT = ${keys.length};
export const ADDRESS_DIRECTION_SOURCE_PULLED = "${new Date().toISOString().slice(0, 10)}";

export type Direction = "N" | "E" | "S" | "W";

let index: Map<string, Direction> | null = null;

/** Built on first lookup, not at module load. */
function getIndex(): Map<string, Direction> {
  if (index) return index;
  const m = new Map<string, Direction>();
  for (const line of PACKED.split("\\n")) {
    if (!line) continue;
    const cut = line.lastIndexOf("|");
    m.set(line.slice(0, cut), line.slice(cut + 1) as Direction);
  }
  index = m;
  return m;
}

/** The Town's directional suffix for one civic address, or null. */
export function directionForKey(number: number | string, identityKey: string): Direction | null {
  const n = typeof number === "number" ? number : parseInt(String(number), 10);
  if (!Number.isFinite(n)) return null;
  return getIndex().get(\`\${n}|\${identityKey}\`) ?? null;
}
`;

  const dest = path.join("src", "data", "addressDirections.ts");
  fs.writeFileSync(dest, out, "utf8");
  console.log(`wrote ${dest}`);
  console.log(`  directional address points fetched   ${rows.length} (expected ${expected})`);
  console.log(`  civic addresses written              ${keys.length}`);
  console.log(`  distinct street identities           ${streets.size}`);
  console.log(`  unusable                             ${skipped}`);
  console.log(`  dropped for contradicting themselves ${contradictions.size}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

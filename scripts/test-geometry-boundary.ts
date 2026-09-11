// Prebuild guard: geometry never enters the generator, and a unit figure never leaves it.
//
// QUEUE item 5 publishes a street's physical facts (length, lanes, posted limit, road class,
// surface, sidewalk, terminus, orientation) from the Town and OSM layers, in the sidebar, and
// nowhere else. The whole design rests on one boundary: THE MODEL NEVER SEES THOSE FIGURES. If
// it did, "620 m" could come back as "a short crescent of about 400 metres" and the validator
// would need a tolerance argument for every unit. It does not see them, so the validator can
// refuse every unit-bearing figure by construction. Three assertions hold that line:
//
//   1. StreetGeneratorInput (src/types/street-generator.ts) carries no geometry field.
//   2. Nothing under src/lib/ai imports src/data/streetGeometry or src/lib/town/geometry.
//   3. The validator's unit_figure rule fires on the figures it exists for and stays quiet on
//      the things that look like them (minutes, money, years, bedrooms, a road called 401).
//
// Comments are stripped before the source is read, so the history can be written about.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { findUnitFigures } from "@/lib/ai/validateStreetGeneration";

let assertions = 0;
const failures: string[] = [];
function ok(cond: boolean, label: string) { assertions++; if (!cond) failures.push(label); }

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(entry)) out.push(full);
  }
  return out;
}
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^[ \t]*\/\/.*$/gm, " ").replace(/[ \t]\/\/.*$/gm, " ");

// ── 1. the input type ─────────────────────────────────────────────────────────────────────────
const typeSrc = stripComments(readFileSync(join(process.cwd(), "src/types/street-generator.ts"), "utf8"));
const GEOMETRY_FIELDS = ["lengthM", "lanes", "speedLimit", "category", "surface", "sidewalk", "terminus", "axis", "orientation", "geometry", "bearing"];
for (const f of GEOMETRY_FIELDS) {
  ok(!new RegExp(`\\b${f}\\??\\s*:`).test(typeSrc), `StreetGeneratorInput must not declare a "${f}" field`);
}

// ── 2. the import boundary ────────────────────────────────────────────────────────────────────
const aiFiles = walk(join(process.cwd(), "src/lib/ai"));
ok(aiFiles.length >= 20, `walked ${aiFiles.length} files under src/lib/ai, which is not the tree`);
for (const file of aiFiles) {
  const code = stripComments(readFileSync(file, "utf8"));
  const rel = file.replace(process.cwd(), "").replace(/\\/g, "/");
  ok(!/streetGeometry|town\/geometry/.test(code), `${rel} must not import the geometry data or accessor`);
}

// ── 3. the rule ───────────────────────────────────────────────────────────────────────────────
const fires: string[] = [
  "a quiet 400-metre crescent",
  "a 40 km/h street",
  "two lanes each way",
  "about 620 m long",
  "roughly 1.2 km from the GO",
  "a four-lane collector",
  "at 60km/h",
];
const quiet: string[] = [
  "a 12-minute drive",
  "homes typically $1.2M",
  "about $3m in sales",
  "3 bedrooms and 2 baths",
  "built in 2004",
  "the 401 is close",
  "10 minutes to Milton GO",
  "1,800 sq ft",
  "I'm not sure",
];
for (const t of fires) ok(findUnitFigures(t).length >= 1, `unit_figure must fire on "${t}"`);
for (const t of quiet) ok(findUnitFigures(t).length === 0, `unit_figure must stay quiet on "${t}"`);

if (failures.length > 0) {
  console.error(`[geometry-boundary] FAIL: ${failures.length} of ${assertions} assertions:`);
  for (const f of failures) console.error(`  ${f}`);
  process.exit(1);
}
console.log(`[geometry-boundary] PASS: ${assertions} assertions; no geometry field on the input, no geometry import under src/lib/ai, unit_figure fires on ${fires.length} and is quiet on ${quiet.length}.`);

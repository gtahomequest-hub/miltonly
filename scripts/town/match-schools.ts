// Match our schools roster to the Town's 36 school points, and rewrite the coordinates in place.
//
//   npx tsx scripts/town/match-schools.ts --dry
//   npx tsx scripts/town/match-schools.ts --apply
//
// src/lib/schools.ts documents its own coordinates as "via neighbourhood centroid (approximate,
// ±300m)". Un-suppressing per-street distances would compute a precise figure from an
// authoritative street centreline to that approximation. Where the Town names the same school,
// its point replaces the guess; where it does not, the coordinate is REMOVED rather than left
// standing next to authoritative ones — callers already render distance as null when absent.
import fs from "node:fs";
import path from "node:path";
import { TOWN_SCHOOLS } from "../../src/data/townPlaces";
import { schools } from "../../src/lib/schools";

const APPLY = process.argv.includes("--apply");

/** School names differ by suffix vocabulary, not by identity: "Chris Hadfield PS" vs the Town's
 *  "CHRIS HADFIELD". Strip the board-suffix noise from both sides and compare what is left. */
const norm = (s: string) =>
  s.toLowerCase()
    .replace(/\b(ps|es|ss|hs|catholic|public|school|elementary|secondary|middle|separate|district|high|st|saint|milton)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");

function lev(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}

const RAD = Math.PI / 180;
const km = (aLat: number, aLng: number, bLat: number, bLng: number) => {
  const dLat = (bLat - aLat) * RAD, dLng = (bLng - aLng) * RAD;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * RAD) * Math.cos(bLat * RAD) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
};

const matched: Array<{ slug: string; name: string; town: string; lat: number; lng: number; movedKm: number | null }> = [];
const unmatched: Array<{ slug: string; name: string; hadCoords: boolean; nearest: string; d: number }> = [];

for (const s of schools) {
  const target = norm(s.name);
  let best: (typeof TOWN_SCHOOLS)[number] | null = null;
  let bestD = 99;
  for (const t of TOWN_SCHOOLS) {
    const d = lev(target, norm(t.name));
    if (d < bestD) { bestD = d; best = t; }
  }
  // Exact after normalisation, or one character out — anything looser is a guess dressed as data.
  if (best && bestD <= 1) {
    const moved = s.lat != null && s.lng != null ? km(s.lat, s.lng, best.lat, best.lng) : null;
    matched.push({ slug: s.slug, name: s.name, town: best.name, lat: best.lat, lng: best.lng, movedKm: moved });
  } else {
    unmatched.push({ slug: s.slug, name: s.name, hadCoords: s.lat != null, nearest: best?.name ?? "-", d: bestD });
  }
}

console.log(`roster ${schools.length} · Town points ${TOWN_SCHOOLS.length}`);
console.log(`\nMATCHED ${matched.length}`);
for (const m of matched.sort((a, b) => (b.movedKm ?? -1) - (a.movedKm ?? -1))) {
  console.log(`   ${m.name.padEnd(38)} -> ${m.town.padEnd(24)} ${m.movedKm === null ? "(had none)" : `moved ${(m.movedKm * 1000).toFixed(0)} m`}`);
}
console.log(`\nUNMATCHED ${unmatched.length} (Town has no point under this name)`);
for (const u of unmatched) {
  console.log(`   ${u.name.padEnd(38)} hadCoords=${u.hadCoords}  nearest "${u.nearest}" (d=${u.d})`);
}
const droppingCoords = unmatched.filter((u) => u.hadCoords);
console.log(`\nof the unmatched, ${droppingCoords.length} currently carry a hand-entered coordinate that will be REMOVED.`);

if (APPLY) {
  const file = path.join(process.cwd(), "src/lib/schools.ts");
  let src = fs.readFileSync(file, "utf8");
  const byslug = new Map(matched.map((m) => [m.slug, m]));
  const drop = new Set(droppingCoords.map((u) => u.slug));

  src = src.split("\n").map((line) => {
    const m = line.match(/slug: "([a-z0-9-]+)"/);
    if (!m) return line;
    const hit = byslug.get(m[1]);
    if (hit) {
      return /lat: /.test(line)
        ? line.replace(/lat: [-\d.]+, lng: [-\d.]+/, `lat: ${hit.lat}, lng: ${hit.lng}`)
        // \s* rather than a literal space: the roster is CRLF on disk, so `$` sat behind a \r
        // and the append silently matched nothing on the four schools that had no coordinate.
        : line.replace(/\s*\}(,?)\s*$/, `, lat: ${hit.lat}, lng: ${hit.lng} }$1`);
    }
    if (drop.has(m[1])) return line.replace(/, lat: [-\d.]+, lng: [-\d.]+/, "");
    return line;
  }).join("\n");

  fs.writeFileSync(file, src);
  console.log(`\napplied to ${file}`);
} else {
  console.log("\ndry run — pass --apply to rewrite src/lib/schools.ts");
}

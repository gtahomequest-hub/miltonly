// scripts/town/gen-street-addresses.ts
// GENERATOR for src/data/streetAddresses.ts — the render-time projection of the Town's
// address points, one small record per street identity.
//
// WHY A PROJECTION AND NOT A DIRECT IMPORT. src/data/townAddressPoints.ts declares itself
// "INGEST-TIME ONLY. Nothing that renders a page imports this" and carries 1.4 MB of rooftop
// coordinates. Gate A (scratchpad/reports/054) settled the sourcing: a street page needs the
// house numbers and their ORDER along the street, not the coordinates. So the coordinates are
// consumed here, at build time, and what ships to the renderer is a house number, a side, and a
// position fraction — no lat/lng per house, no reusable precision, no licence conversation about
// a machine-readable address-point export.
//
// Run:  npx tsx scripts/town/gen-street-addresses.ts
//
// Contains information licensed under the Open Government Licence – Milton.

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { TOWN_ADDRESS_POINT_COUNT, TOWN_ADDRESS_POINTS_PULLED } from "../../src/data/townAddressPoints";
import { TOWN_ROAD_FACTS } from "../../src/data/townRoadFacts";
import { MILTON_STREET_REGISTRY } from "../../src/data/miltonStreetRegistry";
import { identityFromSlug } from "../../src/lib/town/identity";

const SRC = resolve(process.cwd(), "src/data/townAddressPoints.ts");
const OUT = resolve(process.cwd(), "src/data/streetAddresses.ts");

/** A cross street whose nearest address point sits farther than this from ours is not a junction
 *  we can place. Absence is never evidence: no tick is drawn rather than a guessed one. */
const CROSS_MAX_M = 150;

interface Point {
  n: number;
  lat: number;
  lng: number;
}

// ── read the ingest table as text ────────────────────────────────────────────
// The module exports a point lookup only. Parsing its packed literal here keeps the
// "nothing that renders a page imports this" contract intact and is self-checking: the
// row count is asserted against the constant the same file exports.

function readPackedRows(): Point[] & { keys: string[] } {
  const src = readFileSync(SRC, "utf8");
  const m = src.match(/const PACKED = `([\s\S]*?)`;/);
  if (!m) throw new Error("gen-street-addresses: PACKED literal not found in townAddressPoints.ts");
  const lines = m[1].split("\\n");
  if (lines.length !== TOWN_ADDRESS_POINT_COUNT) {
    throw new Error(
      `gen-street-addresses: parsed ${lines.length} rows, module declares ${TOWN_ADDRESS_POINT_COUNT}`
    );
  }
  const points: Point[] = [];
  const keys: string[] = [];
  for (const line of lines) {
    const p = line.split("|");
    if (p.length !== 6) throw new Error(`gen-street-addresses: malformed row ${JSON.stringify(line)}`);
    const n = Number(p[0]);
    if (!Number.isFinite(n) || n <= 0) continue; // a 0 house number is not an address
    points.push({ n, lat: 43 + Number(p[4]) / 1e6, lng: -81 + Number(p[5]) / 1e6 });
    keys.push(`${p[1]}||${p[3]}`);
  }
  const out = points as Point[] & { keys: string[] };
  out.keys = keys;
  return out;
}

// ── geometry ────────────────────────────────────────────────────────────────

const R = 6371000;
const rad = (d: number) => (d * Math.PI) / 180;

/** Equirectangular metres. Over a single street the error against haversine is millimetres. */
function metres(a: Point, b: Point): number {
  const dx = rad(b.lng - a.lng) * Math.cos(rad((a.lat + b.lat) / 2)) * R;
  const dy = rad(b.lat - a.lat) * R;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Position along the street, 0 at the low-number end, expressed per side.
 *
 * House numbers run in one direction along a street, so walking a side in number order walks the
 * street. Doing it PER SIDE rather than over the merged list matters: consecutive numbers
 * alternate across the roadway, and a merged walk accumulates the road width on every step, which
 * on a short street inflates the total by more than the street is long.
 *
 * The two sides are then put on one scale by measuring each side's first point back to the
 * street's own low-number anchor, so a side that starts halfway along does not restart at zero.
 */
function fractionsFor(points: Point[]): Map<number, number> {
  const out = new Map<number, number>();
  if (points.length === 0) return out;
  if (points.length === 1) {
    out.set(points[0].n, 0);
    return out;
  }

  const sorted = [...points].sort((a, b) => a.n - b.n);
  const anchor = sorted[0];

  const walk = (side: Point[]): Array<{ n: number; d: number }> => {
    if (side.length === 0) return [];
    const rows: Array<{ n: number; d: number }> = [];
    let d = metres(anchor, side[0]); // the side's offset from the street's low end
    rows.push({ n: side[0].n, d });
    for (let i = 1; i < side.length; i++) {
      d += metres(side[i - 1], side[i]);
      rows.push({ n: side[i].n, d });
    }
    return rows;
  };

  const odd = walk(sorted.filter((p) => p.n % 2 === 1));
  const even = walk(sorted.filter((p) => p.n % 2 === 0));
  const all = [...odd, ...even];
  const total = all.reduce((mx, r) => Math.max(mx, r.d), 0);

  if (total <= 0) {
    // Every point resolves to one rooftop (a tower, or a street the Town has one point for).
    // Fall back to ordinal spacing — true order, no invented geometry.
    sorted.forEach((p, i) => out.set(p.n, Math.round((1000 * i) / Math.max(1, sorted.length - 1))));
    return out;
  }
  for (const r of all) out.set(r.n, Math.max(0, Math.min(1000, Math.round((1000 * r.d) / total))));
  return out;
}

// ── registry: identity key -> the slug we publish it under ──────────────────

const DIRECTIONAL = /-(north|south|east|west|northeast|northwest|southeast|southwest)-milton$/;

function buildSlugByKey(): Map<string, string> {
  const byKey = new Map<string, string>();
  for (const row of MILTON_STREET_REGISTRY) {
    const key = identityFromSlug(row.slug).key;
    const held = byKey.get(key);
    if (!held) {
      byKey.set(key, row.slug);
      continue;
    }
    // Directionals collapse onto one identity by design (a street page unions its siblings).
    // Prefer the undirected slug so the tick label reads as the street, not one half of it.
    if (DIRECTIONAL.test(held) && !DIRECTIONAL.test(row.slug)) byKey.set(key, row.slug);
  }
  return byKey;
}

// ── main ────────────────────────────────────────────────────────────────────

function main(): void {
  const rows = readPackedRows();
  const byKey = new Map<string, Point[]>();
  for (let i = 0; i < rows.length; i++) {
    const key = rows.keys[i];
    const list = byKey.get(key);
    if (list) list.push(rows[i]);
    else byKey.set(key, [rows[i]]);
  }

  // One address per (number, street). The ingest table already collapses units onto a shared
  // rooftop, but a street can still carry the same number twice across source segments.
  for (const [key, pts] of byKey) {
    const seen = new Set<number>();
    byKey.set(
      key,
      pts.filter((p) => (seen.has(p.n) ? false : (seen.add(p.n), true)))
    );
  }

  const slugByKey = buildSlugByKey();
  const fractionByKey = new Map<string, Map<number, number>>();
  for (const [key, pts] of byKey) fractionByKey.set(key, fractionsFor(pts));

  const lines: string[] = [];
  let crossTicks = 0;
  let addressCount = 0;

  for (const key of [...byKey.keys()].sort()) {
    const pts = byKey.get(key)!;
    const fr = fractionByKey.get(key)!;
    const ordered = [...pts].sort((a, b) => a.n - b.n);
    addressCount += ordered.length;
    const addrs = ordered.map((p) => `${p.n}:${fr.get(p.n) ?? 0}`).join(",");

    // Cross streets: the Town's own centreline adjacency, placed at the address on THIS street
    // that comes closest to an address on THAT one. A junction our address points do not reach
    // (an arterial whose houses face away, a street the Town has no points for) draws no tick.
    const facts = TOWN_ROAD_FACTS[key];
    const ticks: Array<{ slug: string; f: number }> = [];
    for (const otherKey of facts?.connects ?? []) {
      const slug = slugByKey.get(otherKey);
      if (!slug) continue;
      const others = byKey.get(otherKey);
      if (!others || others.length === 0) continue;
      let best = Infinity;
      let bestN = -1;
      for (const a of ordered) {
        for (const b of others) {
          const d = metres(a, b);
          if (d < best) {
            best = d;
            bestN = a.n;
          }
        }
      }
      if (bestN < 0 || best > CROSS_MAX_M) continue;
      ticks.push({ slug, f: fr.get(bestN) ?? 0 });
    }
    ticks.sort((a, b) => a.f - b.f || a.slug.localeCompare(b.slug));
    // One tick per slug — a crescent can meet the same street twice and two labels at the same
    // end read as two streets.
    const seenSlug = new Set<string>();
    const uniqueTicks = ticks.filter((t) => (seenSlug.has(t.slug) ? false : (seenSlug.add(t.slug), true)));
    crossTicks += uniqueTicks.length;

    lines.push(`${key}~${addrs}~${uniqueTicks.map((t) => `${t.slug}@${t.f}`).join(";")}`);
  }

  const header = `// src/data/streetAddresses.ts
// GENERATED — do not hand-edit. Re-run:
//   npx tsx scripts/town/gen-street-addresses.ts
//
// Source : projection of src/data/townAddressPoints.ts (Town of Milton Address Points, pulled
//          ${TOWN_ADDRESS_POINTS_PULLED}) and src/data/townRoadFacts.ts (Town of Milton Road Segments).
// Rows   : ${lines.length} street identities, ${addressCount} civic addresses, ${crossTicks} placed cross streets.
//
// Contains information licensed under the Open Government Licence – Milton.
//
// RENDER-TIME BY DESIGN, and the counterpart to townAddressPoints.ts's ingest-only contract. What
// ships here is a house number, its side (the parity of the number), and a position fraction in
// thousandths from the low-number end. NO COORDINATE PER HOUSE. The fraction answers "where on the
// street is it", which is the buyer's question; it is not a survey and cannot be re-projected into
// one.
//
// ABSENCE IS NEVER EVIDENCE. A street missing from here is a street the Town's 2023 address layer
// has not caught up to. The accessor returns null and the page renders exactly as it did before.

/** "\${key}~\${n}:\${fraction},…~\${crossSlug}@\${fraction};…", one street identity per line.
 *  Fields are ~-separated because the identity key itself contains "|" (\`base||type\`).
 *  key is \`\${base}||\${type}\` — see src/lib/town/identity.ts. fraction is 0–1000. */
const PACKED = \`${lines.join("\\n")}\`;

export interface TownStreetAddress {
  /** civic house number */
  n: number;
  /** position from the low-number end, 0–1 */
  fraction: number;
  side: "odd" | "even";
}

export interface TownStreetCross {
  /** the slug we publish that street under */
  slug: string;
  /** where it meets this street, 0–1 from the low-number end */
  fraction: number;
}

export interface TownStreetAddresses {
  addresses: readonly TownStreetAddress[];
  crossStreets: readonly TownStreetCross[];
}

let index: Map<string, TownStreetAddresses> | null = null;

/** Built on first lookup, not at module load. */
function getIndex(): Map<string, TownStreetAddresses> {
  if (index) return index;
  const m = new Map<string, TownStreetAddresses>();
  for (const line of PACKED.split("\\n")) {
    const [key, addrs, crosses] = line.split("~");
    const addresses: TownStreetAddress[] = [];
    for (const pair of addrs.split(",")) {
      if (!pair) continue;
      const cut = pair.indexOf(":");
      const n = Number(pair.slice(0, cut));
      addresses.push({ n, fraction: Number(pair.slice(cut + 1)) / 1000, side: n % 2 === 1 ? "odd" : "even" });
    }
    const crossStreets: TownStreetCross[] = [];
    for (const t of (crosses ?? "").split(";")) {
      if (!t) continue;
      const cut = t.lastIndexOf("@");
      crossStreets.push({ slug: t.slice(0, cut), fraction: Number(t.slice(cut + 1)) / 1000 });
    }
    m.set(key, { addresses, crossStreets });
  }
  index = m;
  return m;
}

/** Addresses and placed cross streets for a street identity key, or null. */
export function townAddressesForKey(key: string): TownStreetAddresses | null {
  return getIndex().get(key) ?? null;
}

export const STREET_ADDRESS_STREETS = ${lines.length};
export const STREET_ADDRESS_COUNT = ${addressCount};
export const STREET_ADDRESS_SOURCE_PULLED = "${TOWN_ADDRESS_POINTS_PULLED}";
`;

  writeFileSync(OUT, header, "utf8");

  const sizes = [...byKey.values()].map((v) => v.length).sort((a, b) => a - b);
  console.log(`streets      : ${lines.length}`);
  console.log(`addresses    : ${addressCount}`);
  console.log(`cross ticks  : ${crossTicks}`);
  console.log(`largest street: ${sizes[sizes.length - 1]} addresses`);
  console.log(`median street : ${sizes[Math.floor(sizes.length / 2)]} addresses`);
  for (const slug of ["mae-court-milton", "mcphail-way-milton", "pine-street-milton", "bell-school-line-milton"]) {
    const key = identityFromSlug(slug).key;
    const pts = byKey.get(key) ?? [];
    const nums = pts.map((p) => p.n).sort((a, b) => a - b);
    const t = (lines.find((l) => l.startsWith(`${key}~`)) ?? "").split("~")[2] ?? "";
    console.log(
      `${slug.padEnd(26)} ${String(pts.length).padStart(4)} addresses ${nums[0] ?? "-"}-${nums[nums.length - 1] ?? "-"}  crosses: ${t || "(none)"}`
    );
  }
  console.log(`wrote ${OUT}`);
}

main();

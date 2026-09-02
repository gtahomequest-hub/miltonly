// scripts/build-street-adjacency.ts
//
// Builds the StreetAdjacency table from OSM road geometry: two streets are adjacent iff a
// segment of one shares a NODE (identical vertex coordinate) with a segment of the other.
// Shared node only — never inferred from proximity or geometric crossing.
//
//   Source: D:/dashcam/work/milton-roads.geojson (LineString features, `properties.name`)
//   Target: published StreetContent slugs (the streets that actually have pages)
//
// Matching OSM way name -> existing slug reuses the RENDER layer's identity:
// deriveIdentity(streetNameToSlug(name)) collapses St/Street, N/North, Crt/Court and drops
// direction, so every abbreviation variant lands on the same base|suffix key the pages key
// on. A small numeric normalization (third<->3, 14th<->14) is added on top for the rural
// numbered roads, which deriveIdentity leaves in ordinal/word form.
//
// Adjacency is computed at the IDENTITY-KEY level (so a street's own directional siblings
// collapse and never self-link), then expanded to every published slug sharing that key.
// Both directions are stored. The table is rebuilt from scratch each run.
//
// Usage:
//   npx tsx scripts/build-street-adjacency.ts            # dry run — report only, no writes
//   npx tsx scripts/build-street-adjacency.ts --write    # rebuild the table

import { readFileSync } from "node:fs";
import { prisma } from "@/lib/prisma";
import { deriveIdentity, streetNameToSlug } from "@/lib/streetUtils";
import { resolveStreetName } from "../src/lib/streetName";

const GEOJSON = "D:/dashcam/work/milton-roads.geojson";

// Compact street-suffix expander for the LINK LABEL only. Mirrors expandStreetName in
// src/lib/street-data.ts (expands "Crt"->"Court", "St E"->"Street East", strips trailing
// "Milton", collapses a doubled suffix) — inlined here because street-data is `server-only`
// and cannot be imported from a bare tsx script. Faithful to the stored name's casing
// (McCuaig, MacDonald), which a slug-derived title-case would lose.
const SUFFIX_EXPAND: Record<string, string> = {
  ave: "Avenue", st: "Street", rd: "Road", dr: "Drive", crt: "Court", ct: "Court",
  cres: "Crescent", blvd: "Boulevard", ln: "Lane", pl: "Place", trl: "Trail", tr: "Trail",
  cir: "Circle", hts: "Heights", gt: "Gate", cmn: "Common", pk: "Park", pkwy: "Parkway",
  rdg: "Ridge", gr: "Grove", gv: "Grove", cl: "Close", wk: "Walk", hl: "Hill", ter: "Terrace",
  terr: "Terrace", vw: "View", e: "East", w: "West", n: "North", s: "South", ne: "Northeast",
  nw: "Northwest", se: "Southeast", sw: "Southwest",
};
function expandName(raw: string): string {
  const tokens = raw.trim().split(/\s+/).filter(Boolean);
  if (tokens.length > 1 && tokens[tokens.length - 1].toLowerCase() === "milton") tokens.pop();
  const expanded = tokens.map((t) => SUFFIX_EXPAND[t.toLowerCase().replace(/\.$/, "")] ?? t);
  const dedup: string[] = [];
  for (const t of expanded) {
    if (dedup.length && dedup[dedup.length - 1].toLowerCase() === t.toLowerCase()) continue;
    dedup.push(t);
  }
  return dedup.join(" ");
}
const COORD_PRECISION = 7; // ~1cm; OSM shared nodes are identical, this just tames float formatting

// Ordinal / spelled-number forms our slugs and OSM names disagree on (third-line vs 3-line,
// 14th-side-road vs 14-side-road). Mirrors town/identity's canonicalBase numeric handling.
const WORD_NUMBER: Record<string, string> = {
  first: "1", second: "2", third: "3", fourth: "4", fifth: "5", sixth: "6", seventh: "7",
  eighth: "8", ninth: "9", tenth: "10", eleventh: "11", twelfth: "12", fourteenth: "14",
  fifteenth: "15", sixteenth: "16", seventeenth: "17", twentieth: "20",
  one: "1", two: "2", three: "3", four: "4", five: "5", six: "6", seven: "7", eight: "8",
  nine: "9", ten: "10", eleven: "11", twelve: "12", fourteen: "14", fifteen: "15", sixteen: "16",
  seventeen: "17", twenty: "20",
};

function normBase(base: string): string {
  return base
    .split("-")
    .filter(Boolean)
    .map((t) => WORD_NUMBER[t] ?? t.replace(/^(\d+)(st|nd|rd|th)$/, "$1"))
    .join("-");
}

/** Identity key for a slug: `${normBase}|${suffix}`, or null if unparseable. */
function keyForSlug(slug: string): string | null {
  const id = deriveIdentity(slug);
  if (!id) return null;
  return `${normBase(id.base)}|${id.suffixCanonical}`;
}

/** Identity key for a raw OSM way name (routed through the same slug->identity path). */
function keyForName(name: string): string | null {
  const slug = streetNameToSlug(name);
  return keyForSlug(slug);
}

interface Feature {
  properties?: Record<string, unknown> | null;
  geometry?: { type: string; coordinates: unknown } | null;
}

/** Flatten a geometry's coordinates to [lng, lat] pairs (LineString / MultiLineString). */
function coordsOf(geom: Feature["geometry"]): Array<[number, number]> {
  if (!geom) return [];
  const out: Array<[number, number]> = [];
  const push = (pt: unknown) => {
    if (Array.isArray(pt) && typeof pt[0] === "number" && typeof pt[1] === "number") out.push([pt[0], pt[1]]);
  };
  if (geom.type === "LineString") for (const p of geom.coordinates as unknown[]) push(p);
  else if (geom.type === "MultiLineString") for (const line of geom.coordinates as unknown[][]) for (const p of line) push(p);
  return out;
}

async function main() {
  const write = process.argv.includes("--write");

  // ── Published streets (the link universe) ────────────────────────────────
  const published = await prisma.streetContent.findMany({
    where: { status: "published" },
    select: { streetSlug: true, streetName: true },
  });

  // key -> published slugs sharing it; key -> representative {slug,name} (canonical link target)
  const publishedByKey = new Map<string, string[]>();
  const repByKey = new Map<string, { slug: string; name: string }>();
  const keyBySlug = new Map<string, string | null>();
  for (const s of published) {
    const key = keyForSlug(s.streetSlug);
    keyBySlug.set(s.streetSlug, key);
    if (!key) continue;
    const list = publishedByKey.get(key) ?? [];
    list.push(s.streetSlug);
    publishedByKey.set(key, list);
    // Representative: prefer the deriveIdentity canonical slug when it's a published slug,
    // else the lexicographically first — deterministic either way.
    const canonical = deriveIdentity(s.streetSlug)?.canonicalSlug;
    const name = resolveStreetName(s.streetSlug, s.streetName ?? null).name;
    const cur = repByKey.get(key);
    if (!cur || s.streetSlug === canonical || (cur.slug !== deriveIdentity(cur.slug)?.canonicalSlug && s.streetSlug < cur.slug)) {
      repByKey.set(key, { slug: s.streetSlug, name });
    }
  }

  // ── Parse OSM, collect keys + node membership ────────────────────────────
  const gj = JSON.parse(readFileSync(GEOJSON, "utf8")) as { features: Feature[] };
  const osmKeys = new Set<string>(); // every identity key OSM knows a name for
  const nodeKeys = new Map<string, Set<string>>(); // coordKey -> set of PUBLISHED identity keys present
  let namedFeatures = 0;

  for (const f of gj.features) {
    const name = (f.properties?.name ?? "") as string;
    if (!name) continue;
    namedFeatures++;
    const key = keyForName(name);
    if (!key) continue;
    osmKeys.add(key);
    if (!publishedByKey.has(key)) continue; // only streets with a page can be a link endpoint
    for (const [lng, lat] of coordsOf(f.geometry)) {
      const ck = `${lng.toFixed(COORD_PRECISION)},${lat.toFixed(COORD_PRECISION)}`;
      const set = nodeKeys.get(ck) ?? new Set<string>();
      set.add(key);
      nodeKeys.set(ck, set);
    }
  }

  // ── Adjacency at identity-key level (symmetric) ──────────────────────────
  const adj = new Map<string, Set<string>>();
  const link = (a: string, b: string) => {
    if (a === b) return;
    (adj.get(a) ?? adj.set(a, new Set()).get(a)!).add(b);
  };
  for (const keys of nodeKeys.values()) {
    if (keys.size < 2) continue;
    const arr = [...keys];
    for (let i = 0; i < arr.length; i++)
      for (let j = i + 1; j < arr.length; j++) {
        link(arr[i], arr[j]);
        link(arr[j], arr[i]);
      }
  }

  // ── Expand to rows: every published slug of a key gets that key's neighbours ──
  interface Row { streetSlug: string; connectedSlug: string; connectedName: string }
  const rows: Row[] = [];
  for (const [key, neighbourKeys] of adj) {
    const slugs = publishedByKey.get(key) ?? [];
    const neighbours = [...neighbourKeys]
      .map((nk) => repByKey.get(nk))
      .filter((r): r is { slug: string; name: string } => !!r)
      .sort((a, b) => a.name.localeCompare(b.name));
    for (const slug of slugs)
      for (const n of neighbours) {
        if (n.slug === slug) continue;
        rows.push({ streetSlug: slug, connectedSlug: n.slug, connectedName: n.name });
      }
  }

  // ── Report ───────────────────────────────────────────────────────────────
  const matched = published.filter((s) => {
    const k = keyBySlug.get(s.streetSlug);
    return k && osmKeys.has(k);
  });
  const unmatched = published.filter((s) => {
    const k = keyBySlug.get(s.streetSlug);
    return !k || !osmKeys.has(k);
  });
  const degByKey = new Map<string, number>();
  for (const [k, n] of adj) degByKey.set(k, n.size);
  const publishedWithAdj = published.filter((s) => {
    const k = keyBySlug.get(s.streetSlug);
    return k && (degByKey.get(k) ?? 0) > 0;
  });
  const degrees = publishedWithAdj.map((s) => degByKey.get(keyBySlug.get(s.streetSlug)!)!);
  const avgWithAdj = degrees.length ? degrees.reduce((a, b) => a + b, 0) / degrees.length : 0;
  const avgAll = published.length
    ? published.reduce((sum, s) => sum + (degByKey.get(keyBySlug.get(s.streetSlug) ?? "") ?? 0), 0) / published.length
    : 0;

  console.log("═══ Street adjacency build ═══");
  console.log(`OSM named features: ${namedFeatures}   distinct OSM identities: ${osmKeys.size}`);
  console.log(`Published street records: ${published.length}`);
  console.log(`  matched an OSM way:   ${matched.length}  (${((matched.length / published.length) * 100).toFixed(1)}%)`);
  console.log(`  did NOT match:        ${unmatched.length}`);
  console.log(`Streets with >=1 connection: ${publishedWithAdj.length}`);
  console.log(`Avg adjacency (streets in graph): ${avgWithAdj.toFixed(2)}`);
  console.log(`Avg adjacency (all published):    ${avgAll.toFixed(2)}`);
  console.log(`Directed edge rows: ${rows.length}`);
  // Categorize the misses. `unparseable` = deriveIdentity returned null; `no-street-type`
  // = key has an empty suffix (unusual type like "Cross", or a slug carrying a neighbourhood
  // token e.g. fifth-line-nassagaweya, so the identity can't line up with the OSM name);
  // `absent-in-osm` = a clean identity that simply isn't in this OSM extract (new subdivision
  // or OSM gap).
  const reason = (slug: string): string => {
    const k = keyBySlug.get(slug);
    if (!k) return "unparseable";
    if (k.endsWith("|")) return "no-street-type";
    return "absent-in-osm";
  };
  const byReason = new Map<string, string[]>();
  for (const s of unmatched) (byReason.get(reason(s.streetSlug)) ?? byReason.set(reason(s.streetSlug), []).get(reason(s.streetSlug))!).push(s.streetSlug);
  console.log(`\nUnmatched by reason:`);
  for (const [r, slugs] of byReason) console.log(`  ${r}: ${slugs.length}`);
  console.log(`\nAll unmatched (slug — derived identity key — reason):`);
  for (const s of unmatched) console.log(`  ${s.streetSlug}  —  ${keyBySlug.get(s.streetSlug) ?? "<unparseable>"}  —  ${reason(s.streetSlug)}`);

  if (!write) {
    console.log(`\n(dry run — pass --write to rebuild the table)`);
    await prisma.$disconnect();
    return;
  }

  // ── Write: truncate + insert ─────────────────────────────────────────────
  await prisma.$transaction([
    prisma.streetAdjacency.deleteMany({}),
    ...chunk(rows, 1000).map((batch) => prisma.streetAdjacency.createMany({ data: batch, skipDuplicates: true })),
  ]);
  const count = await prisma.streetAdjacency.count();
  console.log(`\nWrote ${count} adjacency rows.`);
  await prisma.$disconnect();
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});

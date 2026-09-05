// scripts/match-clip-to-street.ts
//
// Which registry street does a dashcam clip actually depict?
//
// Three clips were staged under slugs that are not in the Town registry and have no
// ResidentialStreet entity, so their R2 objects sit at keys no page can ever reference:
// 1st-line, bronte-street-south, lower-base-line-west. The slug is a label a human typed;
// the GPS trace is evidence. This measures the trace against the Town's own layers rather
// than guessing from the name.
//
// METHOD, and its honest limits.
//   Milton's road layer in this repo (src/data/townRoadFacts.ts) stores a length-weighted
//   CENTROID per street, not a polyline, so a true line-on-line overlap is not computable
//   from it. What IS available is src/data/townAddressPoints.ts: 40,827 municipal rooftop
//   points keyed by street identity. A street's address points trace its frontage, so the
//   measure used here is:
//
//     for each consecutive pair of GPS fixes, attribute the segment's length to the street
//     whose nearest address point is closest, when that distance is within CORRIDOR_M.
//
//   Summed per street that is "metres of trace within the corridor", which is an overlap in
//   the sense that matters: how far the camera drove alongside that street's frontage.
//
//   RURAL LINES HAVE ALMOST NO ADDRESS POINTS. A concession road with six farms cannot be
//   matched this way, so the centroid distance from townRoadFacts is reported alongside and
//   the two are read together. Where they disagree the report says so rather than picking.
//
// Contains information licensed under the Open Government Licence – Milton.
//
// Usage:
//   npx tsx --tsconfig tsconfig.test.json scripts/match-clip-to-street.ts <slug> [slug ...]

import { readFileSync, existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { MILTON_STREET_REGISTRY } from "../src/data/miltonStreetRegistry";
import { TOWN_ROAD_FACTS } from "../src/data/townRoadFacts";
import { identityFromSlug } from "../src/lib/town/identity";

const GPS_CACHE = "D:/dashcam/raw/.gpscache";
const PUBLISHED = "D:/dashcam/published";
const CORRIDOR_M = 45;

interface Fix { lat: number; lng: number; t: string; speed: number }

function haversineM(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371000;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const la1 = (aLat * Math.PI) / 180;
  const la2 = (bLat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** The packed address-point table, re-parsed here rather than imported: the module exports only a
 *  single-key lookup, and this needs the whole cloud grouped by street identity. */
function addressPointsByIdentity(): Map<string, Array<[number, number]>> {
  const src = readFileSync(path.join(__dirname, "..", "src", "data", "townAddressPoints.ts"), "utf8");
  const originLat = Number(src.match(/const ORIGIN_LAT = (-?\d+)/)?.[1] ?? 43);
  const originLng = Number(src.match(/const ORIGIN_LNG = (-?\d+)/)?.[1] ?? -81);
  const packed = src.match(/const PACKED = `([\s\S]*?)`;/)?.[1];
  if (!packed) throw new Error("could not parse PACKED from townAddressPoints.ts");
  const out = new Map<string, Array<[number, number]>>();
  for (const line of packed.split("\\n")) {
    if (!line) continue;
    const parts = line.split("|");
    if (parts.length < 6) continue;
    const [, base, dir, type, latOff, lngOff] = parts;
    const key = `${base}|${dir}|${type}`;
    const lat = originLat + Number(latOff) / 1e6;
    const lng = originLng + Number(lngOff) / 1e6;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    let arr = out.get(key);
    if (!arr) { arr = []; out.set(key, arr); }
    arr.push([lat, lng]);
  }
  return out;
}

function readTrace(sourceRaw: string): Fix[] {
  const file = readdirSync(GPS_CACHE).find((f) => f.startsWith(sourceRaw + "_"));
  if (!file) throw new Error(`no .gpscache entry for ${sourceRaw}`);
  const out: Fix[] = [];
  for (const line of readFileSync(path.join(GPS_CACHE, file), "utf8").split(/\r?\n/)) {
    if (!line.trim()) continue;
    const [t, lat, lng, speed] = line.split(",");
    const la = Number(lat);
    const ln = Number(lng);
    if (!Number.isFinite(la) || !Number.isFinite(ln)) continue;
    out.push({ t, lat: la, lng: ln, speed: Number(speed) || 0 });
  }
  return out;
}

/** identity key as townRoadFacts / townAddressPoints spell it, for a registry slug. */
function keyForSlug(slug: string): string {
  return identityFromSlug(slug).key;
}

function main() {
  const slugs = process.argv.slice(2);
  if (slugs.length === 0) throw new Error("usage: match-clip-to-street <staged-slug> [...]");

  const points = addressPointsByIdentity();
  // Registry streets that actually have address points, with their clouds.
  const candidates: Array<{ slug: string; name: string; key: string; pts: Array<[number, number]> }> = [];
  for (const reg of MILTON_STREET_REGISTRY) {
    const key = keyForSlug(reg.slug);
    const pts = points.get(key);
    if (pts && pts.length > 0) candidates.push({ slug: reg.slug, name: reg.name, key, pts });
  }
  console.log(`registry streets with address points: ${candidates.length} of ${MILTON_STREET_REGISTRY.length}`);
  console.log(`corridor ${CORRIDOR_M} m\n`);

  for (const slug of slugs) {
    const metaPath = path.join(PUBLISHED, slug, "meta.json");
    if (!existsSync(metaPath)) { console.log(`${slug}: no published meta.json`); continue; }
    const meta = JSON.parse(readFileSync(metaPath, "utf8")) as Record<string, unknown>;
    const trace = readTrace(String(meta.source_raw));

    // Bounding box of the trace, generously padded, to cut the candidate set before the O(n*m).
    const lats = trace.map((f) => f.lat);
    const lngs = trace.map((f) => f.lng);
    const pad = 0.01;
    const box = { minLat: Math.min(...lats) - pad, maxLat: Math.max(...lats) + pad, minLng: Math.min(...lngs) - pad, maxLng: Math.max(...lngs) + pad };
    const near = candidates
      .map((c) => ({ ...c, pts: c.pts.filter((p) => p[0] >= box.minLat && p[0] <= box.maxLat && p[1] >= box.minLng && p[1] <= box.maxLng) }))
      .filter((c) => c.pts.length > 0);

    const metres = new Map<string, number>();
    let traceLen = 0;
    let attributed = 0;
    for (let i = 1; i < trace.length; i++) {
      const a = trace[i - 1];
      const b = trace[i];
      const segLen = haversineM(a.lat, a.lng, b.lat, b.lng);
      if (segLen === 0 || segLen > 200) continue; // 200 m between fixes is a dropout, not a drive
      traceLen += segLen;
      const mid = { lat: (a.lat + b.lat) / 2, lng: (a.lng + b.lng) / 2 };
      let best: { slug: string; d: number } | null = null;
      for (const c of near) {
        for (const p of c.pts) {
          const d = haversineM(mid.lat, mid.lng, p[0], p[1]);
          if (best === null || d < best.d) best = { slug: c.slug, d };
        }
      }
      if (best && best.d <= CORRIDOR_M) {
        metres.set(best.slug, (metres.get(best.slug) ?? 0) + segLen);
        attributed += segLen;
      }
    }

    const ranked = [...metres.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
    console.log(`=== ${slug} ===`);
    console.log(`  source_raw ${meta.source_raw}  fixes ${trace.length}  trace ${traceLen.toFixed(0)} m  attributed ${attributed.toFixed(0)} m (${((attributed / traceLen) * 100).toFixed(0)}%)`);
    if (ranked.length === 0) console.log("  no registry street within the corridor at any point");
    for (const [s, m] of ranked) {
      const facts = TOWN_ROAD_FACTS[keyForSlug(s)];
      const centroidD = facts ? haversineM(trace[Math.floor(trace.length / 2)].lat, trace[Math.floor(trace.length / 2)].lng, facts.lat, facts.lng) : null;
      console.log(`  ${s.padEnd(34)} ${m.toFixed(0).padStart(6)} m overlap  (${((m / traceLen) * 100).toFixed(0)}% of trace)` +
        (centroidD === null ? "  no road-facts row" : `  centroid ${centroidD.toFixed(0)} m from trace midpoint`));
    }
    console.log("");
  }
}

main();

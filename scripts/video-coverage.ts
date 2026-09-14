// scripts/video-coverage.ts
//
// MC-015. For every clip-carrying StreetContent row: WHEN it was filmed and WHAT it covers,
// measured from the clip's own GPS trace against the Town road layer, written into
// D:/dashcam/published/<slug>/meta.json for the sidecar and the backfill to read.
//
// WHY THE TRACE AND NOT meta.captured_at. The 40 clips published before 2026-09-11 carry a
// captured_at taken from the raw file's name, and the camera's filename clock runs one hour
// fast: raw 2026_0901_193438 opens at GPS 22:34:41Z, which is 18:34 in Milton, not 19:34. The
// seven staged since carry the GPS time already (captured_at_source says so). The GPS row is
// the only clock that was ever right, so every clip's captured_at is rewritten from it here,
// the filename value kept beside it as captured_at_filename, and the three clips whose "night"
// rested on the fast clock are named in the output for a decision (measured luma says day).
//
// WHAT "COVERS" MEANS. The trace rows inside the clip's window (source_window_s when the
// staging pass recorded one; otherwise the longest run of rows snapped to the street) are
// projected onto the street's Town centreline segments (identityFromSlug == identityFromTown,
// the same join gen-street-geometry.ts makes). capturedMetres is the length of that projected
// path; streetMetres is STREET_GEOMETRY's lengthM. The endpoints are the OTHER streets whose
// Town segment meets the street within CROSS_M of the first and last projected point, named
// through resolveStreetName (the registry) or left null. A court that starts and ends at the
// same cross street gets one endpoint, not "from A to A". Nothing is filled in.
//
// Usage:
//   npx tsx --tsconfig tsconfig.test.json scripts/video-coverage.ts            # dry run
//   npx tsx --tsconfig tsconfig.test.json scripts/video-coverage.ts --write
//   ... --only=anne-boulevard,frost-court

import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { neon } from "@neondatabase/serverless";
import { identityFromSlug, identityFromTown } from "../src/lib/town/identity";
import { STREET_GEOMETRY } from "../src/data/streetGeometry";
import { MILTON_STREET_REGISTRY } from "../src/data/miltonStreetRegistry";
import { resolveStreetName } from "../src/lib/streetName";

const __dirname = dirname(fileURLToPath(import.meta.url));
function loadEnvLocal() {
  const content = readFileSync(resolve(__dirname, "..", ".env.local"), "utf8");
  for (const line of content.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
    if (process.env[k] === undefined) process.env[k] = v;
  }
}
loadEnvLocal();

const PUBLISHED = "D:/dashcam/published";
const GPSCACHE = "D:/dashcam/raw/.gpscache";
const ROADS = resolve(__dirname, "town", ".cache", "roads.json");
const SLUG_SUFFIX = "-milton";
const ZONE = "America/Toronto";
const SNAP_M = 30;      // a trace row this close to the street's centreline is on the street
const CROSS_M = 40;     // a cross street's node this close to the run's end names the endpoint
const MIN_RUN = 8;      // rows; shorter is not a pass
const GAP_ROWS = 2;     // a run survives this many unsnapped rows
const WRITE = process.argv.includes("--write");
const onlyArg = process.argv.find((a) => a.startsWith("--only="));
const ONLY = onlyArg ? new Set(onlyArg.slice(7).split(",").map((s) => s.trim()).filter(Boolean)) : null;
const { DATABASE_URL = "" } = process.env;
if (!DATABASE_URL) { console.error("Missing DATABASE_URL in .env.local"); process.exit(1); }
const db = neon(DATABASE_URL);

interface Row { streetSlug: string; videoUrl: string | null; nightVideoUrl: string | null }
interface Meta {
  captured_at: string;
  captured_end?: string;
  captured_at_source?: string;
  captured_at_filename?: string;
  source_raw: string;
  source_window_s?: [number, number];
  night: boolean;
  drive_s?: number;
  local_hour?: number;
  coverageFrom?: string | null;
  coverageTo?: string | null;
  capturedMetres?: number | null;
  streetMetres?: number | null;
  coverage_source?: string;
  [k: string]: unknown;
}
interface RoadFeature { attributes: Record<string, unknown>; geometry?: { paths?: number[][][] } }
interface Pt { t: Date; lon: number; lat: number; speed: number }

// ── the Town layer, once ─────────────────────────────────────────────────────────────────────
const roads = JSON.parse(readFileSync(ROADS, "utf8")) as { features: RoadFeature[] };
const segsByKey = new Map<string, number[][][]>();           // identity key -> polylines [lon,lat]
const nodesByKey = new Map<string, number[][]>();            // identity key -> path endpoints
for (const f of roads.features) {
  const id = identityFromTown(f.attributes.GEOSTNAME as string, f.attributes.SUFSTTYPE as string);
  if (!id.base) continue;
  for (const p of f.geometry?.paths ?? []) {
    if (p.length < 2) continue;
    if (!segsByKey.has(id.key)) segsByKey.set(id.key, []);
    segsByKey.get(id.key)!.push(p);
    if (!nodesByKey.has(id.key)) nodesByKey.set(id.key, []);
    nodesByKey.get(id.key)!.push(p[0], p[p.length - 1]);
  }
}
// identity key -> registry slug, so a cross street is named the way every surface names it
const slugByKey = new Map<string, string>();
for (const r of MILTON_STREET_REGISTRY) slugByKey.set(identityFromSlug(r.slug).key, r.slug);

// ── geometry in metres, a local equirectangular frame per clip ───────────────────────────────
function frame(lat0: number) {
  const kx = 111_320 * Math.cos((lat0 * Math.PI) / 180);
  const ky = 110_540;
  return (lon: number, lat: number): [number, number] => [lon * kx, lat * ky];
}
function projectOnSegment(p: [number, number], a: [number, number], b: [number, number]): { d: number; q: [number, number] } {
  const vx = b[0] - a[0], vy = b[1] - a[1];
  const len2 = vx * vx + vy * vy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * vx + (p[1] - a[1]) * vy) / len2));
  const q: [number, number] = [a[0] + t * vx, a[1] + t * vy];
  return { d: Math.hypot(p[0] - q[0], p[1] - q[1]), q };
}
function nearestOnStreet(p: [number, number], lines: [number, number][][]): { d: number; q: [number, number] } {
  let best = { d: Infinity, q: p };
  for (const line of lines) for (let i = 1; i < line.length; i++) {
    const r = projectOnSegment(p, line[i - 1], line[i]);
    if (r.d < best.d) best = r;
  }
  return best;
}

// ── the trace ────────────────────────────────────────────────────────────────────────────────
function traceFor(sourceRaw: string): Pt[] | null {
  const file = readdirSync(GPSCACHE).find((f) => f.startsWith(sourceRaw + "_") && f.endsWith(".csv"));
  if (!file) return null;
  const rows: Pt[] = [];
  for (const line of readFileSync(path.join(GPSCACHE, file), "utf8").split(/\r?\n/)) {
    const [ts, lat, lon, spd] = line.split(",");
    if (!ts || !lat || !lon) continue;
    // "2026:09:07 15:20:17Z"
    const m = ts.match(/^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})Z$/);
    if (!m) continue;
    const t = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]));
    const la = Number(lat), lo = Number(lon);
    if (!Number.isFinite(la) || !Number.isFinite(lo)) continue;
    rows.push({ t, lat: la, lon: lo, speed: Number(spd) || 0 });
  }
  return rows;
}

/** ISO with the zone's offset, "2026-09-07T11:20:17-04:00". */
function isoInZone(d: Date): { iso: string; hour: number; date: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONE, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", timeZoneName: "longOffset",
  }).formatToParts(d);
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const off = (g("timeZoneName").match(/GMT([+-]\d{2}:\d{2})/) || [, "+00:00"])[1];
  return { iso: `${g("year")}-${g("month")}-${g("day")}T${g("hour")}:${g("minute")}:${g("second")}${off}`, hour: Number(g("hour")), date: `${g("year")}-${g("month")}-${g("day")}` };
}

function crossStreetNear(q: [number, number], selfKey: string, toXY: (lon: number, lat: number) => [number, number]): string | null {
  let best: { d: number; key: string } | null = null;
  for (const [key, nodes] of nodesByKey) {
    if (key === selfKey) continue;
    for (const n of nodes) {
      const xy = toXY(n[0], n[1]);
      const d = Math.hypot(xy[0] - q[0], xy[1] - q[1]);
      if (d <= CROSS_M && (!best || d < best.d)) best = { d, key };
    }
  }
  if (!best) return null;
  const slug = slugByKey.get(best.key);
  return slug ? resolveStreetName(slug).name : null;   // not in the registry: not a name any surface prints
}

async function main() {
  console.log(`${WRITE ? "WRITE" : "DRY RUN"}\n`);
  const rows = (await db`
    SELECT "streetSlug", "videoUrl", "nightVideoUrl" FROM public."StreetContent"
    WHERE "videoUrl" IS NOT NULL OR "nightVideoUrl" IS NOT NULL ORDER BY "streetSlug"`) as Row[];

  const problems: string[] = [];
  const nightByFastClock: string[] = [];
  let written = 0, withEnds = 0, withOne = 0, withMetres = 0, timeMoved = 0;

  for (const r of rows) {
    const slug = r.streetSlug.endsWith(SLUG_SUFFIX) ? r.streetSlug.slice(0, -SLUG_SUFFIX.length) : r.streetSlug;
    if (ONLY && !ONLY.has(slug)) continue;
    const metaPath = path.join(PUBLISHED, slug, "meta.json");
    if (!existsSync(metaPath)) { problems.push(`${slug}: no meta.json`); continue; }
    const meta = JSON.parse(readFileSync(metaPath, "utf8")) as Meta;
    const key = identityFromSlug(r.streetSlug).key;
    const lines = segsByKey.get(key);
    if (!lines) { problems.push(`${slug}: no Town segments for identity ${key}`); continue; }
    const trace = traceFor(meta.source_raw);
    if (!trace || trace.length < MIN_RUN) { problems.push(`${slug}: no GPS trace for ${meta.source_raw}`); continue; }

    const toXY = frame(trace[0].lat);
    const xyLines = lines.map((l) => l.map(([lon, lat]) => toXY(lon, lat)));
    const snapped = trace.map((p) => ({ p, near: nearestOnStreet(toXY(p.lon, p.lat), xyLines) }));

    // the window: recorded, else the longest run on the street
    let run: number[] = [];
    if (meta.source_window_s) {
      const t0 = trace[0].t.getTime();
      const [a, b] = meta.source_window_s;
      run = snapped.map((s, i) => ({ s, i })).filter(({ s }) => {
        const sec = (s.p.t.getTime() - t0) / 1000;
        return sec >= a && sec <= b && s.near.d <= SNAP_M;
      }).map(({ i }) => i);
    } else {
      let cur: number[] = [], gap = 0;
      for (let i = 0; i < snapped.length; i++) {
        if (snapped[i].near.d <= SNAP_M) { cur.push(i); gap = 0; }
        else if (cur.length && ++gap > GAP_ROWS) { if (cur.length > run.length) run = cur; cur = []; gap = 0; }
      }
      if (cur.length > run.length) run = cur;
    }
    if (run.length < MIN_RUN) {
      // The street is not where the Town layer says it is, or not in the layer at all (Britannia
      // Road west of Bronte is the Region's). No extent can be measured, so none is written; the
      // clock is still corrected, from the raw file's first GPS row, which is within the file's
      // sixty seconds of the clip and an hour closer than the filename.
      const start = isoInZone(trace[0].t);
      problems.push(`${slug}: ${run.length} rows on the street in ${meta.source_raw}; no extent; captured_at from the file's first GPS row ${start.iso}`);
      if (meta.night && start.hour < 20) nightByFastClock.push(`${slug}: night in meta, filmed about ${start.iso}`);
      if (WRITE) {
        if (meta.captured_at !== start.iso && !meta.captured_at_filename) meta.captured_at_filename = meta.captured_at;
        meta.captured_at = start.iso;
        meta.captured_at_source = "GPS timestamp of the raw file's first row (scripts/video-coverage.ts); the street did not match the Town layer, so the row on the street is unknown";
        meta.local_hour = Math.round((start.hour + Number(start.iso.slice(14, 16)) / 60) * 100) / 100;
        meta.coverageFrom = null; meta.coverageTo = null; meta.capturedMetres = null; meta.streetMetres = null;
        meta.coverage_source = "no extent: the trace did not match the Town layer for this identity";
        writeFileSync(metaPath, JSON.stringify(meta, null, 2) + "\n", "utf8");
        written++;
      }
      continue;
    }

    const first = snapped[run[0]], last = snapped[run[run.length - 1]];
    let metres = 0;
    for (let k = 1; k < run.length; k++) {
      const a = snapped[run[k - 1]].near.q, b = snapped[run[k]].near.q;
      metres += Math.hypot(a[0] - b[0], a[1] - b[1]);
    }
    const streetMetres = STREET_GEOMETRY[key]?.lengthM ?? null;
    // a close or a court is driven in and back out, so the projected path can exceed the
    // centreline; the extent covered is at most the street
    const capturedMetres = Math.min(Math.round(metres / 10) * 10, streetMetres ?? Infinity);
    let from = crossStreetNear(first.near.q, key, toXY);
    let to = crossStreetNear(last.near.q, key, toXY);
    if (from && to && from === to) to = null;
    if (!from && to) { from = to; to = null; }

    const start = isoInZone(first.p.t), end = isoInZone(last.p.t);
    const moved = meta.captured_at !== start.iso;
    if (moved) timeMoved++;
    if (meta.night && start.hour < 20) nightByFastClock.push(`${slug}: night in meta, filmed ${start.iso}`);
    if (from && to) withEnds++; else if (from) withOne++;
    if (streetMetres != null) withMetres++;

    console.log(`${slug.padEnd(26)} ${meta.captured_at.padEnd(25)} -> ${start.iso}  ${String(run.length).padStart(3)} rows  ${String(capturedMetres).padStart(5)} m of ${streetMetres ?? "?"} m  ${from ?? "?"} -> ${to ?? "?"}`);

    if (!WRITE) continue;
    if (moved && !meta.captured_at_filename) meta.captured_at_filename = meta.captured_at;
    meta.captured_at = start.iso;
    meta.captured_end = end.iso;
    meta.captured_at_source = "GPS timestamp of the first trace row on the street (scripts/video-coverage.ts); the filename clock runs +1 h";
    meta.local_hour = Math.round((start.hour + Number(start.iso.slice(14, 16)) / 60) * 100) / 100;
    meta.coverageFrom = from;
    meta.coverageTo = to;
    meta.capturedMetres = capturedMetres;
    meta.streetMetres = streetMetres;
    meta.coverage_source = `GPS trace ${meta.source_raw} projected onto Town of Milton Road Segments (identity ${key}); endpoints are registry streets meeting the run within ${CROSS_M} m; ${new Date().toISOString().slice(0, 10)}`;
    writeFileSync(metaPath, JSON.stringify(meta, null, 2) + "\n", "utf8");
    written++;
  }

  console.log(`\nrows ${rows.length} · ${WRITE ? "written" : "would write"} ${WRITE ? written : rows.length - problems.length} · captured_at moved on ${timeMoved} · both endpoints ${withEnds} · one endpoint ${withOne} · street length known ${withMetres}`);
  if (nightByFastClock.length) { console.log(`\nNIGHT BY THE FAST CLOCK, FILMED BEFORE 20:00 (${nightByFastClock.length}):`); for (const n of nightByFastClock) console.log(`  ${n}`); }
  if (problems.length) { console.log(`\nPROBLEMS (${problems.length}):`); for (const p of problems) console.log(`  ${p}`); }
  if (WRITE && written > 0) console.log("\nnow: scripts/backfill-video-captured.ts --write (rows + sidecar)");
  if (problems.length) process.exit(2);
}

main().catch((e) => { console.error("FATAL", e instanceof Error ? e.message : String(e)); process.exit(1); });

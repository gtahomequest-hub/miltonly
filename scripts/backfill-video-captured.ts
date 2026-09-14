// scripts/backfill-video-captured.ts
//
// MC-015. Two things, from one read of D:/dashcam/published/<slug>/meta.json per clip-carrying
// StreetContent row:
//
//   1. THE CAPTURE INSTANT AND ITS OFFSET. videoCapturedAt / nightCapturedAt used to hold UTC
//      midnight of the shot date and nothing else. They now hold the capture instant, and
//      videoCapturedOffsetMin / nightCapturedOffsetMin the clip's local UTC offset in minutes,
//      so the wall clock the clip was shot under is recoverable on any surface. meta.captured_at
//      is ISO with an offset on the 7 clips staged since the pipeline started writing one
//      ("2026-09-07T11:20:31-04:00"); the 42 older ones carry a bare local time
//      ("2026-09-01T19:34:00"). A bare time is read as America/Toronto, because every clip
//      was shot in Milton and the offset of that zone at that wall time is a fact, not a
//      guess: -240 for all of them (EDT). The script prints which rule each row took.
//
//   2. THE SIDECAR, src/data/streetVideoMeta.json. Duration, coverage endpoints and metres are
//      not columns (owner decision 2026-08-30); the render layer reads them from this file,
//      keyed by R2 key. Duration is ffprobe on the published bytes (the file the bucket holds),
//      falling back to meta.durationS / play_s / drive_s only when ffprobe is unavailable and
//      saying so. Coverage endpoints come from meta.coverageFrom / coverageTo, written by the
//      dashcam pipeline's clip-coverage.js; absent on every clip published before it existed,
//      and left null rather than derived here. The sidecar is REBUILT, not patched, so a
//      re-key or a new upload is one re-run away from a correct file.
//
//   A row whose URL does not match the meta's r2_key is reported and skipped, never guessed.
//   ffprobe also asserts zero audio streams on every published clip.
//
// Usage:
//   npx tsx --tsconfig tsconfig.test.json scripts/backfill-video-captured.ts            # dry run
//   npx tsx --tsconfig tsconfig.test.json scripts/backfill-video-captured.ts --write
//   ... --write --sidecar-only     # rebuild the sidecar, touch no row (before the code that
//                                  # reads offsets is on production, the rows stay as they are)

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { neon } from "@neondatabase/serverless";
import { probeClip } from "./videoProbe";

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
const SIDECAR = resolve(__dirname, "..", "src", "data", "streetVideoMeta.json");
const SLUG_SUFFIX = "-milton";
const ZONE = "America/Toronto";
const WRITE = process.argv.includes("--write");
const SIDECAR_ONLY = process.argv.includes("--sidecar-only");
const { DATABASE_URL = "" } = process.env;
if (!DATABASE_URL) { console.error("Missing DATABASE_URL in .env.local"); process.exit(1); }
const db = neon(DATABASE_URL);

interface Meta {
  slug: string;
  captured_at: string;
  night: boolean;
  r2_key?: string;
  durationS?: number;
  play_s?: number;
  drive_s?: number;
  coverageFrom?: string | null;
  coverageTo?: string | null;
  capturedMetres?: number | null;
  streetMetres?: number | null;
}
interface Row {
  streetSlug: string;
  videoUrl: string | null;
  videoCapturedAt: Date | null;
  videoCapturedOffsetMin: number | null;
  nightVideoUrl: string | null;
  nightCapturedAt: Date | null;
  nightCapturedOffsetMin: number | null;
}
interface SidecarEntry {
  durationS: number | null;
  coverageFrom: string | null;
  coverageTo: string | null;
  capturedMetres: number | null;
  streetMetres: number | null;
}

/** The offset of ZONE, in minutes east of UTC, at a wall-clock time expressed as a UTC-labelled
 *  Date. Two passes because the offset can shift between the guess and the truth at a DST edge. */
function zoneOffsetMin(wallAsUtc: Date): number {
  const fmt = new Intl.DateTimeFormat("en-US", { timeZone: ZONE, timeZoneName: "longOffset" });
  const read = (instant: Date): number => {
    const part = fmt.formatToParts(instant).find((p) => p.type === "timeZoneName")?.value ?? "GMT";
    const m = part.match(/GMT([+-])(\d{2}):?(\d{2})?/);
    if (!m) return 0;
    return (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3] ?? 0));
  };
  const guess = read(wallAsUtc);
  return read(new Date(wallAsUtc.getTime() - guess * 60_000));
}

/** meta.captured_at -> { instant, offsetMin, rule }. */
function parseCaptured(iso: string): { instant: Date; offsetMin: number; rule: "offset" | "toronto" } {
  const withOffset = iso.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?)(Z|[+-]\d{2}:\d{2})$/);
  if (withOffset) {
    const instant = new Date(iso);
    const off = withOffset[2] === "Z" ? 0 : (withOffset[2][0] === "-" ? -1 : 1) * (Number(withOffset[2].slice(1, 3)) * 60 + Number(withOffset[2].slice(4, 6)));
    return { instant, offsetMin: off, rule: "offset" };
  }
  const bare = iso.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!bare) throw new Error(`unparseable captured_at: ${iso}`);
  const wallAsUtc = new Date(Date.UTC(+bare[1], +bare[2] - 1, +bare[3], +bare[4], +bare[5], +(bare[6] ?? 0)));
  const offsetMin = zoneOffsetMin(wallAsUtc);
  return { instant: new Date(wallAsUtc.getTime() - offsetMin * 60_000), offsetMin, rule: "toronto" };
}

function r2KeyOf(url: string): string {
  return decodeURIComponent(new URL(url).pathname.replace(/^\/+/, ""));
}

let ffprobeMissing = false;
/** probeClip, remembering a missing ffprobe so the fallback is taken once per run, not once per clip. */
function probe(file: string): { durationS: number; audio: number } | null {
  if (ffprobeMissing) return null;
  const p = probeClip(file);
  if (p === null) ffprobeMissing = true;
  return p;
}

async function main() {
  console.log(`${WRITE ? "WRITE" : "DRY RUN"} · sidecar ${path.relative(process.cwd(), SIDECAR)}\n`);
  const rows = (await db`
    SELECT "streetSlug", "videoUrl", "videoCapturedAt", "videoCapturedOffsetMin", "nightVideoUrl", "nightCapturedAt", "nightCapturedOffsetMin"
    FROM public."StreetContent"
    WHERE "videoUrl" IS NOT NULL OR "nightVideoUrl" IS NOT NULL
    ORDER BY "streetSlug"`) as Row[];

  const clips: Record<string, SidecarEntry> = {};
  const problems: string[] = [];
  let updated = 0, unchanged = 0, byRule = { offset: 0, toronto: 0 };

  for (const r of rows) {
    const slug = r.streetSlug.endsWith(SLUG_SUFFIX) ? r.streetSlug.slice(0, -SLUG_SUFFIX.length) : r.streetSlug;
    const metaPath = path.join(PUBLISHED, slug, "meta.json");
    if (!existsSync(metaPath)) { problems.push(`${r.streetSlug}: no ${metaPath}`); continue; }
    const meta = JSON.parse(readFileSync(metaPath, "utf8")) as Meta;

    for (const variant of ["day", "night"] as const) {
      const url = variant === "day" ? r.videoUrl : r.nightVideoUrl;
      if (!url) continue;
      if (meta.night !== (variant === "night")) { problems.push(`${r.streetSlug} ${variant}: meta.night=${meta.night} does not match the column`); continue; }
      const key = r2KeyOf(url);
      if (meta.r2_key !== key) { problems.push(`${r.streetSlug} ${variant}: column key ${key} != meta.r2_key ${meta.r2_key}`); continue; }

      // 1. instant + offset
      const { instant, offsetMin, rule } = parseCaptured(meta.captured_at);
      byRule[rule]++;
      const curAt = variant === "day" ? r.videoCapturedAt : r.nightCapturedAt;
      const curOff = variant === "day" ? r.videoCapturedOffsetMin : r.nightCapturedOffsetMin;
      const same = curAt && new Date(curAt).getTime() === instant.getTime() && curOff === offsetMin;
      const local = new Date(instant.getTime() + offsetMin * 60_000).toISOString().slice(0, 16).replace("T", " ");
      console.log(`${r.streetSlug.padEnd(30)} ${variant.padEnd(5)} ${meta.captured_at.padEnd(25)} -> ${instant.toISOString()} off ${offsetMin} (${rule}) local ${local}${same ? "  (unchanged)" : ""}`);
      if (same) unchanged++;
      else if (WRITE && !SIDECAR_ONLY) {
        if (variant === "day") await db`UPDATE public."StreetContent" SET "videoCapturedAt" = ${instant.toISOString()}, "videoCapturedOffsetMin" = ${offsetMin} WHERE "streetSlug" = ${r.streetSlug}`;
        else await db`UPDATE public."StreetContent" SET "nightCapturedAt" = ${instant.toISOString()}, "nightCapturedOffsetMin" = ${offsetMin} WHERE "streetSlug" = ${r.streetSlug}`;
        updated++;
      } else updated++;

      // 2. sidecar
      const file = path.join(PUBLISHED, slug, `${variant}.mp4`);
      let durationS: number | null = null;
      if (existsSync(file)) {
        const p = probe(file);
        if (p) {
          if (p.audio !== 0) problems.push(`${r.streetSlug} ${variant}: ${p.audio} audio stream(s) in the published bytes`);
          durationS = p.durationS;
        } else {
          durationS = meta.durationS ?? meta.play_s ?? meta.drive_s ?? null;
          console.log(`${" ".repeat(30)} ffprobe not on PATH; duration from meta (${durationS})`);
        }
      } else {
        problems.push(`${r.streetSlug} ${variant}: no ${file}`);
      }
      clips[key] = {
        durationS,
        coverageFrom: meta.coverageFrom ?? null,
        coverageTo: meta.coverageTo ?? null,
        capturedMetres: meta.capturedMetres ?? null,
        streetMetres: meta.streetMetres ?? null,
      };
    }
  }

  const sorted = Object.fromEntries(Object.entries(clips).sort(([a], [b]) => a.localeCompare(b)));
  const withEnds = Object.values(sorted).filter((c) => c.coverageFrom && c.coverageTo).length;
  const withDur = Object.values(sorted).filter((c) => c.durationS != null).length;
  console.log(`\nrows ${rows.length} · ${WRITE ? "updated" : "would update"} ${updated} · unchanged ${unchanged} · offset rule: ${byRule.offset} carried, ${byRule.toronto} read as ${ZONE}`);
  console.log(`sidecar: ${Object.keys(sorted).length} clips · ${withDur} with duration · ${withEnds} with both endpoints`);
  if (problems.length) { console.log(`\nPROBLEMS (${problems.length}):`); for (const p of problems) console.log(`  ${p}`); }

  if (WRITE) {
    const prev = existsSync(SIDECAR) ? (JSON.parse(readFileSync(SIDECAR, "utf8")) as { builtAt?: string | null }) : {};
    writeFileSync(SIDECAR, JSON.stringify({ generator: "scripts/backfill-video-captured.ts", builtAt: new Date().toISOString(), clips: sorted }, null, 2) + "\n", "utf8");
    console.log(`\nsidecar written (was built ${prev.builtAt ?? "never"})`);
  }
  if (problems.length) process.exit(2);
}

main().catch((e) => { console.error("FATAL", e instanceof Error ? e.message : String(e)); process.exit(1); });

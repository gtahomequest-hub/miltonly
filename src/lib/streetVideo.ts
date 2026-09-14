// src/lib/streetVideo.ts
// Resolver for street video. StreetContent stores four fields: videoUrl / videoCapturedAt /
// nightVideoUrl / nightCapturedAt. EVERYTHING ELSE the page, the VideoObject JSON-LD and
// sitemap-video.xml need is derived here, so no second copy drifts:
//   - poster frame  → key convention: the .mp4 URL with poster.webp beside it (see
//                     deriveVideoPoster). Null when the URL is not an .mp4 we can rewrite
//                     (then no poster, and, per Google's required trio, no VideoObject).
//   - wall clock    → *CapturedAt is the capture instant (the GPS row of the clip's trace,
//                     MC-015) and every surface reads it in America/Toronto, where every clip
//                     is filmed. That is the date the caption prints, the offset uploadDate
//                     carries, and the hour a night clip is checked against.
//   - duration and  → src/data/streetVideoMeta.json, keyed by R2 key, written from each clip's
//     coverage        meta.json by scripts/backfill-video-captured.ts (ffprobe on the published
//                     bytes; the extent from scripts/video-coverage.ts, the clip's GPS trace on
//                     the Town road layer). A sidecar, not a column: owner decision 2026-08-30.
//
// THE COVERAGE SENTENCE is "Footage covers X m of Y m, from A to B. Filmed <date>." and every
// clause is sourced: the metres from the trace and the Town centreline, the endpoints from the
// registry streets the run meets, the date from the instant in Toronto. A clause with no source
// is dropped, never filled: no metres and the sentence says the footage is one pass along the
// street; one endpoint and it says "from A"; none and it says neither.

import videoMeta from "@/data/streetVideoMeta.json";
import { config } from "@/lib/config";

const MILTON = "Milton, Ontario";
export const VIDEO_ZONE = "America/Toronto";

export interface SidecarEntry {
  durationS: number | null;
  coverageFrom: string | null;
  coverageTo: string | null;
  capturedMetres: number | null;
  streetMetres: number | null;
}
const SIDECAR: Record<string, SidecarEntry> = (videoMeta as { clips: Record<string, SidecarEntry> }).clips;

export interface StreetVideoClip {
  /** Public R2 URL of the mp4 (VideoObject.contentUrl, <source src>). */
  src: string;
  /** Poster image (.webp) derived from `src` by key convention; null when underivable. */
  poster: string | null;
  /** Human caption under the player, e.g. "Captured 27 August 2026". "" when no date. */
  caption: string;
  /** VideoObject.uploadDate: the capture instant with its Toronto offset; null when no timestamp. */
  uploadDate: string | null;
  /** VideoObject.name. */
  name: string;
  /** VideoObject.description: the coverage sentence. */
  description: string;
  /** The coverage sentence rendered under the player. "" only when there is no date at all. */
  coverage: string;
  /** Clip length in seconds from the sidecar; null when the sidecar has no entry. */
  durationS: number | null;
  /** ISO 8601 duration ("PT45S") for VideoObject.duration and the video sitemap; null when unknown. */
  durationIso: string | null;
  /** Wall-clock hour (0-23) at capture in Toronto; null when no timestamp. */
  localHour: number | null;
}

export interface StreetVideoView {
  /** Daylight clip; null when videoUrl is null (renders nothing). */
  day: StreetVideoClip | null;
  /** Overnight clip; null when nightVideoUrl is null (renders nothing). */
  night: StreetVideoClip | null;
  /** The takedown address printed once under the clips. */
  takedownEmail: string;
}

/** Poster URL by name convention, because there is no poster column to read.
 *
 *  Two layouts, in order:
 *    R2      streets/<slug>/<YYYYMMDD>/day.mp4    ->  streets/<slug>/<YYYYMMDD>/poster.webp
 *            streets/<slug>/<YYYYMMDD>/night.mp4  ->  streets/<slug>/<YYYYMMDD>/poster.webp
 *            streets/<slug>/day.mp4               ->  streets/<slug>/poster.webp   (undated, retired)
 *    legacy  <anything>.mp4                       ->  <anything>.webp      (the Vercel Blob PoC)
 *
 *  Every live key is dated (MC-015) and carries its own poster beside the clip. The night arm
 *  had to be added before the 2026-09-04 upload run: without it "night.mp4" fell through to
 *  the legacy arm and produced "night.webp", a key that does not exist, and with the poster
 *  gone the VideoObject went with it (Google's required trio includes a thumbnail).
 *
 *  The legacy arm stays because it costs one regex and removing it would silently drop the poster,
 *  and with it the VideoObject, for any row still holding a Blob URL. Returns null when the URL
 *  carries no rewritable `.mp4`, in which case there is no poster and no VideoObject.
 *  Preserves any `?query`/`#hash`. */
export function deriveVideoPoster(url: string): string | null {
  const r2 = url.replace(/\/(?:day|night)\.mp4(?=$|[?#])/i, "/poster.webp");
  if (r2 !== url) return r2;
  const legacy = url.replace(/\.mp4(?=$|[?#])/i, ".webp");
  return legacy !== url ? legacy : null;
}

/** The R2 key of a public clip URL: the pathname without its leading slash, so the same
 *  key resolves under r2.dev and under a custom host. Null when the URL does not parse. */
export function r2KeyOf(url: string): string | null {
  try {
    return decodeURIComponent(new URL(url).pathname.replace(/^\/+/, ""));
  } catch {
    return null;
  }
}

/** The sidecar entry for a clip URL, or null. */
export function sidecarFor(url: string): SidecarEntry | null {
  const key = r2KeyOf(url);
  return key && SIDECAR[key] ? SIDECAR[key] : null;
}

interface Wall {
  /** "2026-09-07" */
  date: string;
  /** "7 September 2026" */
  dateLong: string;
  /** 0-23 */
  hour: number;
  /** "2026-09-07T11:20:17-04:00" */
  iso: string;
}

/** The instant read on Toronto's clock. Null for a missing or invalid Date. */
export function torontoWall(capturedAt: Date | null): Wall | null {
  if (!capturedAt || Number.isNaN(capturedAt.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: VIDEO_ZONE,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "longOffset",
  }).formatToParts(capturedAt);
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const off = (g("timeZoneName").match(/GMT([+-]\d{2}:\d{2})/) || [])[1] ?? "+00:00";
  const date = `${g("year")}-${g("month")}-${g("day")}`;
  const dateLong = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: VIDEO_ZONE }).format(capturedAt);
  return { date, dateLong, hour: Number(g("hour")), iso: `${date}T${g("hour")}:${g("minute")}:${g("second")}${off}` };
}

/** "PT1M5S" for 65 seconds. */
export function isoDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `PT${m > 0 ? `${m}M` : ""}${r > 0 || m === 0 ? `${r}S` : ""}`;
}

function metres(m: number): string {
  return `${Math.round(m).toLocaleString("en-CA")} m`;
}

/** The coverage sentence. "" when there is no date, because a sentence that cannot say when
 *  it was filmed says nothing. */
export function buildCoverageSentence(args: { streetName: string; night: boolean; wall: Wall | null; sidecar: SidecarEntry | null }): string {
  const { streetName, night, wall, sidecar } = args;
  if (!wall) return "";
  const hasMetres = sidecar?.capturedMetres != null && sidecar?.streetMetres != null;
  const from = sidecar?.coverageFrom ?? null;
  const to = sidecar?.coverageTo ?? null;
  const ends = from && to ? `, from ${from} to ${to}` : from ? `, from ${from}` : "";
  const lead = hasMetres
    ? `Footage covers ${metres(sidecar!.capturedMetres!)} of ${metres(sidecar!.streetMetres!)}${ends}`
    : `Footage is one ${night ? "overnight " : ""}pass along ${streetName}${ends}`;
  return `${lead}. Filmed ${wall.dateLong}${night ? ", after dark" : ""}.`;
}

function buildClip(args: { streetName: string; url: string; capturedAt: Date | null; variant: "day" | "night" }): StreetVideoClip {
  const { streetName, url, capturedAt, variant } = args;
  const night = variant === "night";
  const wall = torontoWall(capturedAt);
  const caption = wall ? (night ? `Overnight · Captured ${wall.dateLong}` : `Captured ${wall.dateLong}`) : night ? "Overnight" : "";
  const sidecar = sidecarFor(url);
  const coverage = buildCoverageSentence({ streetName, night, wall, sidecar });
  const fallback = night ? `An overnight video of ${streetName} in ${MILTON}.` : `A daytime video of ${streetName} in ${MILTON}.`;
  return {
    src: url,
    poster: deriveVideoPoster(url),
    caption,
    uploadDate: wall?.iso ?? null,
    name: night ? `${streetName} overnight tour, ${MILTON}` : `${streetName} street tour, ${MILTON}`,
    description: coverage ? `${streetName}, ${MILTON}. ${coverage}` : fallback,
    coverage,
    durationS: sidecar?.durationS ?? null,
    durationIso: sidecar?.durationS != null ? isoDuration(sidecar.durationS) : null,
    localHour: wall?.hour ?? null,
  };
}

/** Build the video view model from the four StreetContent columns, or null when the street
 *  carries no clip at all (the common case). */
export function resolveStreetVideo(input: {
  streetName: string;
  videoUrl: string | null;
  videoCapturedAt: Date | null;
  nightVideoUrl: string | null;
  nightCapturedAt: Date | null;
}): StreetVideoView | null {
  const day = input.videoUrl ? buildClip({ streetName: input.streetName, url: input.videoUrl, capturedAt: input.videoCapturedAt, variant: "day" }) : null;
  const night = input.nightVideoUrl ? buildClip({ streetName: input.streetName, url: input.nightVideoUrl, capturedAt: input.nightCapturedAt, variant: "night" }) : null;
  if (!day && !night) return null;
  return { day, night, takedownEmail: config.video.takedownEmail };
}

// src/lib/streetVideo.ts
// Resolver for street video. StreetContent stores six fields: videoUrl / videoCapturedAt /
// videoCapturedOffsetMin and the night trio. EVERYTHING ELSE the page, the VideoObject
// JSON-LD and sitemap-video.xml need is derived here, so no second copy drifts:
//   - poster frame  → key convention: the .mp4 URL with poster.webp beside it (see
//                     deriveVideoPoster). Null when the URL is not an .mp4 we can rewrite
//                     (then no poster, and, per Google's required trio, no VideoObject).
//   - local time    → *CapturedAt is the capture instant and *CapturedOffsetMin the clip's
//                     local UTC offset (MC-015). Shift the instant by the offset and read the
//                     wall clock in UTC: that is the date the caption prints and the hour a
//                     night clip is checked against. Rows with a null offset predate the
//                     backfill and hold UTC midnight of the shot date, so UTC is the wall clock.
//   - duration and  → src/data/streetVideoMeta.json, keyed by R2 key, written at upload from
//     coverage        the clip's own meta.json (scripts/backfill-video-captured.ts rebuilds it).
//                     A sidecar, not a column: owner decision 2026-08-30. Missing entry means
//                     no duration and no endpoints, and the sentence says less, never more.
//
// THE COVERAGE SENTENCE never claims an extent it cannot source. With endpoints it says "from
// A to B"; without them it states the pass length in seconds and nothing about how much of
// the street that is. "Covering X m of Y m" appears only when both metres are recorded.

import videoMeta from "@/data/streetVideoMeta.json";
import { config } from "@/lib/config";

const MILTON = "Milton, Ontario";

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
  /** VideoObject.uploadDate: the capture instant with its offset when the offset is known,
   *  else the bare date; null when no capture timestamp. */
  uploadDate: string | null;
  /** VideoObject.name. */
  name: string;
  /** VideoObject.description, which is the coverage sentence when one can be written. */
  description: string;
  /** The coverage sentence rendered under the player. "" only when there is no date at all. */
  coverage: string;
  /** Clip length in seconds from the sidecar; null when the sidecar has no entry. */
  durationS: number | null;
  /** ISO 8601 duration ("PT45S") for VideoObject.duration and the video sitemap; null when unknown. */
  durationIso: string | null;
  /** Wall-clock hour (0-23) at capture under the clip's own offset; null when unknown. */
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
 *    R2      streets/<slug>/day.mp4               ->  streets/<slug>/poster.webp
 *            streets/<slug>/night.mp4             ->  streets/<slug>/poster.webp
 *            streets/<slug>/<YYYYMMDD>/day.mp4    ->  streets/<slug>/<YYYYMMDD>/poster.webp
 *    legacy  <anything>.mp4                       ->  <anything>.webp      (the Vercel Blob PoC)
 *
 *  A dated key carries its own poster beside the clip (MC-007 re-key, MC-015 for every clip);
 *  the undated layout shares one poster.webp per street. The night arm had to be added before
 *  the 2026-09-04 upload run: without it "night.mp4" fell through to the legacy arm and
 *  produced "night.webp", a key that does not exist, and with the poster gone the VideoObject
 *  went with it (Google's required trio includes a thumbnail).
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

/** The capture instant shifted into the clip's wall clock, to be read in UTC. A null offset
 *  means a pre-backfill row holding UTC midnight of the shot date, so the instant is already
 *  the wall clock. */
export function wallClock(capturedAt: Date | null, offsetMin: number | null): Date | null {
  if (!capturedAt || Number.isNaN(capturedAt.getTime())) return null;
  return offsetMin == null ? capturedAt : new Date(capturedAt.getTime() + offsetMin * 60_000);
}

/** "27 August 2026" (no leading zero) from a wall-clock instant read in UTC. */
function formatDate(wall: Date): string {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(wall);
}

/** "9:40 pm" from a wall-clock instant read in UTC. */
function formatTime(wall: Date): string {
  const h = wall.getUTCHours();
  const m = wall.getUTCMinutes();
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
}

/** "+05:30" / "-04:00" for an offset in minutes. */
function formatOffset(offsetMin: number): string {
  const sign = offsetMin < 0 ? "-" : "+";
  const abs = Math.abs(offsetMin);
  return `${sign}${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")}`;
}

/** VideoObject.uploadDate: "2026-09-07T11:20:31-04:00" when the offset is known, else the
 *  bare date. Google reads either; the offset form is the one that carries the wall clock. */
export function uploadDateOf(capturedAt: Date | null, offsetMin: number | null): string | null {
  const wall = wallClock(capturedAt, offsetMin);
  if (!wall) return null;
  const iso = wall.toISOString();
  return offsetMin == null ? iso.slice(0, 10) : `${iso.slice(0, 19)}${formatOffset(offsetMin)}`;
}

/** "PT1M5S" for 65 seconds. */
export function isoDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `PT${m > 0 ? `${m}M` : ""}${r > 0 || m === 0 ? `${r}S` : ""}`;
}

/** "45-second" / "1-minute" / "2-minute 10-second" for prose. */
function durationPhrase(seconds: number): string {
  const s = Math.round(seconds);
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m === 0) return `${r}-second`;
  if (r === 0) return `${m}-minute`;
  return `${m}-minute ${r}-second`;
}

function formatMetres(m: number): string {
  return `${Math.round(m).toLocaleString("en-CA")} m`;
}

/** The coverage sentence. Every clause is sourced: the pass length from the sidecar, the
 *  endpoints only when both are recorded, the metres only when both are recorded, the date
 *  and time from the capture instant under its own offset. "" when there is no date, because
 *  a sentence that cannot say when it was filmed says nothing. */
export function buildCoverageSentence(args: {
  streetName: string;
  night: boolean;
  wall: Date | null;
  offsetKnown: boolean;
  sidecar: SidecarEntry | null;
}): string {
  const { streetName, night, wall, offsetKnown, sidecar } = args;
  if (!wall) return "";
  const dur = sidecar?.durationS != null ? `${durationPhrase(sidecar.durationS)} ` : "";
  const lead = night ? `An overnight ${dur}pass along ${streetName}` : `A ${dur}daytime pass along ${streetName}`;
  const ends = sidecar?.coverageFrom && sidecar?.coverageTo ? `, from ${sidecar.coverageFrom} to ${sidecar.coverageTo}` : "";
  const metres =
    sidecar?.capturedMetres != null && sidecar?.streetMetres != null
      ? `, covering ${formatMetres(sidecar.capturedMetres)} of the street's ${formatMetres(sidecar.streetMetres)}`
      : "";
  const when = offsetKnown ? `${formatDate(wall)} at ${formatTime(wall)}` : formatDate(wall);
  return `${lead}${ends}${metres}. Filmed ${when}.`;
}

function buildClip(args: {
  streetName: string;
  url: string;
  capturedAt: Date | null;
  offsetMin: number | null;
  variant: "day" | "night";
}): StreetVideoClip {
  const { streetName, url, capturedAt, offsetMin, variant } = args;
  const night = variant === "night";
  const wall = wallClock(capturedAt, offsetMin);
  const captured = wall ? formatDate(wall) : null;
  const caption = captured ? (night ? `Overnight · Captured ${captured}` : `Captured ${captured}`) : night ? "Overnight" : "";
  const sidecar = sidecarFor(url);
  const coverage = buildCoverageSentence({ streetName, night, wall, offsetKnown: offsetMin != null, sidecar });
  const fallback = night
    ? `An overnight video of ${streetName} in ${MILTON}: street lighting, on-street parking and after-hours character.`
    : `A daytime video of ${streetName} in ${MILTON}.`;
  return {
    src: url,
    poster: deriveVideoPoster(url),
    caption,
    uploadDate: uploadDateOf(capturedAt, offsetMin),
    name: night ? `${streetName} overnight tour, ${MILTON}` : `${streetName} street tour, ${MILTON}`,
    description: coverage ? `${coverage.replace(/\.$/, "")}, in ${MILTON}.` : fallback,
    coverage,
    durationS: sidecar?.durationS ?? null,
    durationIso: sidecar?.durationS != null ? isoDuration(sidecar.durationS) : null,
    localHour: wall ? wall.getUTCHours() : null,
  };
}

/** Build the video view model from the six StreetContent columns, or null when the street
 *  carries no clip at all (the common case). */
export function resolveStreetVideo(input: {
  streetName: string;
  videoUrl: string | null;
  videoCapturedAt: Date | null;
  videoCapturedOffsetMin?: number | null;
  nightVideoUrl: string | null;
  nightCapturedAt: Date | null;
  nightCapturedOffsetMin?: number | null;
}): StreetVideoView | null {
  const day = input.videoUrl
    ? buildClip({
        streetName: input.streetName,
        url: input.videoUrl,
        capturedAt: input.videoCapturedAt,
        offsetMin: input.videoCapturedOffsetMin ?? null,
        variant: "day",
      })
    : null;
  const night = input.nightVideoUrl
    ? buildClip({
        streetName: input.streetName,
        url: input.nightVideoUrl,
        capturedAt: input.nightCapturedAt,
        offsetMin: input.nightCapturedOffsetMin ?? null,
        variant: "night",
      })
    : null;
  if (!day && !night) return null;
  return { day, night, takedownEmail: config.video.takedownEmail };
}

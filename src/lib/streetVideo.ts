// src/lib/streetVideo.ts
// Resolver for the street-video PoC (2026-08-30). The DB stores exactly four fields on
// StreetContent — videoUrl / videoCapturedAt / nightVideoUrl / nightCapturedAt — and
// EVERYTHING ELSE the page and the VideoObject JSON-LD need is derived here, so no
// second copy drifts:
//   - poster frame  → blob-name convention: the .mp4 URL with a .webp extension. The
//                     poster is extracted from the clip offline and uploaded to Blob
//                     under the SAME pathname as the video (same basename, differing only
//                     in extension) — so the upload must use deterministic names, no
//                     random suffix. Null when the URL isn't an .mp4 we can rewrite (then
//                     no poster, and — per Google's required trio — no VideoObject).
//   - caption       → "Captured 27 August 2026" from *CapturedAt (UTC, no leading zero).
//   - uploadDate    → the same timestamp as an ISO date, for VideoObject.uploadDate.
//
// DURATION is intentionally absent from the VideoObject for now. It is a property of the
// clip, not of these four columns, and it is not worth a fifth column (owner decision,
// 2026-08-30). The poster is a pure URL transform, not a metadata blob, so there is no
// existing side-channel to carry a duration either. If we ever want VideoObject.duration,
// capture it from the file at upload time into a sidecar metadata JSON (poster + duration)
// and read it here — a convention change, still no schema change. Until then we omit it
// rather than fabricate one.

const MILTON = "Milton, Ontario";

export interface StreetVideoClip {
  /** Vercel Blob URL of the mp4 (VideoObject.contentUrl, <source src>). */
  src: string;
  /** Poster image (.webp) derived from `src` by blob-name convention; null when underivable. */
  poster: string | null;
  /** Human caption under the player, e.g. "Captured 27 August 2026". "" when no date. */
  caption: string;
  /** ISO date (YYYY-MM-DD) for VideoObject.uploadDate; null when no capture timestamp. */
  uploadDate: string | null;
  /** VideoObject.name. */
  name: string;
  /** VideoObject.description. */
  description: string;
}

export interface StreetVideoView {
  /** Daylight clip; null when videoUrl is null (renders nothing). */
  day: StreetVideoClip | null;
  /** Overnight clip; null when nightVideoUrl is null (renders nothing). */
  night: StreetVideoClip | null;
}

/** Poster URL by name convention, because there is no poster column to read.
 *
 *  Two layouts, in order:
 *    R2      streets/<slug>/day.mp4  ->  streets/<slug>/poster.webp
 *    legacy  <anything>.mp4          ->  <anything>.webp        (the Vercel Blob PoC)
 *
 *  The legacy arm stays because it costs one regex and removing it would silently drop the poster,
 *  and with it the VideoObject, for any row still holding a Blob URL. Returns null when the URL
 *  carries no rewritable `.mp4`, in which case there is no poster and no VideoObject.
 *  Preserves any `?query`/`#hash`. */
export function deriveVideoPoster(url: string): string | null {
  const r2 = url.replace(/\/day\.mp4(?=$|[?#])/i, "/poster.webp");
  if (r2 !== url) return r2;
  const legacy = url.replace(/\.mp4(?=$|[?#])/i, ".webp");
  return legacy !== url ? legacy : null;
}

/** "27 August 2026" (UTC, no leading zero) or null. Capture timestamps are dates, so
 *  format in UTC to avoid a local-timezone off-by-one. */
function formatCaptured(capturedAt: Date | null): string | null {
  if (!capturedAt || Number.isNaN(capturedAt.getTime())) return null;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(capturedAt);
}

function isoDate(capturedAt: Date | null): string | null {
  if (!capturedAt || Number.isNaN(capturedAt.getTime())) return null;
  return capturedAt.toISOString().slice(0, 10);
}

function buildClip(args: {
  streetName: string;
  url: string;
  capturedAt: Date | null;
  variant: "day" | "night";
}): StreetVideoClip {
  const { streetName, url, capturedAt, variant } = args;
  const captured = formatCaptured(capturedAt);
  const night = variant === "night";
  const caption = captured ? (night ? `Overnight · Captured ${captured}` : `Captured ${captured}`) : night ? "Overnight" : "";
  return {
    src: url,
    poster: deriveVideoPoster(url),
    caption,
    uploadDate: isoDate(capturedAt),
    name: night ? `${streetName} overnight tour, ${MILTON}` : `${streetName} street tour, ${MILTON}`,
    description: night
      ? `An overnight video of ${streetName} in ${MILTON} — street lighting, on-street parking, and after-hours character.`
      : `A daytime video tour of ${streetName} in ${MILTON}.`,
  };
}

/** Build the video view model from the four StreetContent columns, or null when the
 *  street carries no clip at all (the common case — this is a single-street PoC). */
export function resolveStreetVideo(input: {
  streetName: string;
  videoUrl: string | null;
  videoCapturedAt: Date | null;
  nightVideoUrl: string | null;
  nightCapturedAt: Date | null;
}): StreetVideoView | null {
  const day = input.videoUrl
    ? buildClip({ streetName: input.streetName, url: input.videoUrl, capturedAt: input.videoCapturedAt, variant: "day" })
    : null;
  const night = input.nightVideoUrl
    ? buildClip({ streetName: input.streetName, url: input.nightVideoUrl, capturedAt: input.nightCapturedAt, variant: "night" })
    : null;
  if (!day && !night) return null;
  return { day, night };
}

// The poster URL is derived, not stored, so the derivation IS the poster.
//
// WHY THIS EXISTS. deriveVideoPoster rewrote "/day.mp4" only. The 2026-09-04 upload run put two
// night-only streets in the bucket and re-keyed three more from day to night, and every one of
// those URLs ends "/night.mp4". Without a night arm they fell through to the legacy Blob arm,
// which rewrites any ".mp4" to ".webp" and produces "night.webp" — a key that has never existed.
// The poster would 404, and because Google's required VideoObject trio includes a thumbnail, the
// VideoObject would be dropped from the page entirely. Silently: no error, just a missing rich
// result on five streets.
//
// There is ONE poster.webp per street, shared by both variants. That is the convention this
// guards.
import { deriveVideoPoster, resolveStreetVideo } from "../src/lib/streetVideo";

const failures: string[] = [];
const BASE = "https://pub-7975a00b72d94caba9def0c4b5e9c388.r2.dev";

function expect(label: string, got: string | null, want: string | null) {
  if (got !== want) failures.push(`  ${label}: got ${got}, want ${want}`);
}

// ── R2 layout, both variants, one poster ─────────────────────────────────────────────
expect("day.mp4", deriveVideoPoster(`${BASE}/streets/lemieux-court-milton/day.mp4`), `${BASE}/streets/lemieux-court-milton/poster.webp`);
expect("night.mp4", deriveVideoPoster(`${BASE}/streets/1st-line-milton/night.mp4`), `${BASE}/streets/1st-line-milton/poster.webp`);
expect("night.mp4 on a re-keyed street", deriveVideoPoster(`${BASE}/streets/frost-court-milton/night.mp4`), `${BASE}/streets/frost-court-milton/poster.webp`);

// Query and hash survive, because the CDN URL may carry either.
expect("day.mp4 with a query", deriveVideoPoster(`${BASE}/streets/x-milton/day.mp4?v=2`), `${BASE}/streets/x-milton/poster.webp?v=2`);
expect("night.mp4 with a hash", deriveVideoPoster(`${BASE}/streets/x-milton/night.mp4#t=3`), `${BASE}/streets/x-milton/poster.webp#t=3`);

// ── legacy Blob arm, still intact ────────────────────────────────────────────────────
// Removing it would silently drop the poster for any row still holding a Blob URL.
expect("legacy blob", deriveVideoPoster("https://x.blob.vercel-storage.com/street-videos/lemieux-court-milton.mp4"), "https://x.blob.vercel-storage.com/street-videos/lemieux-court-milton.webp");

// ── no rewritable mp4 means no poster, and therefore no VideoObject ───────────────────
expect("not an mp4", deriveVideoPoster(`${BASE}/streets/x-milton/clip.webm`), null);

// ── the trio Google requires ─────────────────────────────────────────────────────────
// A night clip must produce a poster AND an uploadDate, or buildVideoObjectSchema returns null
// and the page ships without the rich result.
{
  const view = resolveStreetVideo({
    streetName: "First Line",
    videoUrl: null,
    videoCapturedAt: null,
    nightVideoUrl: `${BASE}/streets/1st-line-milton/night.mp4`,
    nightCapturedAt: new Date("2026-08-25T00:00:00Z"),
  });
  if (!view?.night) failures.push("  night-only street: resolveStreetVideo returned no night clip");
  else {
    if (view.night.poster !== `${BASE}/streets/1st-line-milton/poster.webp`) {
      failures.push(`  night-only street: poster = ${view.night.poster}`);
    }
    if (view.night.uploadDate !== "2026-08-25") {
      failures.push(`  night-only street: uploadDate = ${view.night.uploadDate}`);
    }
    if (!/Overnight/.test(view.night.caption)) {
      failures.push(`  night-only street: caption lost its overnight marker: ${view.night.caption}`);
    }
  }
  if (view?.day) failures.push("  night-only street: a day clip appeared from nowhere");
}

if (failures.length > 0) {
  console.error(`test-video-poster: ${failures.length} failure(s)`);
  for (const f of failures) console.error(f);
  process.exit(1);
}
console.log("test-video-poster: PASS (11 assertions)");

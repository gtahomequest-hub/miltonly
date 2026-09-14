// scripts/test-video-playbook.ts
//
// MC-015, the video playbook adoptions, held in the prebuild:
//
//   1. THE WALL CLOCK IS TORONTO'S. *CapturedAt is an instant; the caption, the uploadDate and
//      the local hour read it in America/Toronto. A 9:40 pm capture is the next day in UTC and
//      the caption must not say so.
//   2. THE COVERAGE SENTENCE NEVER SAYS MORE THAN ITS SOURCES. "Footage covers X m of Y m, from
//      A to B. Filmed <date>." Metres only when both are recorded, endpoints only as recorded
//      (one endpoint is "from A", not "from A to A"), and without metres the sentence says the
//      footage is one pass along the street.
//   3. DATED KEYS carry their own poster; the sidecar is looked up by R2 key under any host.
//   4. THE UPLOAD GATE refuses an audio stream: probeClip counts them on the bytes, and a
//      synthetic clip with a silent audio track is refused while the same clip without one
//      passes. Skipped, and said so, when ffmpeg is not on PATH; ffprobe absent is itself a
//      refusal of the run in the upload script.
//   5. THE TAKEDOWN ADDRESS is one config value, on every view.
//   6. THE SIDECAR on disk is keyed by dated R2 keys only, every entry has a duration, and an
//      entry with one endpoint never has the same name twice.
//   7. THE SITEMAP INDEX names both files and robots names the index.

import { existsSync, mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  resolveStreetVideo,
  buildCoverageSentence,
  deriveVideoPoster,
  r2KeyOf,
  isoDuration,
  torontoWall,
} from "../src/lib/streetVideo";
import { buildVideoObjectSchema } from "../src/lib/schema/street-schema";
import { config } from "../src/lib/config";
import { probeClip } from "./videoProbe";
import sidecar from "../src/data/streetVideoMeta.json";

const failures: string[] = [];
let assertions = 0;
function expect(label: string, got: unknown, want: unknown) {
  assertions++;
  if (got !== want) failures.push(`  ${label}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
}
function expectMatch(label: string, got: string, re: RegExp) {
  assertions++;
  if (!re.test(got)) failures.push(`  ${label}: ${JSON.stringify(got)} does not match ${re}`);
}

const BASE = "https://pub-7975a00b72d94caba9def0c4b5e9c388.r2.dev";
const NIGHT = new Date("2026-08-26T01:40:00Z"); // 9:40 pm on 25 August in Milton (EDT)
const DAY = new Date("2026-09-07T15:20:31Z"); // 11:20 am on 7 September

// ── 1. Toronto's clock ───────────────────────────────────────────────────────────────
{
  const w = torontoWall(NIGHT);
  expect("date in Toronto", w?.date, "2026-08-25");
  expect("hour in Toronto", w?.hour, 21);
  expect("iso with the Toronto offset", w?.iso, "2026-08-25T21:40:00-04:00");
  expect("long date", w?.dateLong, "25 August 2026");
  expect("winter offset", torontoWall(new Date("2026-01-15T03:10:00Z"))?.iso, "2026-01-14T22:10:00-05:00");
  expect("null in, null out", torontoWall(null), null);
  expect("invalid in, null out", torontoWall(new Date("nope")), null);

  const view = resolveStreetVideo({ streetName: "Frost Court", videoUrl: null, videoCapturedAt: null, nightVideoUrl: `${BASE}/streets/frost-court-milton/20260825/night.mp4`, nightCapturedAt: NIGHT });
  expect("night caption reads Toronto's date", view?.night?.caption, "Overnight · Captured 25 August 2026");
  expect("night local hour", view?.night?.localHour, 21);
  expect("night uploadDate", view?.night?.uploadDate, "2026-08-25T21:40:00-04:00");
}

// ── 2. the coverage sentence ─────────────────────────────────────────────────────────
{
  const wall = torontoWall(DAY);
  const S = (sc: Parameters<typeof buildCoverageSentence>[0]["sidecar"], night = false) => buildCoverageSentence({ streetName: "Anne Boulevard", night, wall, sidecar: sc });
  expect("full form", S({ durationS: 45, coverageFrom: "Bronte Street", coverageTo: "Main Street", capturedMetres: 400, streetMetres: 570 }), "Footage covers 400 m of 570 m, from Bronte Street to Main Street. Filmed 7 September 2026.");
  expect("one endpoint", S({ durationS: 45, coverageFrom: "Bronte Street", coverageTo: null, capturedMetres: 400, streetMetres: 570 }), "Footage covers 400 m of 570 m, from Bronte Street. Filmed 7 September 2026.");
  expect("no endpoints", S({ durationS: 45, coverageFrom: null, coverageTo: null, capturedMetres: 400, streetMetres: 570 }), "Footage covers 400 m of 570 m. Filmed 7 September 2026.");
  expect("to without from is no endpoint", S({ durationS: 45, coverageFrom: null, coverageTo: "Main Street", capturedMetres: 400, streetMetres: 570 }), "Footage covers 400 m of 570 m. Filmed 7 September 2026.");
  expect("captured metres without street metres is no fraction", S({ durationS: 45, coverageFrom: "Bronte Street", coverageTo: "Main Street", capturedMetres: 400, streetMetres: null }), "Footage is one pass along Anne Boulevard, from Bronte Street to Main Street. Filmed 7 September 2026.");
  expect("no sidecar", S(null), "Footage is one pass along Anne Boulevard. Filmed 7 September 2026.");
  expect("thousands", S({ durationS: 60, coverageFrom: null, coverageTo: null, capturedMetres: 1350, streetMetres: 3070 }), "Footage covers 1,350 m of 3,070 m. Filmed 7 September 2026.");
  expect("night", buildCoverageSentence({ streetName: "First Line", night: true, wall: torontoWall(NIGHT), sidecar: null }), "Footage is one overnight pass along First Line. Filmed 25 August 2026, after dark.");
  expect("no date, no sentence", buildCoverageSentence({ streetName: "X", night: false, wall: null, sidecar: null }), "");
  expect("isoDuration 45", isoDuration(45), "PT45S");
  expect("isoDuration 60", isoDuration(60), "PT1M");
  expect("isoDuration 75", isoDuration(75), "PT1M15S");
  expect("isoDuration 0", isoDuration(0), "PT0S");
}

// ── 3. dated keys, the poster beside the clip, the sidecar under any host ────────────
{
  expect("dated day poster", deriveVideoPoster(`${BASE}/streets/anne-boulevard-milton/20260907/day.mp4`), `${BASE}/streets/anne-boulevard-milton/20260907/poster.webp`);
  expect("dated night poster", deriveVideoPoster(`${BASE}/streets/frost-court-milton/20260825/night.mp4`), `${BASE}/streets/frost-court-milton/20260825/poster.webp`);
  expect("r2 key under r2.dev", r2KeyOf(`${BASE}/streets/anne-boulevard-milton/20260907/day.mp4`), "streets/anne-boulevard-milton/20260907/day.mp4");
  expect("r2 key under a custom host", r2KeyOf("https://video.miltonly.com/streets/anne-boulevard-milton/20260907/day.mp4"), "streets/anne-boulevard-milton/20260907/day.mp4");
  expect("r2 key of a non-URL", r2KeyOf("not a url"), null);

  // a real sidecar entry reaches the clip, the schema, the sitemap and the sentence
  const clips = (sidecar as { clips: Record<string, { durationS: number | null; capturedMetres: number | null; streetMetres: number | null }> }).clips;
  const key = Object.keys(clips).find((k) => clips[k].durationS != null && clips[k].capturedMetres != null && clips[k].streetMetres != null);
  if (key) {
    const entry = clips[key];
    const variant = key.endsWith("night.mp4") ? "night" : "day";
    const view = resolveStreetVideo({
      streetName: "Some Street",
      videoUrl: variant === "day" ? `${BASE}/${key}` : null,
      videoCapturedAt: variant === "day" ? DAY : null,
      nightVideoUrl: variant === "night" ? `${BASE}/${key}` : null,
      nightCapturedAt: variant === "night" ? DAY : null,
    });
    const clip = variant === "day" ? view?.day : view?.night;
    expect(`sidecar duration reaches the clip (${key})`, clip?.durationS, entry.durationS);
    const schema = clip ? (buildVideoObjectSchema(clip) as { duration?: string; description?: string } | null) : null;
    expect("VideoObject.duration from the sidecar", schema?.duration, isoDuration(entry.durationS!));
    expectMatch("sentence states the metres", clip?.coverage ?? "", /^Footage covers [\d,]+ m of [\d,]+ m/);
    expect("VideoObject.description carries the sentence", schema?.description?.includes(clip?.coverage ?? " "), true);
  } else {
    failures.push("  sidecar has no entry with duration and both metres to test against");
  }

  // no sidecar entry: no duration, no VideoObject.duration, a sentence with no extent
  const view = resolveStreetVideo({ streetName: "Nowhere Court", videoUrl: `${BASE}/streets/nowhere-court-milton/20260907/day.mp4`, videoCapturedAt: DAY, nightVideoUrl: null, nightCapturedAt: null });
  expect("no sidecar: durationS null", view?.day?.durationS, null);
  const schema = view?.day ? (buildVideoObjectSchema(view.day) as { duration?: string }) : null;
  expect("no sidecar: VideoObject has no duration key", schema && "duration" in schema, false);
  expect("no sidecar: sentence has no extent", view?.day?.coverage, "Footage is one pass along Nowhere Court. Filmed 7 September 2026.");
  expect("description is the street then the sentence", view?.day?.description, "Nowhere Court, Milton, Ontario. Footage is one pass along Nowhere Court. Filmed 7 September 2026.");
}

// ── 4. the audio gate ────────────────────────────────────────────────────────────────
{
  const ffmpeg = spawnSync("ffmpeg", ["-version"], { encoding: "utf8" });
  if (ffmpeg.error) {
    console.log("test-video-playbook: ffmpeg not on PATH, the audio gate is not exercised here");
  } else {
    const dir = mkdtempSync(path.join(tmpdir(), "miltonly-video-"));
    const silent = path.join(dir, "silent.mp4");
    const withAudio = path.join(dir, "audio.mp4");
    const common = ["-y", "-v", "error", "-f", "lavfi", "-i", "color=c=black:s=64x64:d=1"];
    spawnSync("ffmpeg", [...common, "-an", "-pix_fmt", "yuv420p", silent], { encoding: "utf8" });
    spawnSync("ffmpeg", [...common, "-f", "lavfi", "-i", "anullsrc=r=8000:cl=mono", "-t", "1", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", withAudio], { encoding: "utf8" });
    if (existsSync(silent) && existsSync(withAudio)) {
      expect("silent clip: zero audio streams", probeClip(silent)?.audio, 0);
      expect("clip with a track: one audio stream", probeClip(withAudio)?.audio, 1);
      expect("duration is read from the container", probeClip(silent)?.durationS, 1);
    } else {
      failures.push("  ffmpeg could not write the synthetic clips");
    }
    rmSync(dir, { recursive: true, force: true });
  }
  const upload = readFileSync(path.join(__dirname, "upload-street-videos-r2.ts"), "utf8");
  expect("the upload script refuses on audio", /probe\.audio !== 0/.test(upload) && /refusedAudio/.test(upload), true);
  expect("the upload script refuses on blur", /blur_verified !== true/.test(upload), true);
  expect("the upload script keys by date", /streets\/\$\{fullSlug\}\/\$\{seg\}\/\$\{clipName\}/.test(upload), true);
}

// ── 5. the takedown address ──────────────────────────────────────────────────────────
{
  const view = resolveStreetVideo({ streetName: "X", videoUrl: `${BASE}/streets/x-milton/20260901/day.mp4`, videoCapturedAt: new Date(), nightVideoUrl: null, nightCapturedAt: null });
  expect("takedown address is the config value", view?.takedownEmail, config.video.takedownEmail);
  expectMatch("takedown address is an address", config.video.takedownEmail, /^[^@\s]+@[^@\s]+\.[a-z]+$/);
  const sections = readFileSync(path.join(__dirname, "..", "src", "components", "street", "v2", "sections.tsx"), "utf8");
  expect("the section prints the mailto and the sentence", /mailto:\$\{v\.takedownEmail\}/.test(sections) && /c\.coverage/.test(sections), true);
}

// ── 6. the sidecar on disk ───────────────────────────────────────────────────────────
{
  const clips = (sidecar as { clips: Record<string, { durationS: number | null; coverageFrom: string | null; coverageTo: string | null }> }).clips;
  const keys = Object.keys(clips);
  expect("every sidecar key is dated", keys.filter((k) => !/^streets\/[a-z0-9-]+\/\d{8}\/(day|night)\.mp4$/.test(k)).join(","), "");
  expect("every sidecar entry has a duration", keys.filter((k) => clips[k].durationS == null).join(","), "");
  expect("no entry runs from a street to itself", keys.filter((k) => clips[k].coverageFrom && clips[k].coverageFrom === clips[k].coverageTo).join(","), "");
}

// ── 7. the sitemap index ─────────────────────────────────────────────────────────────
{
  const index = readFileSync(path.join(__dirname, "..", "src", "app", "sitemap-index.xml", "route.ts"), "utf8");
  expect("the index names both files", /\/sitemap\.xml</.test(index) && /\/sitemap-video\.xml</.test(index), true);
  const robots = readFileSync(path.join(__dirname, "..", "src", "app", "robots.ts"), "utf8");
  expect("robots names the index", /sitemap-index\.xml/.test(robots), true);
}

if (failures.length > 0) {
  console.error(`test-video-playbook: ${failures.length} failure(s) of ${assertions}`);
  for (const f of failures) console.error(f);
  process.exit(1);
}
console.log(`test-video-playbook: PASS (${assertions} assertions)`);

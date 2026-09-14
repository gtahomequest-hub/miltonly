// scripts/test-video-playbook.ts
//
// MC-015, the video playbook adoptions, held in the prebuild:
//
//   1. THE OFFSET TRAVELS WITH THE TIMESTAMP. A 9:40 pm capture in Milton is the next day in
//      UTC. With the offset the caption, the uploadDate and the local hour all read the wall
//      clock the clip was shot under; with a null offset (a pre-backfill row holding UTC
//      midnight) they read UTC, which is that row's wall clock. Either way the date is the
//      shot date, and a night clip's local hour is checkable.
//   2. THE COVERAGE SENTENCE NEVER SAYS MORE THAN ITS SOURCES. No sidecar entry: the pass
//      length is not stated. Endpoints only when both are recorded. Metres only when both are.
//   3. DATED KEYS carry their own poster; the sidecar is looked up by R2 key under any host.
//   4. THE UPLOAD GATE refuses an audio stream: probeClip counts them on the bytes, and a
//      synthetic clip with a silent audio track is refused while the same clip without one
//      passes. Skipped, and said so, when ffmpeg is not on PATH; ffprobe absent is itself a
//      refusal of the run in the upload script.
//   5. THE TAKEDOWN ADDRESS is one config value, on every view.
//   6. THE SIDECAR on disk is keyed by dated R2 keys only, and every entry has a duration.

import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  resolveStreetVideo,
  buildCoverageSentence,
  deriveVideoPoster,
  r2KeyOf,
  isoDuration,
  wallClock,
  uploadDateOf,
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
const NIGHT = new Date("2026-08-26T01:40:00Z"); // 9:40 pm on 25 August in Milton (EDT, -240)

// ── 1. the offset ────────────────────────────────────────────────────────────────────
{
  const wall = wallClock(NIGHT, -240);
  expect("wall clock date under -240", wall?.toISOString().slice(0, 16), "2026-08-25T21:40");
  expect("wall clock with a null offset is the instant", wallClock(NIGHT, null)?.getTime(), NIGHT.getTime());
  expect("uploadDate with offset", uploadDateOf(NIGHT, -240), "2026-08-25T21:40:00-04:00");
  expect("uploadDate with null offset is the bare UTC date", uploadDateOf(new Date("2026-08-25T00:00:00Z"), null), "2026-08-25");
  expect("uploadDate positive offset", uploadDateOf(new Date("2026-08-25T00:10:00Z"), 330), "2026-08-25T05:40:00+05:30");

  const view = resolveStreetVideo({
    streetName: "Frost Court",
    videoUrl: null,
    videoCapturedAt: null,
    nightVideoUrl: `${BASE}/streets/frost-court-milton/20260825/night.mp4`,
    nightCapturedAt: NIGHT,
    nightCapturedOffsetMin: -240,
  });
  expect("night caption reads the wall clock date", view?.night?.caption, "Overnight · Captured 25 August 2026");
  expect("night local hour", view?.night?.localHour, 21);
  expect("night uploadDate", view?.night?.uploadDate, "2026-08-25T21:40:00-04:00");
  expectMatch("night coverage sentence names the time", view?.night?.coverage ?? "", /Filmed 25 August 2026 at 9:40 pm\.$/);

  // the same instant with the offset missing is the UTC date: 26 August. That is why the
  // backfill exists; the resolver does not guess an offset it was not given.
  const bare = resolveStreetVideo({
    streetName: "Frost Court",
    videoUrl: null,
    videoCapturedAt: null,
    nightVideoUrl: `${BASE}/streets/frost-court-milton/20260825/night.mp4`,
    nightCapturedAt: NIGHT,
  });
  expect("null offset reads UTC, no guessing", bare?.night?.caption, "Overnight · Captured 26 August 2026");
}

// ── 2. the coverage sentence ─────────────────────────────────────────────────────────
{
  const wall = new Date("2026-09-07T11:20:31Z"); // already shifted
  expect(
    "no sidecar: no length, no extent",
    buildCoverageSentence({ streetName: "Anne Boulevard", night: false, wall, offsetKnown: true, sidecar: null }),
    "A daytime pass along Anne Boulevard. Filmed 7 September 2026 at 11:20 am.",
  );
  expect(
    "duration only",
    buildCoverageSentence({ streetName: "Anne Boulevard", night: false, wall, offsetKnown: true, sidecar: { durationS: 45, coverageFrom: null, coverageTo: null, capturedMetres: null, streetMetres: null } }),
    "A 45-second daytime pass along Anne Boulevard. Filmed 7 September 2026 at 11:20 am.",
  );
  expect(
    "one endpoint is no endpoint",
    buildCoverageSentence({ streetName: "Anne Boulevard", night: false, wall, offsetKnown: true, sidecar: { durationS: 45, coverageFrom: "Main Street", coverageTo: null, capturedMetres: null, streetMetres: null } }),
    "A 45-second daytime pass along Anne Boulevard. Filmed 7 September 2026 at 11:20 am.",
  );
  expect(
    "both endpoints",
    buildCoverageSentence({ streetName: "Anne Boulevard", night: false, wall, offsetKnown: true, sidecar: { durationS: 45, coverageFrom: "Main Street", coverageTo: "Thompson Road", capturedMetres: null, streetMetres: null } }),
    "A 45-second daytime pass along Anne Boulevard, from Main Street to Thompson Road. Filmed 7 September 2026 at 11:20 am.",
  );
  expect(
    "metres only with both",
    buildCoverageSentence({ streetName: "Anne Boulevard", night: false, wall, offsetKnown: true, sidecar: { durationS: 75, coverageFrom: "Main Street", coverageTo: "Thompson Road", capturedMetres: 480, streetMetres: 1240 } }),
    "A 1-minute 15-second daytime pass along Anne Boulevard, from Main Street to Thompson Road, covering 480 m of the street's 1,240 m. Filmed 7 September 2026 at 11:20 am.",
  );
  expect(
    "captured metres without street metres is not a fraction",
    buildCoverageSentence({ streetName: "Anne Boulevard", night: true, wall: new Date("2026-08-25T21:40:00Z"), offsetKnown: false, sidecar: { durationS: 60, coverageFrom: null, coverageTo: null, capturedMetres: 480, streetMetres: null } }),
    "An overnight 1-minute pass along Anne Boulevard. Filmed 25 August 2026.",
  );
  expect("no date, no sentence", buildCoverageSentence({ streetName: "X", night: false, wall: null, offsetKnown: false, sidecar: null }), "");
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

  // a real sidecar entry reaches the clip, the schema and the sentence
  const entries = Object.entries((sidecar as { clips: Record<string, { durationS: number | null }> }).clips);
  const [key, entry] = entries[0] ?? ["", { durationS: null }];
  if (key && entry.durationS != null) {
    const slug = key.split("/")[1];
    const variant = key.endsWith("night.mp4") ? "night" : "day";
    const view = resolveStreetVideo({
      streetName: "Some Street",
      videoUrl: variant === "day" ? `${BASE}/${key}` : null,
      videoCapturedAt: variant === "day" ? new Date("2026-09-07T15:20:31Z") : null,
      videoCapturedOffsetMin: -240,
      nightVideoUrl: variant === "night" ? `${BASE}/${key}` : null,
      nightCapturedAt: variant === "night" ? new Date("2026-09-07T15:20:31Z") : null,
      nightCapturedOffsetMin: -240,
    });
    const clip = variant === "day" ? view?.day : view?.night;
    expect(`sidecar duration reaches the clip (${slug})`, clip?.durationS, entry.durationS);
    const schema = clip ? (buildVideoObjectSchema(clip) as { duration?: string } | null) : null;
    expect("VideoObject.duration from the sidecar", schema?.duration, isoDuration(entry.durationS));
    expectMatch("sentence states the length", clip?.coverage ?? "", new RegExp(`^A(n overnight)? .*second|minute`));
  } else {
    failures.push("  sidecar has no entry with a duration to test against");
  }

  // no sidecar entry: no duration, no VideoObject.duration, a sentence with no length
  const view = resolveStreetVideo({
    streetName: "Nowhere Court",
    videoUrl: `${BASE}/streets/nowhere-court-milton/20260907/day.mp4`,
    videoCapturedAt: new Date("2026-09-07T15:20:31Z"),
    videoCapturedOffsetMin: -240,
    nightVideoUrl: null,
    nightCapturedAt: null,
  });
  expect("no sidecar: durationS null", view?.day?.durationS, null);
  const schema = view?.day ? (buildVideoObjectSchema(view.day) as { duration?: string }) : null;
  expect("no sidecar: VideoObject has no duration key", schema && "duration" in schema, false);
  expect("no sidecar: sentence has no length", view?.day?.coverage, "A daytime pass along Nowhere Court. Filmed 7 September 2026 at 11:20 am.");
  expect("description is the sentence in Milton", view?.day?.description, "A daytime pass along Nowhere Court. Filmed 7 September 2026 at 11:20 am, in Milton, Ontario.");
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
}

// ── 5. the takedown address ──────────────────────────────────────────────────────────
{
  const view = resolveStreetVideo({ streetName: "X", videoUrl: `${BASE}/streets/x-milton/20260901/day.mp4`, videoCapturedAt: new Date(), nightVideoUrl: null, nightCapturedAt: null });
  expect("takedown address is the config value", view?.takedownEmail, config.video.takedownEmail);
  expectMatch("takedown address is an address", config.video.takedownEmail, /^[^@\s]+@[^@\s]+\.[a-z]+$/);
}

// ── 6. the sidecar on disk ───────────────────────────────────────────────────────────
{
  const clips = (sidecar as { clips: Record<string, { durationS: number | null }> }).clips;
  const keys = Object.keys(clips);
  const undated = keys.filter((k) => !/^streets\/[a-z0-9-]+\/\d{8}\/(day|night)\.mp4$/.test(k));
  expect("every sidecar key is dated", undated.join(","), "");
  const noDuration = keys.filter((k) => clips[k].durationS == null);
  expect("every sidecar entry has a duration", noDuration.join(","), "");
}

if (failures.length > 0) {
  console.error(`test-video-playbook: ${failures.length} failure(s) of ${assertions}`);
  for (const f of failures) console.error(f);
  process.exit(1);
}
console.log(`test-video-playbook: PASS (${assertions} assertions)`);

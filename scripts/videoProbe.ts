// scripts/videoProbe.ts
//
// ffprobe on a clip's bytes, shared by the upload gate (scripts/upload-street-videos-r2.ts)
// and the sidecar builder (scripts/backfill-video-captured.ts). One reading of the file for
// both facts the pipeline needs from it: how long it is, and whether it carries an audio
// stream. Returns null when ffprobe is not on PATH; the callers decide what that means (the
// upload refuses the run, the backfill falls back to meta and says so).

import { spawnSync } from "node:child_process";

export interface ClipProbe {
  /** Container duration, rounded to whole seconds. 0 when ffprobe reports none. */
  durationS: number;
  /** Audio streams in the container. The upload gate refuses anything above 0. */
  audio: number;
}

export function probeClip(file: string): ClipProbe | null {
  const r = spawnSync(
    "ffprobe",
    ["-v", "error", "-show_entries", "format=duration:stream=codec_type", "-of", "json", file],
    { encoding: "utf8" },
  );
  if (r.error && (r.error as NodeJS.ErrnoException).code === "ENOENT") return null;
  if (r.error || r.status !== 0) throw new Error(`ffprobe failed on ${file}: ${r.stderr || String(r.error)}`);
  const j = JSON.parse(r.stdout) as { format?: { duration?: string }; streams?: Array<{ codec_type: string }> };
  const durationS = Number(j.format?.duration);
  return {
    durationS: Number.isFinite(durationS) ? Math.round(durationS) : 0,
    audio: (j.streams ?? []).filter((s) => s.codec_type === "audio").length,
  };
}

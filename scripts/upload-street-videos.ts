// scripts/upload-street-videos.ts
//
// Uploads a street's daylight clip + poster to Vercel Blob and sets videoUrl +
// videoCapturedAt on its StreetContent row. Idempotent: re-running overwrites the same
// Blob pathnames and re-sets the same columns.
//
//   videos:   D:/dashcam/work/web/<slug>.mp4        (~7MB, 1280w, faststart, no audio)
//   posters:  D:/dashcam/work/posters/<slug>.webp   (extracted poster frame)
//   dates:    D:/dashcam/work/clips3/clips.csv       (capture date is in the `file` column
//                                                     filename: <slug>_YYYYMMDD-HHMMSS.mp4)
//
// The Blob pathname is deterministic — street-videos/<slug>-milton.{mp4,webp}, no random
// suffix — so the poster URL is exactly deriveVideoPoster(videoUrl) (.mp4 -> .webp). The
// script asserts that equality before writing the DB, so a page can never point <video
// poster> / VideoObject.thumbnailUrl at a 404.
//
// Usage:
//   npx tsx scripts/upload-street-videos.ts lemieux-court        # one street
//   npx tsx scripts/upload-street-videos.ts                      # all clips in web/
//
// Slugs are the bare file basenames (no "-milton"); the StreetContent row is <slug>-milton.

import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { put } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { deriveVideoPoster } from "@/lib/streetVideo";

const WEB_DIR = "D:/dashcam/work/web";
const POSTER_DIR = "D:/dashcam/work/posters";
const CLIPS_CSV = "D:/dashcam/work/clips3/clips.csv";
const BLOB_PREFIX = "street-videos";
const SLUG_SUFFIX = "-milton";

/** Blob token lives in .env.local (Next loads it; a bare tsx script does not). Read it
 *  directly and pass it to put(); never log it. */
function loadBlobToken(): string {
  const raw = readFileSync(path.join(process.cwd(), ".env.local"), "utf8");
  const m = raw.match(/^\s*BLOB_READ_WRITE_TOKEN\s*=\s*(.+)\s*$/m);
  if (!m) throw new Error("BLOB_READ_WRITE_TOKEN not found in .env.local");
  return m[1].trim().replace(/^["']|["']$/g, "");
}

/** slug -> capture date (UTC midnight of the calendar date in the clip filename). */
function loadCaptureDates(): Map<string, Date> {
  const rows = readFileSync(CLIPS_CSV, "utf8").split(/\r?\n/).filter(Boolean);
  const header = rows.shift()!.split(",");
  const slugIdx = header.indexOf("slug");
  const fileIdx = header.indexOf("file");
  const dates = new Map<string, Date>();
  for (const line of rows) {
    const cols = line.split(",");
    const slug = cols[slugIdx]?.trim();
    const file = cols[fileIdx]?.trim();
    if (!slug || !file) continue;
    const m = file.match(/_(\d{4})(\d{2})(\d{2})-\d{6}/);
    if (!m) continue;
    dates.set(slug, new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))));
  }
  return dates;
}

interface Result {
  slug: string;
  streetSlug: string;
  videoUrl?: string;
  capturedAt?: string;
  rowsUpdated?: number;
  error?: string;
}

async function uploadOne(bareSlug: string, captureDates: Map<string, Date>, token: string): Promise<Result> {
  const streetSlug = `${bareSlug}${SLUG_SUFFIX}`;
  const videoPath = path.join(WEB_DIR, `${bareSlug}.mp4`);
  const posterPath = path.join(POSTER_DIR, `${bareSlug}.webp`);
  const capturedAt = captureDates.get(bareSlug);
  if (!capturedAt) return { slug: bareSlug, streetSlug, error: `no capture date in clips.csv` };

  let videoBuf: Buffer;
  let posterBuf: Buffer;
  try {
    videoBuf = readFileSync(videoPath);
    posterBuf = readFileSync(posterPath);
  } catch (e) {
    return { slug: bareSlug, streetSlug, error: `missing file: ${(e as Error).message}` };
  }

  const common = { access: "public" as const, addRandomSuffix: false, allowOverwrite: true, token };
  const video = await put(`${BLOB_PREFIX}/${streetSlug}.mp4`, videoBuf, { ...common, contentType: "video/mp4", multipart: true });
  const poster = await put(`${BLOB_PREFIX}/${streetSlug}.webp`, posterBuf, { ...common, contentType: "image/webp" });

  // The whole poster convention rests on this equality. Fail loud rather than publish a
  // <video poster> / thumbnailUrl that resolves to nothing.
  const derived = deriveVideoPoster(video.url);
  if (derived !== poster.url) {
    return { slug: bareSlug, streetSlug, error: `poster convention broke: derived ${derived} !== uploaded ${poster.url}` };
  }

  const upd = await prisma.streetContent.updateMany({
    where: { streetSlug },
    data: { videoUrl: video.url, videoCapturedAt: capturedAt },
  });

  return {
    slug: bareSlug,
    streetSlug,
    videoUrl: video.url,
    capturedAt: capturedAt.toISOString().slice(0, 10),
    rowsUpdated: upd.count,
  };
}

async function main() {
  const token = loadBlobToken();
  const captureDates = loadCaptureDates();

  const argSlugs = process.argv.slice(2).map((s) => s.trim()).filter(Boolean);
  const targets =
    argSlugs.length > 0
      ? argSlugs
      : readdirSync(WEB_DIR)
          .filter((f) => f.toLowerCase().endsWith(".mp4"))
          .map((f) => f.slice(0, -4))
          .sort();

  console.log(`Uploading ${targets.length} street(s): ${targets.join(", ")}\n`);

  const results: Result[] = [];
  for (const slug of targets) {
    process.stdout.write(`• ${slug} … `);
    try {
      const r = await uploadOne(slug, captureDates, token);
      results.push(r);
      console.log(r.error ? `ERROR: ${r.error}` : `ok (${r.capturedAt}, ${r.rowsUpdated} row) ${r.videoUrl}`);
    } catch (e) {
      results.push({ slug, streetSlug: `${slug}${SLUG_SUFFIX}`, error: (e as Error).message });
      console.log(`ERROR: ${(e as Error).message}`);
    }
  }

  const ok = results.filter((r) => !r.error && r.rowsUpdated === 1);
  const warnNoRow = results.filter((r) => !r.error && r.rowsUpdated !== 1);
  const failed = results.filter((r) => r.error);
  console.log(`\nDone: ${ok.length} ok, ${warnNoRow.length} uploaded-but-no-matching-row, ${failed.length} failed.`);
  for (const r of warnNoRow) console.log(`  ! ${r.streetSlug}: uploaded but updated ${r.rowsUpdated} rows (StreetContent row missing?)`);
  for (const r of failed) console.log(`  ✗ ${r.slug}: ${r.error}`);

  await prisma.$disconnect();
  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});

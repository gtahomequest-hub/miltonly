// scripts/upload-street-videos-r2.ts
//
// Uploads street dashcam clips and their poster frames to Cloudflare R2 over the S3 API, then
// sets StreetContent.videoUrl and videoCapturedAt to the public R2 URLs.
//
// REPLACES scripts/upload-street-videos.ts, which put the same assets in Vercel Blob. Blob was a
// proof of concept for one street; R2 is where the corpus lives now.
//
// KEY LAYOUT, and why the poster is .webp
//   streets/<slug>/day.mp4
//   streets/<slug>/poster.webp
// The brief asked for poster.jpg, but every staged poster in D:/dashcam/work/posters5 is a .webp
// and always has been, so .jpg would have been a name that lied about the bytes. The render layer
// derives the poster URL from the video URL (deriveVideoPoster in src/lib/streetVideo.ts) rather
// than storing it, so that function had to learn this layout: there is no poster column to write.
//
// IDEMPOTENT: a HEAD on the key first. Same size means skip, so a re-run is free and cannot
// duplicate. Size rather than ETag because R2 computes multipart ETags differently from a local
// md5, and a false mismatch would re-upload 36 MB for nothing.
//
// CAPTURE DATE comes from the clip filename in D:/dashcam/work/clips5/clips.csv
// (<slug>_YYYYMMDD-HHMMSS.mp4), which is the ingest's own record of when the footage was shot.
// Never today's date: videoCapturedAt is a claim about the world, and the page prints it.
//
// Usage:
//   npx tsx scripts/upload-street-videos-r2.ts                     # dry run, prints the plan
//   npx tsx scripts/upload-street-videos-r2.ts --write             # upload + set columns
//   npx tsx scripts/upload-street-videos-r2.ts --write --only=lemieux-court

import { readFileSync } from "node:fs";
import { statSync } from "node:fs";
import path from "node:path";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { S3Client, HeadObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { neon } from "@neondatabase/serverless";

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

const WEB_DIR = "D:/dashcam/work/web5";
const POSTER_DIR = "D:/dashcam/work/posters5";
const CLIPS_CSV = "D:/dashcam/work/clips5/clips.csv";
const SLUG_SUFFIX = "-milton";

const SLUGS = [
  "lemieux-court", "frost-court", "mulroney-heights", "locker-place", "clifford-point",
  "chretien-street", "heaven-crescent", "tasker-court", "shade-lane",
];

const {
  R2_ACCOUNT_ID = "", R2_ACCESS_KEY_ID = "", R2_SECRET_ACCESS_KEY = "",
  R2_BUCKET = "", R2_PUBLIC_BASE_URL = "", DATABASE_URL = "",
} = process.env;

for (const [k, v] of Object.entries({ R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_BASE_URL, DATABASE_URL })) {
  if (!v) { console.error(`Missing ${k} in .env.local`); process.exit(1); }
}

const WRITE = process.argv.includes("--write");
const onlyArg = process.argv.find((a) => a.startsWith("--only="));
const ONLY = onlyArg ? onlyArg.split("=")[1].split(",").map((s) => s.trim()).filter(Boolean) : null;

const db = neon(DATABASE_URL);
const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
});

/** Capture instant from the ingest's own filename, <slug>_YYYYMMDD-HHMMSS.mp4. */
function captureDates(): Map<string, Date> {
  const out = new Map<string, Date>();
  const rows = readFileSync(CLIPS_CSV, "utf8").split(/\r?\n/).slice(1);
  for (const line of rows) {
    if (!line.trim()) continue;
    const cols = line.split(",");
    const slug = cols[0]?.trim();
    const file = cols[2]?.trim();
    if (!slug || !file || out.has(slug)) continue;
    const m = file.match(/_(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})\./);
    if (!m) continue;
    const [, y, mo, d] = m;
    // UTC MIDNIGHT OF THE SHOT DATE, not the shot instant. The filename timestamp is local, and
    // the page renders *CapturedAt in UTC, so an evening capture parsed as a local instant lands
    // on the following UTC day and the caption reads a day late: frost-court_20260825-201913
    // displayed as 26 August. The claim we are making is a calendar date, so store one.
    out.set(slug, new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d))));
  }
  return out;
}

async function existingSize(key: string): Promise<number | null> {
  try {
    const r = await s3.send(new HeadObjectCommand({ Bucket: R2_BUCKET, Key: key }));
    return typeof r.ContentLength === "number" ? r.ContentLength : null;
  } catch {
    return null;
  }
}

async function putIfChanged(key: string, file: string, contentType: string) {
  const size = statSync(file).size;
  const have = await existingSize(key);
  if (have === size) return { key, size, action: "skip" as const };
  if (!WRITE) return { key, size, action: have === null ? "upload" as const : "replace" as const };
  await s3.send(new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    Body: readFileSync(file),
    ContentType: contentType,
    // Immutable: the key is per-street and the bytes for a given capture never change. A new
    // capture would be a new clip, and the URL is what the page caches against.
    CacheControl: "public, max-age=31536000, immutable",
  }));
  return { key, size, action: have === null ? "uploaded" as const : "replaced" as const };
}

async function main() {
  const dates = captureDates();
  const targets = SLUGS.filter((s) => !ONLY || ONLY.includes(s));
  console.log(`${WRITE ? "WRITE" : "DRY RUN"} · ${targets.length} street(s) · bucket ${R2_BUCKET}`);
  console.log(`public base ${R2_PUBLIC_BASE_URL}`);
  console.log("");

  for (const slug of targets) {
    const full = slug + SLUG_SUFFIX;
    const mp4 = path.join(WEB_DIR, `${slug}.mp4`);
    const poster = path.join(POSTER_DIR, `${slug}.webp`);
    const captured = dates.get(slug);
    if (!captured) { console.log(`${full.padEnd(26)} SKIP — no capture date in clips.csv`); continue; }

    const v = await putIfChanged(`streets/${full}/day.mp4`, mp4, "video/mp4");
    const p = await putIfChanged(`streets/${full}/poster.webp`, poster, "image/webp");
    const videoUrl = `${R2_PUBLIC_BASE_URL}/${v.key}`;

    if (WRITE) {
      await db`
        UPDATE public."StreetContent"
        SET "videoUrl" = ${videoUrl}, "videoCapturedAt" = ${captured.toISOString()}
        WHERE "streetSlug" = ${full}
      `;
    }

    console.log(`${full.padEnd(26)} ${v.action.padEnd(8)} mp4 ${String(v.size).padStart(8)}B  ` +
      `${p.action.padEnd(8)} poster ${String(p.size).padStart(6)}B  captured ${captured.toISOString().slice(0, 10)}`);
    console.log(`${" ".repeat(26)} ${videoUrl}`);
  }

  if (!WRITE) console.log("\ndry run — pass --write to upload and set the columns.");
}

main().catch((e) => {
  console.error("FATAL", e instanceof Error ? e.message : String(e));
  process.exit(1);
});

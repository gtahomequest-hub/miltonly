// scripts/wire-video-from-published.ts
//
// Sets StreetContent.videoUrl / videoCapturedAt (or the night pair) from D:/dashcam/published,
// for streets whose clip is already in R2 but whose row was not there when the upload ran.
//
// The upload script sets the columns as it goes, but it can only set them on a row that exists.
// A slug uploaded before its page was generated therefore has assets in the bucket and nothing
// pointing at them. That was 11 slugs after the first run and 2 after the second; this closes the
// gap without re-uploading a byte.
//
// Only writes where the row exists AND the relevant column is null or stale, so it is safe to run
// repeatedly and will not overwrite a pointer the upload script set to something newer.
//
// Usage:
//   npx tsx --tsconfig tsconfig.test.json scripts/wire-video-from-published.ts          # dry run
//   npx tsx --tsconfig tsconfig.test.json scripts/wire-video-from-published.ts --write

import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { S3Client, HeadObjectCommand } from "@aws-sdk/client-s3";
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

const PUBLISHED = "D:/dashcam/published";
const SLUG_SUFFIX = "-milton";
const { R2_ACCOUNT_ID = "", R2_ACCESS_KEY_ID = "", R2_SECRET_ACCESS_KEY = "", R2_BUCKET = "", R2_PUBLIC_BASE_URL = "", DATABASE_URL = "" } = process.env;
const WRITE = process.argv.includes("--write");
const onlyArg = process.argv.find((a) => a.startsWith("--only="));
const ONLY = onlyArg ? onlyArg.split("=")[1].split(",").map((s) => s.trim()).filter(Boolean) : null;

const db = neon(DATABASE_URL);
const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
});

async function inBucket(key: string): Promise<boolean> {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: R2_BUCKET, Key: key }));
    return true;
  } catch {
    return false;
  }
}

function capturedUtcMidnight(iso: string): Date {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) throw new Error(`unparseable captured_at: ${iso}`);
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

async function main() {
  console.log(`${WRITE ? "WRITE" : "DRY RUN"}\n`);
  let wired = 0;
  let already = 0;
  let noRow = 0;

  for (const slug of readdirSync(PUBLISHED).sort()) {
    if (ONLY && !ONLY.includes(slug)) continue;
    const dir = path.join(PUBLISHED, slug);
    if (!statSync(dir).isDirectory()) continue;
    const metaPath = path.join(dir, "meta.json");
    if (!existsSync(metaPath)) continue;
    const meta = JSON.parse(readFileSync(metaPath, "utf8")) as Record<string, unknown>;

    const full = slug + SLUG_SUFFIX;
    const night = meta.night === true;
    const clipKey = `streets/${full}/${night ? "night.mp4" : "day.mp4"}`;
    const posterKey = `streets/${full}/poster.webp`;
    if (!(await inBucket(clipKey))) { console.log(`${full.padEnd(30)} clip not in bucket, skipped`); continue; }
    if (!(await inBucket(posterKey))) { console.log(`${full.padEnd(30)} poster not in bucket, skipped`); continue; }

    const rows = (await db`SELECT "status", "videoUrl", "nightVideoUrl" FROM public."StreetContent" WHERE "streetSlug" = ${full}`) as Array<Record<string, unknown>>;
    if (rows.length === 0) { noRow++; console.log(`${full.padEnd(30)} NO StreetContent row`); continue; }

    const url = `${R2_PUBLIC_BASE_URL}/${clipKey}`;
    const current = night ? rows[0].nightVideoUrl : rows[0].videoUrl;
    if (current === url) { already++; continue; }

    if (WRITE) {
      const captured = capturedUtcMidnight(String(meta.captured_at)).toISOString();
      if (night) {
        await db`UPDATE public."StreetContent" SET "nightVideoUrl" = ${url}, "nightCapturedAt" = ${captured} WHERE "streetSlug" = ${full}`;
      } else {
        await db`UPDATE public."StreetContent" SET "videoUrl" = ${url}, "videoCapturedAt" = ${captured} WHERE "streetSlug" = ${full}`;
      }
    }
    wired++;
    console.log(`${full.padEnd(30)} ${night ? "night" : "day  "} wired -> ${url}`);
  }

  console.log(`\nwired: ${wired}   already correct: ${already}   no StreetContent row: ${noRow}`);
  if (!WRITE) console.log("dry run — pass --write.");
}

main().catch((e) => {
  console.error("FATAL", e instanceof Error ? e.message : String(e));
  process.exit(1);
});

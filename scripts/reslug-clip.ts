// scripts/reslug-clip.ts
//
// Move a clip's R2 objects from a slug that does not exist onto the registry slug its GPS trace
// actually matches, then point the page at them. Copy, wire, VERIFY ON PRODUCTION, and only then
// delete the originals — the delete is last because it is the only irreversible step, and a
// pointer that has not yet been observed serving is not a pointer you can safely orphan.
//
// Usage:
//   npx tsx --tsconfig tsconfig.test.json scripts/reslug-clip.ts <from-slug> <to-slug>            # dry run
//   npx tsx --tsconfig tsconfig.test.json scripts/reslug-clip.ts <from-slug> <to-slug> --write    # copy + wire
//   npx tsx --tsconfig tsconfig.test.json scripts/reslug-clip.ts <from-slug> <to-slug> --delete-old
//        (delete-old refuses unless the new URL is already being served by production)

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { S3Client, HeadObjectCommand, CopyObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
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

const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const WRITE = process.argv.includes("--write");
const DELETE_OLD = process.argv.includes("--delete-old");
const [FROM, TO] = args;
if (!FROM || !TO) { console.error("usage: reslug-clip <from-slug> <to-slug> [--write|--delete-old]"); process.exit(1); }

const db = neon(DATABASE_URL);
const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
});

async function sizeOf(key: string): Promise<number | null> {
  try {
    const r = await s3.send(new HeadObjectCommand({ Bucket: R2_BUCKET, Key: key }));
    return r.ContentLength ?? null;
  } catch {
    return null;
  }
}

function capturedUtcMidnight(iso: string): Date {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) throw new Error(`unparseable captured_at: ${iso}`);
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

async function copyKey(from: string, to: string, contentType: string) {
  const src = await sizeOf(from);
  if (src === null) throw new Error(`source missing: ${from}`);
  const already = await sizeOf(to);
  if (already === src) return { action: "already there", size: src };
  await s3.send(new CopyObjectCommand({
    Bucket: R2_BUCKET, CopySource: `${R2_BUCKET}/${from}`, Key: to,
    ContentType: contentType, CacheControl: "public, max-age=31536000, immutable",
    MetadataDirective: "REPLACE",
  }));
  const got = await sizeOf(to);
  if (got !== src) throw new Error(`copy size ${got} != source ${src} for ${to}`);
  return { action: "copied", size: src };
}

async function main() {
  const metaPath = path.join(PUBLISHED, FROM, "meta.json");
  if (!existsSync(metaPath)) throw new Error(`no published/${FROM}/meta.json`);
  const meta = JSON.parse(readFileSync(metaPath, "utf8")) as Record<string, unknown>;
  const night = meta.night === true;
  const clipName = night ? "night.mp4" : "day.mp4";

  const fromFull = FROM + SLUG_SUFFIX;
  const toFull = TO.endsWith(SLUG_SUFFIX) ? TO : TO + SLUG_SUFFIX;
  const fromClip = `streets/${fromFull}/${clipName}`;
  const fromPoster = `streets/${fromFull}/poster.webp`;
  const toClip = `streets/${toFull}/${clipName}`;
  const toPoster = `streets/${toFull}/poster.webp`;
  const toUrl = `${R2_PUBLIC_BASE_URL}/${toClip}`;

  const rows = (await db`SELECT "status", "videoUrl", "nightVideoUrl" FROM public."StreetContent" WHERE "streetSlug" = ${toFull}`) as Array<Record<string, unknown>>;
  console.log(`${FROM} -> ${toFull}   variant ${night ? "night" : "day"}`);
  console.log(`  from   ${fromClip}  (${await sizeOf(fromClip)}B)`);
  console.log(`  to     ${toClip}    (${await sizeOf(toClip)})`);
  console.log(`  target page: ${rows.length ? rows[0].status : "NO StreetContent row"}  current video: ${rows[0]?.videoUrl ?? rows[0]?.nightVideoUrl ?? "none"}`);

  if (DELETE_OLD) {
    // Refuse unless production is actually serving the new URL. The delete is the irreversible
    // step and the whole point of ordering it last.
    const html = await fetch(`https://miltonly.com/streets/${toFull}`).then((r) => r.text()).catch(() => "");
    if (!html.includes(toClip)) throw new Error(`refusing to delete: production is not serving ${toClip} on /streets/${toFull}`);
    for (const k of [fromClip, fromPoster]) {
      if ((await sizeOf(k)) === null) { console.log(`  ${k} already gone`); continue; }
      await s3.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: k }));
      console.log(`  deleted ${k}`);
    }
    return;
  }

  if (!WRITE) { console.log("\ndry run — pass --write to copy and wire."); return; }

  console.log(`  clip   ${JSON.stringify(await copyKey(fromClip, toClip, "video/mp4"))}`);
  console.log(`  poster ${JSON.stringify(await copyKey(fromPoster, toPoster, "image/webp"))}`);

  if (rows.length === 0) {
    console.log("  no StreetContent row — objects copied, columns not set");
  } else {
    const captured = capturedUtcMidnight(String(meta.captured_at)).toISOString();
    if (night) {
      await db`UPDATE public."StreetContent" SET "nightVideoUrl" = ${toUrl}, "nightCapturedAt" = ${captured} WHERE "streetSlug" = ${toFull}`;
    } else {
      await db`UPDATE public."StreetContent" SET "videoUrl" = ${toUrl}, "videoCapturedAt" = ${captured} WHERE "streetSlug" = ${toFull}`;
    }
    console.log(`  ${night ? "nightVideoUrl" : "videoUrl"} set -> ${toUrl}`);
  }

  meta.r2_key = toClip;
  meta.poster_r2_key = toPoster;
  meta.matched_slug = toFull;
  meta.reslugged_from = fromFull;
  meta.reslugged_at = new Date().toISOString().slice(0, 10);
  writeFileSync(metaPath, JSON.stringify(meta, null, 2) + "\n", "utf8");
  console.log("  meta.json updated");
}

main().catch((e) => { console.error("FATAL", e instanceof Error ? e.message : String(e)); process.exit(1); });

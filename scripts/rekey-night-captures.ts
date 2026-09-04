// scripts/rekey-night-captures.ts
//
// Three clips shipped on 2026-09-03 under streets/<slug>-milton/day.mp4 that are night captures.
// meta.night is true for all three and always was; the upload script of the day had no notion of
// a night variant, so it wrote every clip to the day key and every pointer to videoUrl.
//
// The page prints "Captured 25 August 2026" under a daylight framing and the VideoObject
// describes "A daytime video tour". Both are false for footage shot at 20:19. This moves the
// bytes and the pointer to where they belong.
//
// ORDER MATTERS. Copy first, repoint second, delete last. A delete before the repoint leaves the
// live page pointing at a key that no longer exists, and the street pages are cached for an hour,
// so the gap would be visible. Copy is server-side within the bucket, so no bytes leave R2.
//
// The poster is NOT touched: there is one poster.webp per street and both variants share it.
// deriveVideoPoster learned "/night.mp4" in the same change that added this script.
//
// Usage:
//   npx tsx --tsconfig tsconfig.test.json scripts/rekey-night-captures.ts          # dry run
//   npx tsx --tsconfig tsconfig.test.json scripts/rekey-night-captures.ts --write

import { readFileSync, existsSync, writeFileSync } from "node:fs";
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

const DASHCAM = "D:/dashcam";
const PUBLISHED = path.join(DASHCAM, "published");
const SLUG_SUFFIX = "-milton";
const SLUGS = ["chretien-street", "clifford-point", "frost-court"];

const {
  R2_ACCOUNT_ID = "", R2_ACCESS_KEY_ID = "", R2_SECRET_ACCESS_KEY = "",
  R2_BUCKET = "", R2_PUBLIC_BASE_URL = "", DATABASE_URL = "",
} = process.env;
const WRITE = process.argv.includes("--write");

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

async function main() {
  console.log(`${WRITE ? "WRITE" : "DRY RUN"} · ${SLUGS.length} street(s) · bucket ${R2_BUCKET}\n`);
  const touched: string[] = [];

  for (const slug of SLUGS) {
    const full = slug + SLUG_SUFFIX;
    const dayKey = `streets/${full}/day.mp4`;
    const nightKey = `streets/${full}/night.mp4`;
    const metaPath = path.join(PUBLISHED, slug, "meta.json");

    const daySize = await sizeOf(dayKey);
    const nightSize = await sizeOf(nightKey);
    if (daySize === null && nightSize !== null) {
      console.log(`${full.padEnd(26)} already re-keyed (night ${nightSize}B, no day object)`);
      continue;
    }
    if (daySize === null) { console.log(`${full.padEnd(26)} SKIP — neither key exists`); continue; }

    const meta = existsSync(metaPath)
      ? (JSON.parse(readFileSync(metaPath, "utf8")) as Record<string, unknown>)
      : null;
    if (!meta) { console.log(`${full.padEnd(26)} SKIP — no published/${slug}/meta.json`); continue; }
    if (meta.night !== true) { console.log(`${full.padEnd(26)} SKIP — meta.night is not true`); continue; }

    const captured = capturedUtcMidnight(String(meta.captured_at));
    const nightUrl = `${R2_PUBLIC_BASE_URL}/${nightKey}`;

    if (!WRITE) {
      console.log(`${full.padEnd(26)} copy day->night ${daySize}B, repoint to nightVideoUrl, delete day, captured ${captured.toISOString().slice(0, 10)}`);
      continue;
    }

    // 1. copy within the bucket, server side
    await s3.send(new CopyObjectCommand({
      Bucket: R2_BUCKET,
      CopySource: `${R2_BUCKET}/${dayKey}`,
      Key: nightKey,
      ContentType: "video/mp4",
      CacheControl: "public, max-age=31536000, immutable",
      MetadataDirective: "REPLACE",
    }));
    const copied = await sizeOf(nightKey);
    if (copied !== daySize) throw new Error(`${full}: copy size ${copied} != source ${daySize}, refusing to delete the day object`);

    // 2. move the pointer BEFORE deleting anything
    await db`
      UPDATE public."StreetContent"
      SET "nightVideoUrl" = ${nightUrl}, "nightCapturedAt" = ${captured.toISOString()},
          "videoUrl" = NULL, "videoCapturedAt" = NULL
      WHERE "streetSlug" = ${full}
    `;

    // 3. only now is the day object unreferenced
    await s3.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: dayKey }));

    meta.r2_key = nightKey;
    meta.poster_r2_key = `streets/${full}/poster.webp`;
    meta.r2_bucket = R2_BUCKET;
    meta.r2_base = R2_PUBLIC_BASE_URL;
    meta.rekeyed_at = new Date().toISOString().slice(0, 10);
    writeFileSync(metaPath, JSON.stringify(meta, null, 2) + "\n", "utf8");

    touched.push(full);
    console.log(`${full.padEnd(26)} copied ${daySize}B -> ${nightKey}, pointer moved, day object deleted, meta updated`);
    console.log(`${" ".repeat(26)} ${nightUrl}`);
  }

  if (WRITE) {
    console.log(`\nre-keyed: ${touched.length}`);
    console.log(touched.join(","));
  }
}

main().catch((e) => {
  console.error("FATAL", e instanceof Error ? e.message : String(e));
  process.exit(1);
});

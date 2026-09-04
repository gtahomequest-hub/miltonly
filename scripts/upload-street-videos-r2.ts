// scripts/upload-street-videos-r2.ts
//
// Uploads street dashcam clips and their poster frames to Cloudflare R2 over the S3 API, then
// points StreetContent at the public R2 URLs.
//
// SOURCE OF TRUTH IS D:/dashcam/manifest.json PLUS staged/<slug>/meta.json (2026-09-04).
// The previous version read a hardcoded nine-slug list and a clips.csv under work/, which is a
// scratch directory: it had no notion of blur verification, no day/night distinction in the key,
// and no way to say a clip had already shipped. The manifest carries all three, so the script no
// longer decides what to upload — it reads what the staging pass decided.
//
// CANDIDATES are rows with status "staged" AND blur_verified true. A row with blur_verified false
// is REFUSED and reported, never uploaded. That gate is the whole reason this script was rewritten:
// unblurred faces and plates are the one thing in this pipeline that cannot be walked back after
// publication.
//
// KEY LAYOUT
//   streets/<slug>-milton/day.mp4     (meta.night === false)
//   streets/<slug>-milton/night.mp4   (meta.night === true)
//   streets/<slug>-milton/poster.webp
// NOTE the "-milton" suffix. The manifest's own r2_key field omits it ("streets/1st-line/night.mp4"),
// but every one of the 18 objects already in the bucket carries it, and so does every StreetContent
// slug. Following the manifest literally would have created a second, orphaned copy of every asset
// beside the live one instead of replacing it. The real key is written back into meta.json after
// upload, so the manifest self-corrects on the next rebuild.
//
// The render layer DERIVES the poster from the clip URL (deriveVideoPoster in
// src/lib/streetVideo.ts) rather than storing it, and it rewrites "/day.mp4" only. A night-only
// street therefore needs deriveVideoPoster to learn "/night.mp4" too — see that file.
//
// IDEMPOTENT: a HEAD on the key first. Same size means skip, so a re-run is free and cannot
// duplicate. Size rather than ETag because R2 computes multipart ETags differently from a local
// md5, and a false mismatch would re-upload 36 MB for nothing. A DIFFERENT size is a replace,
// which is what lemieux-court and locker-place need: both have newer captures than the ones
// shipped on 2026-09-03.
//
// CAPTURE DATE comes from meta.captured_at, stored as UTC midnight of the shot date.
// videoCapturedAt is a claim about the world and the page prints it, so it is never today.
//
// Usage:
//   npx tsx --tsconfig tsconfig.test.json scripts/upload-street-videos-r2.ts           # dry run
//   npx tsx --tsconfig tsconfig.test.json scripts/upload-street-videos-r2.ts --write
//   ... --write --only=lemieux-court,locker-place

import { readFileSync, existsSync, statSync } from "node:fs";
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

const DASHCAM = "D:/dashcam";
const MANIFEST = path.join(DASHCAM, "manifest.json");
const STAGED = path.join(DASHCAM, "staged");
const SLUG_SUFFIX = "-milton";

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

interface ManifestRow {
  slug: string;
  status: string;
  captured_at: string;
  night: boolean;
  blur_verified?: boolean;
  r2_key?: string;
  poster_r2_key?: string;
}
interface Meta {
  slug: string;
  street?: string;
  captured_at: string;
  night: boolean;
  blur_verified?: boolean;
  blur_signed_at?: string;
}

/** UTC midnight of the shot date. The filename timestamp is local and the caption renders in UTC,
 *  so parsing it as an instant pushes an evening capture a day forward. */
function capturedUtcMidnight(iso: string): Date {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) throw new Error(`unparseable captured_at: ${iso}`);
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

async function existingSize(key: string): Promise<number | null> {
  try {
    const r = await s3.send(new HeadObjectCommand({ Bucket: R2_BUCKET, Key: key }));
    return r.ContentLength ?? null;
  } catch {
    return null;
  }
}

async function putIfChanged(key: string, file: string, contentType: string) {
  const size = statSync(file).size;
  const have = await existingSize(key);
  if (have === size) return { key, size, action: "skip" as const };
  if (!WRITE) return { key, size, action: have === null ? ("upload" as const) : ("replace" as const) };
  await s3.send(new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    Body: readFileSync(file),
    ContentType: contentType,
    CacheControl: "public, max-age=31536000, immutable",
  }));
  return { key, size, action: have === null ? ("uploaded" as const) : ("replaced" as const) };
}

async function contentStatusFor(fullSlug: string): Promise<string | null> {
  const rows = (await db`SELECT "status" FROM public."StreetContent" WHERE "streetSlug" = ${fullSlug} LIMIT 1`) as Array<{ status: string }>;
  return rows.length > 0 ? rows[0].status : null;
}

export interface PlanRow {
  slug: string;
  fullSlug: string;
  night: boolean;
  capturedAt: Date;
  clipPath: string;
  posterPath: string;
  clipKey: string;
  posterKey: string;
  clipSize: number;
  posterSize: number;
  contentStatus: string | null;
}

async function buildPlan(): Promise<{ plan: PlanRow[]; refused: ManifestRow[]; problems: string[] }> {
  const manifest = JSON.parse(readFileSync(MANIFEST, "utf8")) as { streets: ManifestRow[] };
  const refused: ManifestRow[] = [];
  const problems: string[] = [];
  const plan: PlanRow[] = [];

  for (const row of manifest.streets) {
    if (row.status !== "staged") continue;
    if (ONLY && !ONLY.includes(row.slug)) continue;
    if (row.blur_verified !== true) { refused.push(row); continue; }

    const dir = path.join(STAGED, row.slug);
    const metaPath = path.join(dir, "meta.json");
    if (!existsSync(metaPath)) { problems.push(`${row.slug}: no staged/${row.slug}/meta.json`); continue; }
    const meta = JSON.parse(readFileSync(metaPath, "utf8")) as Meta;

    // meta.json is the per-clip authority; the manifest is an index over it. Disagreement means
    // the index is stale, and an upload keyed off a stale index is how a night clip ships as day.
    if (meta.blur_verified !== true) { refused.push({ ...row, blur_verified: meta.blur_verified }); continue; }
    if (meta.night !== row.night) problems.push(`${row.slug}: manifest.night=${row.night} but meta.night=${meta.night}; using meta`);

    const night = meta.night;
    const clipName = night ? "night.mp4" : "day.mp4";
    const clipPath = path.join(dir, clipName);
    const posterPath = path.join(dir, "poster.webp");
    if (!existsSync(clipPath)) { problems.push(`${row.slug}: missing ${clipName}`); continue; }
    if (!existsSync(posterPath)) { problems.push(`${row.slug}: missing poster.webp`); continue; }

    const fullSlug = row.slug + SLUG_SUFFIX;
    plan.push({
      slug: row.slug,
      fullSlug,
      night,
      capturedAt: capturedUtcMidnight(meta.captured_at),
      clipPath,
      posterPath,
      clipKey: `streets/${fullSlug}/${clipName}`,
      posterKey: `streets/${fullSlug}/poster.webp`,
      clipSize: statSync(clipPath).size,
      posterSize: statSync(posterPath).size,
      contentStatus: await contentStatusFor(fullSlug),
    });
  }
  return { plan, refused, problems };
}

async function main() {
  const { plan, refused, problems } = await buildPlan();
  console.log(`${WRITE ? "WRITE" : "DRY RUN"} · ${plan.length} candidate(s) · bucket ${R2_BUCKET}`);
  console.log(`public base ${R2_PUBLIC_BASE_URL}`);
  console.log("");

  if (refused.length > 0) {
    console.log(`REFUSED — blur_verified is not true on ${refused.length} row(s). Not uploaded:`);
    for (const r of refused) console.log(`  ${r.slug}  status=${r.status}  blur_verified=${r.blur_verified}`);
    console.log("");
  }
  if (problems.length > 0) {
    console.log("PROBLEMS:");
    for (const p of problems) console.log(`  ${p}`);
    console.log("");
  }

  console.log(`${"slug".padEnd(26)} ${"var".padEnd(5)} ${"clip bytes".padStart(10)} ${"poster".padStart(7)}  ${"captured".padEnd(10)} StreetContent`);
  let totalBytes = 0;
  for (const r of plan) {
    totalBytes += r.clipSize + r.posterSize;
    const sc = r.contentStatus === null ? "MISSING" : r.contentStatus === "published" ? "exists (published)" : `exists (${r.contentStatus})`;
    console.log(
      `${r.fullSlug.padEnd(26)} ${(r.night ? "night" : "day").padEnd(5)} ${String(r.clipSize).padStart(10)} ${String(r.posterSize).padStart(7)}  ` +
      `${r.capturedAt.toISOString().slice(0, 10)} ${sc}`,
    );
  }
  console.log(`\n${plan.length} rows, ${totalBytes} bytes (${(totalBytes / 1048576).toFixed(1)} MiB) to consider`);
  const missing = plan.filter((r) => r.contentStatus === null);
  console.log(`StreetContent present: ${plan.length - missing.length}   missing: ${missing.length}`);
  if (missing.length > 0) console.log(`  missing: ${missing.map((r) => r.fullSlug).join(", ")}`);

  if (!WRITE) { console.log("\ndry run — pass --write to upload and set the columns."); return; }

  console.log("\n--- uploading ---");
  const touched: string[] = [];
  for (const r of plan) {
    const v = await putIfChanged(r.clipKey, r.clipPath, "video/mp4");
    const p = await putIfChanged(r.posterKey, r.posterPath, "image/webp");
    const url = `${R2_PUBLIC_BASE_URL}/${v.key}`;

    let dbNote = "no StreetContent row - columns not set";
    if (r.contentStatus !== null) {
      if (r.night) {
        await db`UPDATE public."StreetContent" SET "nightVideoUrl" = ${url}, "nightCapturedAt" = ${r.capturedAt.toISOString()} WHERE "streetSlug" = ${r.fullSlug}`;
      } else {
        await db`UPDATE public."StreetContent" SET "videoUrl" = ${url}, "videoCapturedAt" = ${r.capturedAt.toISOString()} WHERE "streetSlug" = ${r.fullSlug}`;
      }
      dbNote = r.night ? "nightVideoUrl set" : "videoUrl set";
      touched.push(r.fullSlug);
    }
    console.log(`${r.fullSlug.padEnd(26)} ${v.action.padEnd(8)} clip ${String(v.size).padStart(8)}B  ${p.action.padEnd(8)} poster ${String(p.size).padStart(6)}B  ${dbNote}`);
    console.log(`${" ".repeat(26)} ${url}`);
  }
  console.log(`\nStreetContent rows touched: ${touched.length}`);
  console.log(touched.join(","));
}

main().catch((e) => {
  console.error("FATAL", e instanceof Error ? e.message : String(e));
  process.exit(1);
});

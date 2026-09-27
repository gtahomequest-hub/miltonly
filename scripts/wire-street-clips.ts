// scripts/wire-street-clips.ts
//
// MC-041. DC-017 uploaded a batch of Milton clips and verified every key; nothing on the site
// knew. This wires the published bytes to the pages: one pass over
// D:/dashcam/publish-manifest-milton.json (the uploader's own list of "rows Miltonly may read",
// rebuilt from published/ on every run), writing StreetContent.videoUrl / videoCapturedAt.
//
// WHY IT RE-KEYS FIRST. MC-015 put every published clip under a dated key,
// streets/<slug>-milton/<YYYYMMDD>/day.mp4, and the battery fails on "clips at an undated key".
// The reason is not tidiness: an immutable object at streets/<slug>-milton/day.mp4 can never be
// cache-busted, and a second capture of the same street can only overwrite the first. This batch
// arrived at undated keys (the three SUPERSEDING clips are already dated, because a second clip
// needed a distinct key). So a clip at an undated key is copied to its dated key BEFORE any
// column points at it: no page ever renders the undated URL, and the site never regains the
// layout MC-015 removed.
//
// THE ORDER IS COPY, VERIFY, THEN WRITE, and nothing here deletes. The copy is a server-side
// CopyObject inside R2 (Content-Type and the immutable Cache-Control travel with it), verified
// by a HEAD size match on both the clip and its poster before the column moves. meta.json
// records supersedes_r2_key = the undated key it came from, which is what
// scripts/retire-superseded-clips.ts reads once production is seen serving the new URL. The old
// keys stay in the bucket, unreferenced.
//
// WHAT IT REFUSES. A clip whose meta.json disagrees with the manifest, whose blur_verified is
// not true, or whose page key is not a PUBLISHED StreetContent row. The last one is not an
// error: a clip can be shot before its page exists, and it waits in the bucket, named in the
// report, until the page is published. Nothing is invented and no page is created here.
//
// The sidecar (src/data/streetVideoMeta.json) holds each clip's duration and coverage, keyed by
// R2 key, so run scripts/backfill-video-captured.ts --write after this and before the deploy.
//
// Usage:
//   npx tsx --tsconfig tsconfig.test.json scripts/wire-street-clips.ts            # dry run
//   npx tsx --tsconfig tsconfig.test.json scripts/wire-street-clips.ts --write
//   ... --only=anne-boulevard,beam-court
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { S3Client, HeadObjectCommand, CopyObjectCommand } from "@aws-sdk/client-s3";
import { neon } from "@neondatabase/serverless";
import { revalidateVideoSurfaces } from "./videoRevalidate";

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
const PUBLISH_MANIFEST = "D:/dashcam/publish-manifest-milton.json";
const TODAY = new Date().toISOString().slice(0, 10);
const WRITE = process.argv.includes("--write");
const onlyArg = process.argv.find((a) => a.startsWith("--only="));
const ONLY = onlyArg ? new Set(onlyArg.slice(7).split(",").map((s) => s.trim()).filter(Boolean)) : null;

const { R2_ACCOUNT_ID = "", R2_ACCESS_KEY_ID = "", R2_SECRET_ACCESS_KEY = "", R2_BUCKET = "", R2_PUBLIC_BASE_URL = "", DATABASE_URL = "" } = process.env;
for (const [k, v] of Object.entries({ R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_BASE_URL, DATABASE_URL })) {
  if (!v) { console.error(`Missing ${k} in .env.local`); process.exit(1); }
}
const db = neon(DATABASE_URL);
const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
});

interface PublishRow {
  pageKey: string;
  slug: string;
  street: string;
  dayOrNight: string;
  contentUrl: string;
  posterUrl: string;
  capturedAt: string;
}
interface Meta {
  captured_at: string;
  night?: boolean;
  blur_verified?: boolean;
  r2_key?: string;
  poster_r2_key?: string;
  supersedes_r2_key?: string;
  rekeyed_at?: string;
  retired_at?: string;
}

const UNDATED = /^streets\/([a-z0-9-]+)\/(day|night)\.mp4$/;
const DATED = /^streets\/([a-z0-9-]+)\/(\d{8})\/(day|night)\.mp4$/;

function r2KeyOf(url: string): string {
  return decodeURIComponent(new URL(url).pathname.replace(/^\/+/, ""));
}

/** The capture date on the clip's own wall clock, YYYYMMDD: the key segment MC-015 established. */
function localDateSegment(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})T\d{2}:\d{2}(?::\d{2})?(?:Z|[+-]\d{2}:\d{2})?$/);
  if (!m) throw new Error(`unparseable captured_at: ${iso}`);
  return `${m[1]}${m[2]}${m[3]}`;
}

async function sizeOf(key: string): Promise<number | null> {
  try {
    const r = await s3.send(new HeadObjectCommand({ Bucket: R2_BUCKET, Key: key }));
    return r.ContentLength ?? null;
  } catch {
    return null;
  }
}

/** Server-side copy inside the bucket. Idempotent: a target of the same size is left alone. */
async function copy(from: string, to: string): Promise<"copied" | "present"> {
  const want = await sizeOf(from);
  if (want === null) throw new Error(`source missing: ${from}`);
  if ((await sizeOf(to)) === want) return "present";
  await s3.send(new CopyObjectCommand({ Bucket: R2_BUCKET, CopySource: `/${R2_BUCKET}/${from}`, Key: to, MetadataDirective: "COPY" }));
  const got = await sizeOf(to);
  if (got !== want) throw new Error(`copy ${from} -> ${to}: size ${got} != ${want}`);
  return "copied";
}

async function main() {
  console.log(`${WRITE ? "WRITE" : "DRY RUN"} · bucket ${R2_BUCKET}\n`);
  const rows = (JSON.parse(readFileSync(PUBLISH_MANIFEST, "utf8")) as { rows: PublishRow[] }).rows;
  const content = (await db`
    SELECT "streetSlug", status, "videoUrl", "nightVideoUrl" FROM public."StreetContent"`) as Array<{
      streetSlug: string; status: string; videoUrl: string | null; nightVideoUrl: string | null;
    }>;
  const byKey = new Map(content.map((r) => [r.streetSlug, r]));

  let wired = 0, rekeyed = 0, already = 0;
  const noPage: string[] = [];
  const problems: string[] = [];

  for (const row of rows) {
    if (ONLY && !ONLY.has(row.slug)) continue;
    const page = byKey.get(row.pageKey);
    if (!page || page.status !== "published") {
      noPage.push(`${row.pageKey} (${page ? page.status : "no StreetContent row"}) · ${r2KeyOf(row.contentUrl)}`);
      continue;
    }
    const night = row.dayOrNight === "night";
    const current = night ? page.nightVideoUrl : page.videoUrl;

    const metaPath = path.join(PUBLISHED, row.slug, "meta.json");
    if (!existsSync(metaPath)) { problems.push(`${row.pageKey}: no published meta.json`); continue; }
    const meta = JSON.parse(readFileSync(metaPath, "utf8")) as Meta;
    if (meta.blur_verified !== true) { problems.push(`${row.pageKey}: blur_verified is not true`); continue; }
    const manifestKey = r2KeyOf(row.contentUrl);
    if (meta.r2_key !== manifestKey) { problems.push(`${row.pageKey}: meta r2_key ${meta.r2_key} disagrees with the publish manifest ${manifestKey}`); continue; }
    if ((meta.night === true) !== night) { problems.push(`${row.pageKey}: meta.night ${meta.night} disagrees with the manifest ${row.dayOrNight}`); continue; }

    // Where the column should point. A dated key is taken as it is; an undated key is copied
    // to its dated twin first, so no column ever carries the undated URL.
    let clipKey = manifestKey;
    let posterKey = r2KeyOf(row.posterUrl);
    let action = "";
    if (UNDATED.test(manifestKey)) {
      const seg = localDateSegment(meta.captured_at || row.capturedAt);
      clipKey = `streets/${row.pageKey}/${seg}/${night ? "night" : "day"}.mp4`;
      posterKey = `streets/${row.pageKey}/${seg}/poster.webp`;
      action = `re-key ${manifestKey} -> ${clipKey}`;
    } else if (!DATED.test(manifestKey)) {
      problems.push(`${row.pageKey}: ${manifestKey} is neither a dated nor an undated street key`);
      continue;
    }
    const newUrl = `${R2_PUBLIC_BASE_URL}/${clipKey}`;
    if (current === newUrl) { already++; continue; }

    console.log(`${row.pageKey.padEnd(34)} ${current ? "repoint" : "new"}${action ? "  " + action : `  ${clipKey}`}`);
    if (!WRITE) continue;

    if (action) {
      const c = await copy(manifestKey, clipKey);
      const p = await copy(r2KeyOf(row.posterUrl), posterKey);
      meta.supersedes_r2_key = manifestKey;
      meta.r2_key = clipKey;
      meta.poster_r2_key = posterKey;
      meta.rekeyed_at = TODAY;
      delete meta.retired_at;
      writeFileSync(metaPath, JSON.stringify(meta, null, 2) + "\n", "utf8");
      rekeyed++;
      console.log(`${" ".repeat(36)}clip ${c}, poster ${p}, meta stamped`);
    }
    const capturedAt = new Date(meta.captured_at || row.capturedAt);
    if (night) {
      await db`UPDATE public."StreetContent" SET "nightVideoUrl" = ${newUrl}, "nightCapturedAt" = ${capturedAt.toISOString()}::timestamptz WHERE "streetSlug" = ${row.pageKey}`;
    } else {
      await db`UPDATE public."StreetContent" SET "videoUrl" = ${newUrl}, "videoCapturedAt" = ${capturedAt.toISOString()}::timestamptz WHERE "streetSlug" = ${row.pageKey}`;
    }
    const rv = await revalidateVideoSurfaces(row.pageKey);
    wired++;
    console.log(`${" ".repeat(36)}column -> ${newUrl.split("/").slice(-3).join("/")}; ${rv}`);
  }

  console.log(`\n${WRITE ? "wired" : "would wire"} ${WRITE ? wired : "(dry run)"} row(s), re-keyed ${rekeyed}, already correct ${already}`);
  if (noPage.length) {
    console.log(`\nCLIPS WITH NO PUBLISHED PAGE (${noPage.length}) — left in the bucket, nothing written:`);
    for (const n of noPage) console.log(`  ${n}`);
  }
  if (problems.length) {
    console.log(`\nREFUSED (${problems.length}):`);
    for (const p of problems) console.log(`  ${p}`);
    process.exitCode = 1;
  }
}

main().catch((e) => { console.error(e); process.exit(1); });

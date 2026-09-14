// scripts/rekey-video-dated.ts
//
// MC-015: every published clip under a dated key. 45 of the 47 live clips sit at
// streets/<slug>-milton/day.mp4 (or night.mp4) with one shared poster.webp, so a newer capture
// could only overwrite an older one and the two could never coexist, and an immutable object
// at an undated key can never be cache-busted. The dated layout is the one MC-007 already used
// for a superseding clip: streets/<slug>-milton/<YYYYMMDD>/day.mp4 with poster.webp beside it,
// the segment being the capture date under the clip's own offset.
//
// THE ORDER IS COPY, REPOINT, VERIFY, AND ONLY THEN DELETE, and this script does the first
// three. The copy is a server-side CopyObject inside R2 (no bytes leave the bucket; the source's
// Content-Type and immutable Cache-Control travel with it), verified by a HEAD size match on the
// new key before the column moves. The column is repointed and the page revalidated. meta.json
// records supersedes_r2_key = the old key, so scripts/retire-superseded-clips.ts deletes the old
// clip and the old shared poster only after production is seen serving the new URL; nothing here
// deletes. The sidecar is keyed by R2 key, so run scripts/backfill-video-captured.ts --write
// after this and before the deploy.
//
// A row whose URL is already dated, or whose meta.json disagrees with the column, is skipped
// and named. Usage:
//   npx tsx --tsconfig tsconfig.test.json scripts/rekey-video-dated.ts            # dry run
//   npx tsx --tsconfig tsconfig.test.json scripts/rekey-video-dated.ts --write
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
const SLUG_SUFFIX = "-milton";
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

interface Row {
  streetSlug: string;
  videoUrl: string | null;
  nightVideoUrl: string | null;
}
interface Meta {
  captured_at: string;
  night: boolean;
  r2_key?: string;
  poster_r2_key?: string;
  supersedes_r2_key?: string;
  rekeyed_at?: string;
  retired_at?: string;
}

const UNDATED = /^streets\/([a-z0-9-]+)\/(day|night)\.mp4$/;

function r2KeyOf(url: string): string {
  return decodeURIComponent(new URL(url).pathname.replace(/^\/+/, ""));
}

/** The capture date on the clip's own wall clock, YYYYMMDD. meta.captured_at is a wall clock
 *  either way: ISO with an offset, or the bare local time the older clips carry. The date part
 *  is the segment; the offset matters to the instant (the backfill's job), not to the key. */
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

/** Server-side copy inside the bucket; metadata (Content-Type, Cache-Control) travels with it.
 *  Idempotent: an existing target of the same size is left alone. */
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
  const rows = (await db`
    SELECT "streetSlug", "videoUrl", "nightVideoUrl" FROM public."StreetContent"
    WHERE "videoUrl" IS NOT NULL OR "nightVideoUrl" IS NOT NULL ORDER BY "streetSlug"`) as Row[];

  let planned = 0, done = 0, dated = 0;
  const problems: string[] = [];

  for (const r of rows) {
    const slug = r.streetSlug.endsWith(SLUG_SUFFIX) ? r.streetSlug.slice(0, -SLUG_SUFFIX.length) : r.streetSlug;
    if (ONLY && !ONLY.has(slug)) continue;
    for (const variant of ["day", "night"] as const) {
      const url = variant === "day" ? r.videoUrl : r.nightVideoUrl;
      if (!url) continue;
      const key = r2KeyOf(url);
      const m = key.match(UNDATED);
      if (!m) { dated++; continue; }
      if (m[1] !== r.streetSlug || m[2] !== variant) { problems.push(`${r.streetSlug} ${variant}: key ${key} names another street or variant`); continue; }

      const metaPath = path.join(PUBLISHED, slug, "meta.json");
      if (!existsSync(metaPath)) { problems.push(`${r.streetSlug} ${variant}: no ${metaPath}`); continue; }
      const meta = JSON.parse(readFileSync(metaPath, "utf8")) as Meta;
      if (meta.r2_key !== key) { problems.push(`${r.streetSlug} ${variant}: column key ${key} != meta.r2_key ${meta.r2_key}`); continue; }
      if (meta.night !== (variant === "night")) { problems.push(`${r.streetSlug} ${variant}: meta.night=${meta.night}`); continue; }
      if (meta.supersedes_r2_key && !meta.retired_at) { problems.push(`${r.streetSlug} ${variant}: an earlier re-key is still unretired (${meta.supersedes_r2_key})`); continue; }

      const seg = localDateSegment(meta.captured_at);
      const oldPoster = `streets/${r.streetSlug}/poster.webp`;
      const newClip = `streets/${r.streetSlug}/${seg}/${variant}.mp4`;
      const newPoster = `streets/${r.streetSlug}/${seg}/poster.webp`;
      const newUrl = `${R2_PUBLIC_BASE_URL}/${newClip}`;
      planned++;
      console.log(`${r.streetSlug.padEnd(30)} ${variant.padEnd(5)} ${key}\n${" ".repeat(36)}-> ${newClip}  (poster ${oldPoster} -> ${newPoster})`);
      if (!WRITE) continue;

      const c = await copy(key, newClip);
      const p = await copy(oldPoster, newPoster);
      if (variant === "day") await db`UPDATE public."StreetContent" SET "videoUrl" = ${newUrl} WHERE "streetSlug" = ${r.streetSlug}`;
      else await db`UPDATE public."StreetContent" SET "nightVideoUrl" = ${newUrl} WHERE "streetSlug" = ${r.streetSlug}`;
      const rv = await revalidateVideoSurfaces(r.streetSlug);
      meta.supersedes_r2_key = key;
      meta.r2_key = newClip;
      meta.poster_r2_key = newPoster;
      meta.rekeyed_at = TODAY;
      delete meta.retired_at;
      writeFileSync(metaPath, JSON.stringify(meta, null, 2) + "\n", "utf8");
      done++;
      console.log(`${" ".repeat(36)}clip ${c}, poster ${p}, column repointed, meta stamped; ${rv}`);
    }
  }

  console.log(`\n${WRITE ? "re-keyed" : "would re-key"} ${WRITE ? done : planned} clip(s) · already dated ${dated}`);
  if (problems.length) { console.log(`\nPROBLEMS (${problems.length}):`); for (const p of problems) console.log(`  ${p}`); }
  if (WRITE && done > 0) console.log("\nnow: npx tsx --tsconfig tsconfig.test.json scripts/backfill-video-captured.ts --write   then, once production serves the new URLs, scripts/retire-superseded-clips.ts");
  if (problems.length) process.exit(2);
}

main().catch((e) => { console.error("FATAL", e instanceof Error ? e.message : String(e)); process.exit(1); });

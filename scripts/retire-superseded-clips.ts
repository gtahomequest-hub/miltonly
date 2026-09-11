// scripts/retire-superseded-clips.ts
//
// The last, irreversible step of a re-key: delete the R2 objects a newer clip replaced, and
// retire an orphan clip no page can ever reference.
//
// A SUPERSEDED clip is a published/<slug>/meta.json whose supersedes_r2_key differs from its
// r2_key (the upload re-keyed the newer capture under a capture-date segment). Its old objects
// are deleted ONLY when production is observed serving the new URL on the street's page: a
// pointer nobody has seen serving is not a pointer you can safely orphan. The old poster at the
// canonical key goes with the old clip; the new poster lives beside the new clip.
//
// An ORPHAN is a published clip under a slug with no page and no registry entity (bronte-street-
// south, unmatched since DC-004, superseded in intent by bronte-street). Its objects are deleted
// after confirming no StreetContent row points at them, and its folder moves to
// D:/dashcam/retired/<slug> so the manifest rebuild stops listing it and the bytes are kept.
//
// Usage:
//   npx tsx --tsconfig tsconfig.test.json scripts/retire-superseded-clips.ts                   # dry run
//   npx tsx --tsconfig tsconfig.test.json scripts/retire-superseded-clips.ts --write
//   ... --orphan=bronte-street-south        (name each orphan explicitly; nothing is inferred)
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync, renameSync, mkdirSync, copyFileSync, rmSync } from "node:fs";
import path from "node:path";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { S3Client, HeadObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
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
const RETIRED = "D:/dashcam/retired";
const SLUG_SUFFIX = "-milton";
const PROD = "https://miltonly.com";
const TODAY = new Date().toISOString().slice(0, 10);
const { R2_ACCOUNT_ID = "", R2_ACCESS_KEY_ID = "", R2_SECRET_ACCESS_KEY = "", R2_BUCKET = "", R2_PUBLIC_BASE_URL = "", DATABASE_URL = "" } = process.env;
for (const [k, v] of Object.entries({ R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_BASE_URL, DATABASE_URL })) {
  if (!v) { console.error(`Missing ${k} in .env.local`); process.exit(1); }
}
const WRITE = process.argv.includes("--write");
const ORPHANS = process.argv.filter((a) => a.startsWith("--orphan=")).map((a) => a.slice(9)).filter(Boolean);

const db = neon(DATABASE_URL);
const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
});

async function exists(key: string): Promise<boolean> {
  try { await s3.send(new HeadObjectCommand({ Bucket: R2_BUCKET, Key: key })); return true; } catch { return false; }
}
async function del(key: string): Promise<void> {
  await s3.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key }));
}
function readMeta(dir: string): Record<string, unknown> | null {
  const p = path.join(dir, "meta.json");
  return existsSync(p) ? (JSON.parse(readFileSync(p, "utf8")) as Record<string, unknown>) : null;
}
function moveDir(from: string, to: string) {
  mkdirSync(path.dirname(to), { recursive: true });
  try { renameSync(from, to); } catch {
    mkdirSync(to, { recursive: true });
    for (const f of readdirSync(from)) copyFileSync(path.join(from, f), path.join(to, f));
    rmSync(from, { recursive: true, force: true });
  }
}

async function main() {
  console.log(`${WRITE ? "WRITE" : "DRY RUN"} · bucket ${R2_BUCKET}\n`);
  let deleted = 0, held = 0;

  // ── superseded ──
  for (const slug of readdirSync(PUBLISHED).sort()) {
    const dir = path.join(PUBLISHED, slug);
    if (!statSync(dir).isDirectory()) continue;
    const meta = readMeta(dir);
    if (!meta || typeof meta.supersedes_r2_key !== "string" || typeof meta.r2_key !== "string") continue;
    if (meta.supersedes_r2_key === meta.r2_key) continue;              // replaced in place, nothing to retire
    if (meta.retired_at) continue;                                      // already done
    const full = slug + SLUG_SUFFIX;
    const oldClip = meta.supersedes_r2_key;
    const oldPoster = oldClip.replace(/\/(day|night)\.mp4$/, "/poster.webp");
    const newUrl = `${R2_PUBLIC_BASE_URL}/${meta.r2_key}`;

    const html = await fetch(`${PROD}/streets/${full}`).then((r) => r.text()).catch(() => "");
    const served = html.includes(newUrl);
    const oldClipThere = await exists(oldClip);
    const oldPosterThere = oldPoster !== meta.poster_r2_key && (await exists(oldPoster));
    console.log(`${full.padEnd(26)} new ${meta.r2_key}`);
    console.log(`${" ".repeat(26)} production serves the new URL: ${served ? "YES" : "NO"}`);
    console.log(`${" ".repeat(26)} old clip ${oldClip} ${oldClipThere ? "present" : "absent"}; old poster ${oldPoster} ${oldPosterThere ? "present" : "absent or shared"}`);
    if (!served) { held++; console.log(`${" ".repeat(26)} HELD: production has not been seen serving the new URL`); continue; }
    if (!WRITE) continue;
    if (oldClipThere) { await del(oldClip); deleted++; }
    if (oldPosterThere) { await del(oldPoster); deleted++; }
    meta.retired_at = TODAY;
    meta.retired_keys = [oldClip, ...(oldPosterThere ? [oldPoster] : [])];
    writeFileSync(path.join(dir, "meta.json"), JSON.stringify(meta, null, 2) + "\n", "utf8");
    console.log(`${" ".repeat(26)} deleted, meta stamped retired_at ${TODAY}`);
  }

  // ── orphans ──
  for (const slug of ORPHANS) {
    const dir = path.join(PUBLISHED, slug);
    const meta = readMeta(dir);
    if (!meta) { console.log(`orphan ${slug}: no published/${slug}/meta.json`); held++; continue; }
    const full = slug + SLUG_SUFFIX;
    const clipKey = typeof meta.r2_key === "string" ? meta.r2_key : `streets/${full}/${meta.night === true ? "night.mp4" : "day.mp4"}`;
    const posterKey = typeof meta.poster_r2_key === "string" ? meta.poster_r2_key : `streets/${full}/poster.webp`;
    const refs = (await db`SELECT "streetSlug" FROM public."StreetContent" WHERE "videoUrl" LIKE ${"%" + clipKey} OR "nightVideoUrl" LIKE ${"%" + clipKey}`) as Array<{ streetSlug: string }>;
    const page = (await db`SELECT "status" FROM public."StreetContent" WHERE "streetSlug" = ${full}`) as Array<{ status: string }>;
    console.log(`orphan ${full.padEnd(26)} clip ${clipKey} ${(await exists(clipKey)) ? "present" : "absent"}; poster ${(await exists(posterKey)) ? "present" : "absent"}; referenced by ${refs.length} row(s); page row: ${page.length ? page[0].status : "none"}`);
    if (refs.length > 0) { held++; console.log(`  HELD: a StreetContent row points at it`); continue; }
    if (!WRITE) continue;
    if (await exists(clipKey)) { await del(clipKey); deleted++; }
    if (await exists(posterKey)) { await del(posterKey); deleted++; }
    meta.retired_at = TODAY;
    meta.retired_reason = "orphan: no page and no registry entity; superseded in intent by the matched slug";
    writeFileSync(path.join(dir, "meta.json"), JSON.stringify(meta, null, 2) + "\n", "utf8");
    moveDir(dir, path.join(RETIRED, slug));
    console.log(`  deleted, folder moved to retired/${slug}`);
  }

  console.log(`\n${WRITE ? "deleted" : "would delete"} objects: ${deleted}${held ? ` · held: ${held}` : ""}`);
  if (WRITE && ORPHANS.length > 0) console.log("run promote-staged-clips.ts --write to rebuild the manifest without the retired folder");
}

main().catch((e) => { console.error("FATAL", e instanceof Error ? e.message : String(e)); process.exit(1); });

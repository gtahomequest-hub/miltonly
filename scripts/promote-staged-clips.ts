// scripts/promote-staged-clips.ts
//
// After a successful upload run: move each uploaded slug from D:/dashcam/staged to
// D:/dashcam/published, stamp its meta.json with where the bytes actually landed, and rebuild
// manifest.json from the two directories.
//
// THE MANIFEST IS REBUILT FROM THE DIRECTORIES, not edited in place. staged/ and published/ are
// the facts; the manifest is an index over them, and an index that drifts from its source is worse
// than no index. Rebuilding also repairs the r2_key field, which the staging pass wrote without
// the "-milton" suffix that every real key and every StreetContent slug carries.
//
// VERIFIES BEFORE MOVING. A slug is only promoted if its clip and poster are actually in the
// bucket at the expected keys and the sizes match the local files. Promoting on the strength of
// "the upload script said so" would quietly bless the half-run that a TLS drop produced twice.
//
// Usage:
//   npx tsx --tsconfig tsconfig.test.json scripts/promote-staged-clips.ts          # dry run
//   npx tsx --tsconfig tsconfig.test.json scripts/promote-staged-clips.ts --write

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync, renameSync, rmSync, mkdirSync, copyFileSync } from "node:fs";
import path from "node:path";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { S3Client, HeadObjectCommand } from "@aws-sdk/client-s3";

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
const STAGED = path.join(DASHCAM, "staged");
const PUBLISHED = path.join(DASHCAM, "published");
const MANIFEST = path.join(DASHCAM, "manifest.json");
const SLUG_SUFFIX = "-milton";

const { R2_ACCOUNT_ID = "", R2_ACCESS_KEY_ID = "", R2_SECRET_ACCESS_KEY = "", R2_BUCKET = "", R2_PUBLIC_BASE_URL = "" } = process.env;
const WRITE = process.argv.includes("--write");
const TODAY = new Date().toISOString().slice(0, 10);

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

function readMeta(dir: string): Record<string, unknown> | null {
  const p = path.join(dir, "meta.json");
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, "utf8")) as Record<string, unknown>;
}

/** rename across the same volume, falling back to copy+remove if it is not. */
function moveDir(from: string, to: string) {
  if (existsSync(to)) rmSync(to, { recursive: true, force: true });
  try {
    renameSync(from, to);
  } catch {
    mkdirSync(to, { recursive: true });
    for (const f of readdirSync(from)) copyFileSync(path.join(from, f), path.join(to, f));
    rmSync(from, { recursive: true, force: true });
  }
}

async function main() {
  console.log(`${WRITE ? "WRITE" : "DRY RUN"}\n`);
  const promoted: string[] = [];
  const held: string[] = [];

  for (const slug of readdirSync(STAGED).sort()) {
    const dir = path.join(STAGED, slug);
    if (!statSync(dir).isDirectory()) continue;
    const meta = readMeta(dir);
    if (!meta) { held.push(`${slug}: no meta.json`); continue; }
    if (meta.blur_verified !== true) { held.push(`${slug}: blur_verified is not true`); continue; }

    const full = slug + SLUG_SUFFIX;
    const clipName = meta.night === true ? "night.mp4" : "day.mp4";
    const clipKey = `streets/${full}/${clipName}`;
    const posterKey = `streets/${full}/poster.webp`;
    const localClip = path.join(dir, clipName);
    const localPoster = path.join(dir, "poster.webp");
    if (!existsSync(localClip) || !existsSync(localPoster)) { held.push(`${slug}: local files missing`); continue; }

    const [remoteClip, remotePoster] = await Promise.all([sizeOf(clipKey), sizeOf(posterKey)]);
    const wantClip = statSync(localClip).size;
    const wantPoster = statSync(localPoster).size;
    if (remoteClip !== wantClip || remotePoster !== wantPoster) {
      held.push(`${slug}: bucket does not match local (clip ${remoteClip} vs ${wantClip}, poster ${remotePoster} vs ${wantPoster})`);
      continue;
    }

    if (WRITE) {
      meta.r2_key = clipKey;
      meta.poster_r2_key = posterKey;
      meta.r2_bucket = R2_BUCKET;
      meta.r2_base = R2_PUBLIC_BASE_URL;
      meta.uploaded_at = TODAY;
      writeFileSync(path.join(dir, "meta.json"), JSON.stringify(meta, null, 2) + "\n", "utf8");
      moveDir(dir, path.join(PUBLISHED, slug));
    }
    promoted.push(slug);
    console.log(`${slug.padEnd(26)} -> published/  ${clipKey}`);
  }

  if (held.length > 0) {
    console.log(`\nHELD IN staged/ (${held.length}):`);
    for (const h of held) console.log(`  ${h}`);
  }

  if (!WRITE) {
    console.log(`\ndry run — ${promoted.length} would be promoted. Pass --write.`);
    return;
  }

  // ── rebuild manifest.json from the directories ──
  const streets: Array<Record<string, unknown>> = [];
  for (const [status, root] of [["published", PUBLISHED], ["staged", STAGED]] as const) {
    if (!existsSync(root)) continue;
    for (const slug of readdirSync(root).sort()) {
      const dir = path.join(root, slug);
      if (!statSync(dir).isDirectory()) continue;
      const meta = readMeta(dir);
      if (!meta) continue;
      const full = slug + SLUG_SUFFIX;
      const clipName = meta.night === true ? "night.mp4" : "day.mp4";
      streets.push({
        slug,
        status,
        captured_at: meta.captured_at,
        night: meta.night === true,
        r2_key: (meta.r2_key as string) ?? `streets/${full}/${clipName}`,
        poster_r2_key: (meta.poster_r2_key as string) ?? `streets/${full}/poster.webp`,
        score: meta.score,
        blur_verified: meta.blur_verified === true,
        local_path: `${status}\\${slug}\\${clipName}`,
        ...(meta.uploaded_at ? { uploaded_at: meta.uploaded_at } : {}),
        ...(meta.rekeyed_at ? { rekeyed_at: meta.rekeyed_at } : {}),
      });
    }
  }
  streets.sort((a, b) => String(a.slug).localeCompare(String(b.slug)));
  const manifest = {
    generator: "claude-code upload pass",
    builtAt: TODAY,
    r2_bucket: R2_BUCKET,
    r2_base: R2_PUBLIC_BASE_URL,
    counts: {
      total: streets.length,
      published: streets.filter((s) => s.status === "published").length,
      staged: streets.filter((s) => s.status === "staged").length,
    },
    streets,
  };
  writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + "\n", "utf8");
  console.log(`\npromoted ${promoted.length}`);
  console.log(`manifest rebuilt: ${manifest.counts.total} total, ${manifest.counts.published} published, ${manifest.counts.staged} staged`);
}

main().catch((e) => {
  console.error("FATAL", e instanceof Error ? e.message : String(e));
  process.exit(1);
});

// scripts/rekey-chretien-to-day.ts
//
// chretien-street was re-keyed night on 2026-09-04 because its only capture was shot at 20:19.
// The 2026-09-02 restage supersedes it with a 15:41 daytime capture, so the street goes back the
// other way: day.mp4 is already uploaded and videoUrl already set by the upload script, and what
// remains is to drop the night pointer and the now-unreferenced night object.
//
// ORDER, same reasoning as the forward re-key: null the pointer FIRST, then delete. A delete
// before the repoint leaves a cached page pointing at a key that is gone, and street pages cache
// for an hour.
//
// REFUSES unless day.mp4 is actually in the bucket and videoUrl already points at it. Deleting a
// street's only clip because an upload silently failed is the one outcome worth guarding against.
//
// Usage:
//   npx tsx --tsconfig tsconfig.test.json scripts/rekey-chretien-to-day.ts          # dry run
//   npx tsx --tsconfig tsconfig.test.json scripts/rekey-chretien-to-day.ts --write

import { readFileSync } from "node:fs";
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

const SLUG = "chretien-street-milton";
const DAY_KEY = `streets/${SLUG}/day.mp4`;
const NIGHT_KEY = `streets/${SLUG}/night.mp4`;

const { R2_ACCOUNT_ID = "", R2_ACCESS_KEY_ID = "", R2_SECRET_ACCESS_KEY = "", R2_BUCKET = "", R2_PUBLIC_BASE_URL = "", DATABASE_URL = "" } = process.env;
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

async function main() {
  const [daySize, nightSize] = await Promise.all([sizeOf(DAY_KEY), sizeOf(NIGHT_KEY)]);
  const rows = (await db`SELECT "videoUrl", "videoCapturedAt", "nightVideoUrl", "nightCapturedAt" FROM public."StreetContent" WHERE "streetSlug" = ${SLUG}`) as Array<Record<string, unknown>>;
  const row = rows[0];
  console.log(`${WRITE ? "WRITE" : "DRY RUN"} · ${SLUG}`);
  console.log(`  day object   : ${daySize === null ? "ABSENT" : daySize + "B"}`);
  console.log(`  night object : ${nightSize === null ? "absent" : nightSize + "B"}`);
  console.log(`  videoUrl     : ${row?.videoUrl ?? "null"}`);
  console.log(`  nightVideoUrl: ${row?.nightVideoUrl ?? "null"}`);

  const expectedDayUrl = `${R2_PUBLIC_BASE_URL}/${DAY_KEY}`;
  if (daySize === null) throw new Error("refusing: day.mp4 is not in the bucket");
  if (row?.videoUrl !== expectedDayUrl) throw new Error(`refusing: videoUrl is ${row?.videoUrl}, expected ${expectedDayUrl}`);
  if (nightSize === null && row?.nightVideoUrl === null) { console.log("\nalready done, nothing to do"); return; }
  if (!WRITE) { console.log("\nwould null the night columns then delete the night object"); return; }

  await db`UPDATE public."StreetContent" SET "nightVideoUrl" = NULL, "nightCapturedAt" = NULL WHERE "streetSlug" = ${SLUG}`;
  console.log("\nnight columns nulled");
  if (nightSize !== null) {
    await s3.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: NIGHT_KEY }));
    console.log(`night object deleted (${nightSize}B)`);
  }
}

main().catch((e) => {
  console.error("FATAL", e instanceof Error ? e.message : String(e));
  process.exit(1);
});

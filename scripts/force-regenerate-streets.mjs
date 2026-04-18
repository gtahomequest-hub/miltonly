// Force-regenerate street content for the 45 slugs whose descriptions
// still contain "sold price" or "sold for" language (pre-Phase-2.6 leaks
// that the normal cron can't reach because makeStreetDecision returns
// skip_current on stale-but-hash-matching rows).
//
// Flow:
//   1. For each slug, POST /api/admin/force-regenerate with { slug }
//      (bypasses makeStreetDecision, uses src/lib/ai/compliance.ts,
//      suppresses per-street SMS).
//   2. 2-second delay between calls to stay under Claude API rate limits.
//   3. After all 45, re-query DB1 StreetContent and confirm none of the
//      45 rows still contain the leaking phrases.
//   4. Exit non-zero if any regeneration failed OR any verification row
//      still contains leaking language.
//
// KNOWN FOLLOW-UP (deferred — do not fix tonight):
//   /api/sync/generate returns skip_current on rows where marketDataHash
//   is NULL. The skip logic should only fire when hash matches current
//   inputs, not when hash is NULL. See makeStreetDecision in
//   src/lib/streetDecision.ts — tracked as a separate investigation.
//
// Usage:
//   node scripts/force-regenerate-streets.mjs
//   node scripts/force-regenerate-streets.mjs --slugs-from-file slugs.txt
//   node scripts/force-regenerate-streets.mjs --base-url http://localhost:3000
//
// Env (from .env.local):
//   CRON_SECRET     — auth for /api/admin/force-regenerate
//   DATABASE_URL    — DB1, used by Prisma for post-regen verification
//   MILTONLY_URL    — optional, defaults to https://miltonly.com

import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");

// --- env loader (same pattern as backfill-list-office-name.mjs) --------------
function loadEnvLocal() {
  const envPath = resolve(REPO_ROOT, ".env.local");
  let content;
  try {
    content = readFileSync(envPath, "utf8");
  } catch (e) {
    console.error(`[force-regen] could not read ${envPath}: ${e.message}`);
    process.exit(1);
  }
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    const isDoubleQuoted = val.startsWith('"') && val.endsWith('"');
    const isSingleQuoted = val.startsWith("'") && val.endsWith("'");
    if (isDoubleQuoted || isSingleQuoted) val = val.slice(1, -1);
    if (isDoubleQuoted) {
      val = val
        .replace(/\\n/g, "\n")
        .replace(/\\r/g, "\r")
        .replace(/\\t/g, "\t")
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, "\\");
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}
loadEnvLocal();

// --- config ------------------------------------------------------------------
const CRON_SECRET = (process.env.CRON_SECRET || "").trim();
// Canonical host. `miltonly.com` issues a 307 to `www.miltonly.com`, and
// fetch strips the Authorization header on cross-origin redirects, which
// produced 401s on every call. Target the canonical host directly.
const BASE_URL_DEFAULT = (process.env.MILTONLY_URL || "https://www.miltonly.com").trim();
const INTER_CALL_DELAY_MS = 2000;
const REQUEST_TIMEOUT_MS = 5 * 60 * 1000; // match endpoint maxDuration

const LEAKING_SLUGS = [
  "aird-court-milton",
  "andrews-trail-milton",
  "belmore-court-milton",
  "bessy-trail-bsmt-trail-milton",
  "biggar-heights-milton",
  "broadway-avenue-milton",
  "bundy-drive-milton",
  "cedric-terrace-milton",
  "celandine-terrace-milton",
  "chretien-street-milton",
  "coates-drive-milton",
  "derry-road-milton",
  "derry-road-n-a-milton",
  "dice-way-milton",
  "downes-jackson-bsmnt-heights-milton",
  "duignan-crescent-milton",
  "ferguson-drive-milton",
  "gibson-crescent-milton",
  "gorham-way-milton",
  "haxton-heights-milton",
  "hickory-crescent-milton",
  "hill-street-milton",
  "kingsleigh-court-milton",
  "kitchen-court-milton",
  "laking-terrace-milton",
  "locker-place-milton",
  "luxton-drive-milton",
  "maple-avenue-milton",
  "mccuaig-drive-milton",
  "mendelson-heights-milton",
  "millside-drive-milton",
  "mockridge-terrace-milton",
  "pringle-avenue-milton",
  "reece-court-milton",
  "speyer-circle-milton",
  "sprucedale-lane-milton",
  "steeles-avenue-milton",
  "stevenson-street-milton",
  "stoutt-crescent-milton",
  "sweetfern-crescent-milton",
  "symons-cross-n-a-milton",
  "upper-whitney-terrace-milton",
  "whitlock-avenue-milton",
  "whitney-terrace-milton",
  "winter-crescent-milton",
];

// --- cli ---------------------------------------------------------------------
function parseArgs(argv) {
  const out = { baseUrl: BASE_URL_DEFAULT, slugsFromFile: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--slugs-from-file") {
      out.slugsFromFile = argv[++i];
    } else if (a === "--base-url") {
      out.baseUrl = argv[++i];
    }
  }
  return out;
}

function loadSlugs(args) {
  if (!args.slugsFromFile) return [...LEAKING_SLUGS];
  const path = resolve(args.slugsFromFile);
  const raw = readFileSync(path, "utf8");
  return raw
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith("#"));
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// --- single-slug request -----------------------------------------------------
// Contract: POST /api/admin/force-regenerate with body { "slug": "..." }.
// The endpoint reads body.slug (see src/app/api/admin/force-regenerate/
// route.ts:39). Do NOT rename this key to streetSlug — the endpoint will
// return 400 "Missing required field: slug (string)".
//
// Auth: both ?secret= query param AND Authorization: Bearer header are
// included. The endpoint accepts either. Query param is the primary auth
// because fetch strips Authorization on cross-origin redirects (observed
// on miltonly.com → www.miltonly.com 307), and ?secret= survives any
// redirect since it's part of the URL itself. The Bearer header is
// retained as a secondary so an overridden MILTONLY_URL that lands on a
// canonical origin without a redirect still authenticates cleanly.
async function regenerateOne(baseUrl, slug) {
  const url =
    `${baseUrl.replace(/\/$/, "")}/api/admin/force-regenerate` +
    `?secret=${encodeURIComponent(CRON_SECRET)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  const requestBody = { slug };
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${CRON_SECRET}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });
    // Read the raw body text first so we never lose server diagnostics to
    // a JSON.parse failure. Then attempt to parse. Errors in parsing should
    // surface the raw body (truncated) rather than a useless "Unauthorized".
    const rawBody = await res.text();
    let json = null;
    try {
      json = rawBody ? JSON.parse(rawBody) : null;
    } catch {
      // leave json null — caller will log rawBody
    }
    return { status: res.status, statusText: res.statusText, rawBody, json };
  } finally {
    clearTimeout(timer);
  }
}

// --- main --------------------------------------------------------------------
async function main() {
  if (!CRON_SECRET) {
    console.error(
      "[force-regen] CRON_SECRET is not set in .env.local — cannot auth " +
        "/api/admin/force-regenerate. Aborting."
    );
    process.exit(1);
  }

  const args = parseArgs(process.argv.slice(2));
  const slugs = loadSlugs(args);

  console.log(`[force-regen] target: ${args.baseUrl}`);
  console.log(`[force-regen] slugs: ${slugs.length}`);
  console.log(`[force-regen] delay between calls: ${INTER_CALL_DELAY_MS}ms`);
  console.log("");

  const startedAt = Date.now();
  const results = [];

  for (let i = 0; i < slugs.length; i++) {
    const slug = slugs[i];
    const label = `[${i + 1}/${slugs.length}]`;
    const t0 = Date.now();
    process.stdout.write(`${label} regenerating ${slug} ... `);

    let outcome;
    try {
      const { status, statusText, rawBody, json } = await regenerateOne(
        args.baseUrl,
        slug
      );
      const ms = Date.now() - t0;
      if (status === 200 && json?.ok) {
        console.log(
          `done (${ms}ms, ${json.attempts} attempt${json.attempts === 1 ? "" : "s"}, ` +
            `${json.passed ? "published" : "draft-needs-review"})`
        );
        outcome = { slug, ok: true, attempts: json.attempts, passed: json.passed, ms };
      } else {
        // Show the raw HTTP status, statusText, and up to 500 chars of body.
        // Previously this derived a single `err` string from json?.error and
        // lost signal — a 400 "Missing required field: slug" would look
        // identical to a 401 "Unauthorized" after collapsing.
        const bodyPreview = (rawBody || "").trim().slice(0, 500);
        console.log(
          `failed (${ms}ms) — HTTP ${status} ${statusText} — body: ${bodyPreview || "<empty>"}`
        );
        outcome = {
          slug,
          ok: false,
          status,
          statusText,
          body: bodyPreview,
          ms,
        };
      }
    } catch (e) {
      const ms = Date.now() - t0;
      const err = e instanceof Error ? e.message : String(e);
      console.log(`failed (${ms}ms) — fetch threw: ${err}`);
      outcome = { slug, ok: false, error: err, ms };
    }
    results.push(outcome);

    if (i < slugs.length - 1) await sleep(INTER_CALL_DELAY_MS);
  }

  const elapsedSec = ((Date.now() - startedAt) / 1000).toFixed(1);
  const okCount = results.filter((r) => r.ok).length;
  const failCount = results.length - okCount;

  console.log("");
  console.log(`[force-regen] ===== regeneration complete =====`);
  console.log(`[force-regen] elapsed:   ${elapsedSec}s`);
  console.log(`[force-regen] succeeded: ${okCount}`);
  console.log(`[force-regen] failed:    ${failCount}`);
  if (failCount > 0) {
    console.log(`[force-regen] failed slugs:`);
    for (const r of results.filter((x) => !x.ok)) {
      // HTTP-level failures carry status/statusText/body; fetch-thrown errors
      // (network, abort, DNS) carry error. Log whichever shape applies.
      if (r.status !== undefined) {
        console.log(
          `[force-regen]   ${r.slug}: HTTP ${r.status} ${r.statusText} — ${r.body || "<empty body>"}`
        );
      } else {
        console.log(`[force-regen]   ${r.slug}: ${r.error}`);
      }
    }
  }

  // --- verification: DB must show zero leaks in the 45 regenerated rows ---
  console.log("");
  console.log(`[force-regen] verifying DB state...`);
  const prisma = new PrismaClient();
  let leakingRows;
  try {
    leakingRows = await prisma.streetContent.findMany({
      where: {
        streetSlug: { in: slugs },
        OR: [
          { description: { contains: "sold price", mode: "insensitive" } },
          { description: { contains: "sold for", mode: "insensitive" } },
        ],
      },
      select: { streetSlug: true },
      orderBy: { streetSlug: "asc" },
    });
  } finally {
    await prisma.$disconnect();
  }

  console.log(
    `[force-regen] rows still containing "sold price" or "sold for": ${leakingRows.length}`
  );
  if (leakingRows.length > 0) {
    console.error(`[force-regen] COMPLIANCE FAILURE — leaking slugs:`);
    for (const r of leakingRows) console.error(`[force-regen]   ${r.streetSlug}`);
  }

  const overallOk = failCount === 0 && leakingRows.length === 0;
  if (!overallOk) {
    console.error(
      `[force-regen] FAILED: ${failCount} regeneration failure(s), ` +
        `${leakingRows.length} row(s) still contain leaking language.`
    );
    process.exit(1);
  }

  console.log(`[force-regen] OK: all ${slugs.length} slugs regenerated and verified clean.`);
}

main().catch((e) => {
  console.error("[force-regen] FATAL:", e);
  process.exit(1);
});

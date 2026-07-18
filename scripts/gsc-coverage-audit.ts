// GSC INDEX-COVERAGE AUDIT + TROUBLESHOOT
// ============================================================
// Standalone diagnostic (NOT part of miltonlyhealth.ps1 runs):
//   npx tsx scripts/gsc-coverage-audit.ts [--max=N] [--fresh] [--dry]
//
// Answers: of the sitemap URLs, which are indexed, which aren't,
// WHY, and what's fixable. Output = per-page verdicts + a
// prioritized action queue (ASCII table + JSON artifact).
//
// API reality (the Index Coverage report is NOT exposed via API):
//   (a) URL Inspection API  - per-URL verdict/coverageState/canonical/
//       lastCrawl. Quota ~2000 inspections/day per property, bursts
//       rate-limited around ~600/min. The expensive primitive.
//   (b) searchanalytics.query dimensions:['page'] - pages WITH
//       impressions are definitely indexed. ONE call. The cheap
//       positive signal.
//   (c) sitemaps list/get - submitted counts only.
//
// Strategy: positive set from 30d search analytics; URL-inspect ONLY
// the residual (sitemap URLs with zero impressions), in quota-safe,
// resumable batches. Progress persists to scripts/gsc-coverage-out/
// state.json so a full audit can span runs. Artifacts are written to
// scripts/gsc-coverage-out/audit-<date>.json and latest.json; each
// run diffs against the previous latest.json for the coverage trend.
//
// DIAGNOSE ONLY - this script never mutates anything in GSC or the
// site. Fixes are separate reviewed tasks.
//
// Exit codes: 0 = audit ran (even with per-URL errors, fail-soft),
//             2 = cannot run at all (missing key / auth / sitemap).

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { google } from "googleapis";

const PROPERTY = "sc-domain:miltonly.com";
const APEX = "https://miltonly.com";
const SITEMAP_URL = "https://miltonly.com/sitemap.xml";
// Canonical-host flip date (www -> apex, 2026-07-17). Stale-crawl states
// from before this date get the TRANSITION tag, not a defect class.
const FLIP_DATE = "2026-07-17";

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), "gsc-coverage-out");
const STATE_FILE = join(OUT_DIR, "state.json");
const LATEST_FILE = join(OUT_DIR, "latest.json");

// --- CLI ----------------------------------------------------------------
const args = process.argv.slice(2);
const MAX_INSPECTIONS = (() => {
  const m = args.find((a) => a.startsWith("--max="));
  return m ? Math.max(1, parseInt(m.slice(6), 10) || 550) : 550;
})();
const FRESH = args.includes("--fresh");
const DRY = args.includes("--dry");

// --- classes ------------------------------------------------------------
type CoverageClass =
  | "INDEXED"
  | "CANONICAL_CONFLICT"
  | "REDIRECT_ERROR"
  | "SERVER_ERROR"
  | "SOFT_404"
  | "BLOCKED"
  | "CRAWLED_NOT_INDEXED"
  | "DISCOVERED_NOT_CRAWLED"
  | "UNKNOWN_TO_GOOGLE"
  | "INSPECT_ERROR"
  | "UNKNOWN";

interface InspectionRecord {
  url: string;
  cls: CoverageClass;
  transition: boolean; // apex-www transition noise, expected to converge
  coverageState: string | null;
  verdict: string | null;
  googleCanonical: string | null;
  lastCrawl: string | null;
  robotsTxtState: string | null;
  pageFetchState: string | null;
  error?: string;
  inspectedAt: string;
}

interface StateFile {
  createdAt: string;
  sitemapCount: number;
  positives: string[];
  residual: string[];
  inspected: Record<string, InspectionRecord>;
}

// --- helpers ------------------------------------------------------------
const errMsg = (e: unknown, max = 160) =>
  (e instanceof Error ? e.message : String(e)).slice(0, max);

const dayStr = (daysAgo: number) =>
  new Date(Date.now() - daysAgo * 86400000).toISOString().slice(0, 10);

// Normalize a URL to its apex identity for set comparisons:
// https, www -> apex host, no query/fragment, no trailing slash (root stays "/").
function norm(raw: string): string {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return raw.trim();
  }
  u.protocol = "https:";
  if (u.hostname === "www.miltonly.com") u.hostname = "miltonly.com";
  u.hash = "";
  u.search = "";
  let s = u.toString();
  if (u.pathname !== "/" && s.endsWith("/")) s = s.slice(0, -1);
  return s;
}

function envKey(): string | null {
  if (process.env.GSC_SERVICE_ACCOUNT_KEY) return process.env.GSC_SERVICE_ACCOUNT_KEY;
  try {
    const m = readFileSync(".env", "utf8").match(/^GSC_SERVICE_ACCOUNT_KEY=(.*)$/m);
    if (!m) return null;
    let v = m[1].trim();
    if ((v.startsWith("'") && v.endsWith("'")) || (v.startsWith('"') && v.endsWith('"'))) {
      v = v.slice(1, -1);
    }
    return v || null;
  } catch {
    return null;
  }
}

// coverageState sentence -> class. States documented at
// https://support.google.com/webmasters/answer/7440203 (API returns the
// same human sentences via indexStatusResult.coverageState).
function classify(r: {
  coverageState?: string | null;
  verdict?: string | null;
  googleCanonical?: string | null;
  lastCrawlTime?: string | null;
  url: string;
}): { cls: CoverageClass; transition: boolean } {
  const c = (r.coverageState || "").toLowerCase();
  const canon = r.googleCanonical || null;
  const lastCrawl = r.lastCrawlTime ? r.lastCrawlTime.slice(0, 10) : null;
  const canonMismatch = canon !== null && norm(canon) !== norm(r.url);
  const canonIsTwin = canon !== null && norm(canon) === norm(r.url) && canon.replace(/\/+$/, "") !== r.url.replace(/\/+$/, "");
  const staleCrawl = lastCrawl !== null && lastCrawl < FLIP_DATE;

  let cls: CoverageClass;
  if (c.includes("submitted and indexed") || c.startsWith("indexed")) cls = "INDEXED";
  else if (c.startsWith("crawled")) cls = "CRAWLED_NOT_INDEXED";
  else if (c.startsWith("discovered")) cls = "DISCOVERED_NOT_CRAWLED";
  else if (c.includes("duplicate")) cls = "CANONICAL_CONFLICT";
  else if (c.includes("redirect")) cls = "REDIRECT_ERROR";
  else if (c.includes("soft 404")) cls = "SOFT_404";
  else if (c.includes("server error") || c.includes("5xx")) cls = "SERVER_ERROR";
  else if (c.includes("blocked") || c.includes("noindex") || c.includes("unauthorized") || c.includes("not found (404)")) cls = "BLOCKED";
  else if (c.includes("unknown to google")) cls = "UNKNOWN_TO_GOOGLE";
  else if (canonMismatch) cls = "CANONICAL_CONFLICT";
  else cls = "UNKNOWN";

  // Canonical mismatch overrides an "indexed" read only when Google indexed
  // a DIFFERENT page for this URL (the conflict is the actionable fact).
  if (cls === "INDEXED" && canonMismatch) cls = "CANONICAL_CONFLICT";

  // TRANSITION overlay: the apex-www flip signature. Either Google's
  // chosen canonical is the host-twin of this URL (same page, other
  // host), or the state was observed on a crawl from before the flip
  // and is a redirect/canonical artifact of the old www-primary world.
  const transition =
    canonIsTwin || (staleCrawl && (cls === "REDIRECT_ERROR" || cls === "CANONICAL_CONFLICT"));

  return { cls, transition };
}

// Priority order of the action queue (most fixable first).
const QUEUE_ORDER: { classes: CoverageClass[]; label: string; advice: string }[] = [
  {
    classes: ["CANONICAL_CONFLICT"],
    label: "FIX NOW - canonical conflicts",
    advice: "Google chose a different canonical. Verify our canonical tag + internal links agree, then request reindex after convergence.",
  },
  {
    classes: ["REDIRECT_ERROR", "SERVER_ERROR", "SOFT_404", "BLOCKED"],
    label: "FIX NOW - fetch/serve errors",
    advice: "Page does not serve a clean 200 to Google. Fix the response, then the page can re-enter the pipeline.",
  },
  {
    classes: ["CRAWLED_NOT_INDEXED"],
    label: "REVIEW - crawled but not indexed",
    advice: "Google saw the page and declined. Content-quality/uniqueness signal - strengthen content, internal links, or consolidate.",
  },
  {
    classes: ["DISCOVERED_NOT_CRAWLED", "UNKNOWN_TO_GOOGLE"],
    label: "PATIENCE - not yet crawled",
    advice: "In Google's queue (or not yet discovered). Normal for a young site. Internal linking + steady crawl budget resolve this.",
  },
  {
    classes: ["INSPECT_ERROR", "UNKNOWN"],
    label: "INVESTIGATE - could not classify",
    advice: "Inspection failed or returned an unrecognized state. Re-run for these URLs; if persistent, inspect manually in GSC UI.",
  },
];

function pad(s: string, w: number): string {
  return s.length >= w ? s.slice(0, w) : s + " ".repeat(w - s.length);
}

// --- state --------------------------------------------------------------
function loadState(): StateFile | null {
  if (FRESH || !existsSync(STATE_FILE)) return null;
  try {
    return JSON.parse(readFileSync(STATE_FILE, "utf8")) as StateFile;
  } catch {
    return null;
  }
}

function saveState(s: StateFile): void {
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(STATE_FILE, JSON.stringify(s, null, 2));
}

// --- main ---------------------------------------------------------------
async function main(): Promise<void> {
  console.log("=".repeat(64));
  console.log("  GSC INDEX-COVERAGE AUDIT  (diagnose-only, quota-aware)");
  console.log(`  property: ${PROPERTY}   run: ${new Date().toISOString()}`);
  console.log("=".repeat(64));

  const rawKey = envKey();
  if (!rawKey) {
    console.error("FATAL: GSC_SERVICE_ACCOUNT_KEY not set (checked process env and .env)");
    process.exit(2);
  }
  let sc: ReturnType<typeof google.searchconsole>;
  try {
    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(rawKey),
      scopes: ["https://www.googleapis.com/auth/webmasters.readonly"],
    });
    sc = google.searchconsole({ version: "v1", auth });
  } catch (e) {
    console.error("FATAL: GSC auth setup failed: " + errMsg(e));
    process.exit(2);
  }

  // 1) Sitemap URL list (live)
  let sitemapUrls: string[] = [];
  try {
    const xml = await (await fetch(SITEMAP_URL)).text();
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
    if (xml.includes("<sitemapindex")) {
      for (const child of locs) {
        const cx = await (await fetch(child)).text();
        sitemapUrls.push(...[...cx.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim()));
      }
    } else {
      sitemapUrls = locs;
    }
  } catch (e) {
    console.error("FATAL: could not fetch/parse sitemap: " + errMsg(e));
    process.exit(2);
  }
  const sitemapNorm = [...new Set(sitemapUrls.map(norm))];
  console.log(`\n[1] sitemap: ${sitemapUrls.length} <loc> entries -> ${sitemapNorm.length} unique normalized URLs`);

  // 2) Positive set: pages with impressions in the last 30 days (1 API call).
  //    GSC data lags ~2 days, so the window is [32d ago .. 2d ago].
  let positives = new Set<string>();
  try {
    const res = await sc.searchanalytics.query({
      siteUrl: PROPERTY,
      requestBody: {
        startDate: dayStr(32),
        endDate: dayStr(2),
        dimensions: ["page"],
        rowLimit: 25000,
      },
    });
    for (const row of res.data.rows || []) {
      if ((row.impressions || 0) > 0 && row.keys && row.keys[0]) positives.add(norm(row.keys[0]));
    }
  } catch (e) {
    console.error("WARN: search-analytics positive set failed (" + errMsg(e) + ") - all sitemap URLs become residual");
  }
  const positiveInSitemap = sitemapNorm.filter((u) => positives.has(u));
  console.log(`[2] positive set (30d impressions): ${positives.size} pages total, ${positiveInSitemap.length} of them in the sitemap -> INDEXED for free`);

  // 3) Residual -> URL Inspection (resumable)
  const residual = sitemapNorm.filter((u) => !positives.has(u));
  let state = loadState();
  const stateReusable =
    state !== null &&
    Math.abs(state.sitemapCount - sitemapNorm.length) <= 25; // sitemap drifted too far -> start over
  if (!stateReusable) {
    state = {
      createdAt: new Date().toISOString(),
      sitemapCount: sitemapNorm.length,
      positives: positiveInSitemap,
      residual,
      inspected: {},
    };
  } else {
    // refresh the cheap signals on every run; keep completed inspections
    state!.positives = positiveInSitemap;
    state!.residual = residual;
  }
  const st = state!;
  // INSPECT_ERROR records (transient network/API failures) do NOT count as
  // done - they retry automatically on the next run.
  const isDone = (u: string) => {
    const r = st.inspected[u];
    return Boolean(r) && r.cls !== "INSPECT_ERROR";
  };
  const alreadyDone = residual.filter(isDone);
  const pending = residual.filter((u) => !isDone(u));
  const batch = pending.slice(0, MAX_INSPECTIONS);

  console.log(`[3] residual (zero impressions, needs inspection): ${residual.length}`);
  console.log(`    already inspected in prior runs: ${alreadyDone.length}`);
  console.log(`    pending: ${pending.length}; this run will spend ${DRY ? 0 : batch.length} Inspection calls (cap ${MAX_INSPECTIONS}, quota ~2000/day)`);

  if (DRY) {
    console.log("\n--dry: stopping before any Inspection calls.");
    return;
  }

  // Worker pool of 4 with a 120ms courtesy gap per call: ~<480 calls/min,
  // safely under the ~600/min burst ceiling.
  let idx = 0;
  let spent = 0;
  async function worker(): Promise<void> {
    for (;;) {
      const i = idx++;
      if (i >= batch.length) return;
      const url = batch[i];
      try {
        const res = await sc.urlInspection.index.inspect({
          requestBody: { inspectionUrl: url, siteUrl: PROPERTY },
        });
        const r = (res.data.inspectionResult || {}).indexStatusResult || {};
        const { cls, transition } = classify({
          coverageState: r.coverageState,
          verdict: r.verdict,
          googleCanonical: r.googleCanonical,
          lastCrawlTime: r.lastCrawlTime,
          url,
        });
        st.inspected[url] = {
          url,
          cls,
          transition,
          coverageState: r.coverageState || null,
          verdict: r.verdict || null,
          googleCanonical: r.googleCanonical || null,
          lastCrawl: r.lastCrawlTime ? r.lastCrawlTime.slice(0, 10) : null,
          robotsTxtState: r.robotsTxtState || null,
          pageFetchState: r.pageFetchState || null,
          inspectedAt: new Date().toISOString(),
        };
      } catch (e) {
        st.inspected[url] = {
          url,
          cls: "INSPECT_ERROR",
          transition: false,
          coverageState: null,
          verdict: null,
          googleCanonical: null,
          lastCrawl: null,
          robotsTxtState: null,
          pageFetchState: null,
          error: errMsg(e),
          inspectedAt: new Date().toISOString(),
        };
      }
      spent++;
      if (spent % 50 === 0) {
        saveState(st); // checkpoint every 50 calls
        console.log(`    ...${spent}/${batch.length} inspected`);
      }
      await new Promise((r2) => setTimeout(r2, 120));
    }
  }
  await Promise.all([worker(), worker(), worker(), worker()]);
  saveState(st);
  console.log(`    inspection spend this run: ${spent} calls`);

  // 4) Classify + report
  const records: InspectionRecord[] = residual
    .map((u) => st.inspected[u])
    .filter((r): r is InspectionRecord => Boolean(r));
  const notYet = residual.length - records.length;

  const counts = new Map<string, number>();
  const bump = (k: string) => counts.set(k, (counts.get(k) || 0) + 1);
  for (const u of positiveInSitemap) bump("INDEXED");
  for (const r of records) {
    if (r.cls === "INDEXED") bump("INDEXED");
    else if (r.transition) bump("TRANSITION:" + r.cls);
    else bump(r.cls);
  }

  console.log("\n" + "=".repeat(64));
  console.log("  CLASSIFICATION  (sitemap universe: " + sitemapNorm.length + " URLs)");
  console.log("=".repeat(64));
  console.log("  " + pad("CLASS", 40) + pad("COUNT", 8) + "SHARE");
  const totalKnown = sitemapNorm.length;
  for (const [k, v] of [...counts.entries()].sort((a, b) => b[1] - a[1])) {
    console.log("  " + pad(k, 40) + pad(String(v), 8) + ((100 * v) / totalKnown).toFixed(1) + "%");
  }
  if (notYet > 0) console.log("  " + pad("(not yet inspected - resume later)", 40) + pad(String(notYet), 8) + ((100 * notYet) / totalKnown).toFixed(1) + "%");

  // 5) Action queue
  console.log("\n" + "=".repeat(64));
  console.log("  ACTION QUEUE  (most fixable first; TRANSITION excluded)");
  console.log("=".repeat(64));
  const transitionRecs = records.filter((r) => r.transition && r.cls !== "INDEXED");
  for (const group of QUEUE_ORDER) {
    const hits = records.filter((r) => !r.transition && group.classes.includes(r.cls));
    if (hits.length === 0) continue;
    console.log(`\n  ${group.label}  [${hits.length}]`);
    console.log(`  ${group.advice}`);
    for (const h of hits) {
      const extra =
        h.cls === "CANONICAL_CONFLICT" && h.googleCanonical
          ? `  -> google chose: ${h.googleCanonical}`
          : h.error
            ? `  (${h.error})`
            : h.lastCrawl
              ? `  (last crawl ${h.lastCrawl})`
              : "";
      console.log(`    ${h.url.replace(APEX, "") || "/"}${extra}`);
    }
  }
  if (transitionRecs.length > 0) {
    console.log(`\n  TRANSITION - apex-www convergence noise  [${transitionRecs.length}]  (expected after the 2026-07-17 flip; no action, re-audit in 1-2 weeks)`);
    for (const t of transitionRecs.slice(0, 20)) {
      console.log(`    ${t.url.replace(APEX, "") || "/"}  [${t.cls}]${t.googleCanonical ? `  google canonical: ${t.googleCanonical}` : ""}`);
    }
    if (transitionRecs.length > 20) console.log(`    ...and ${transitionRecs.length - 20} more`);
  }

  // 6) JSON artifact + trend vs previous run
  const indexedCount = counts.get("INDEXED") || 0;
  let trend = "";
  try {
    if (existsSync(LATEST_FILE)) {
      const prev = JSON.parse(readFileSync(LATEST_FILE, "utf8"));
      const prevIdx = prev?.summary?.indexed ?? null;
      if (typeof prevIdx === "number") {
        const d = indexedCount - prevIdx;
        trend = `indexed ${prevIdx} -> ${indexedCount} (${d >= 0 ? "+" : ""}${d}) since ${prev?.runAt?.slice(0, 10) || "previous run"}`;
      }
    }
  } catch {
    /* fail-soft on trend */
  }
  const artifact = {
    runAt: new Date().toISOString(),
    property: PROPERTY,
    sitemapCount: sitemapNorm.length,
    summary: {
      indexed: indexedCount,
      byClass: Object.fromEntries(counts.entries()),
      pendingInspection: notYet,
      inspectionSpendThisRun: spent,
    },
    positives: positiveInSitemap,
    records,
  };
  mkdirSync(OUT_DIR, { recursive: true });
  const dailyFile = join(OUT_DIR, `audit-${new Date().toISOString().slice(0, 10)}.json`);
  writeFileSync(dailyFile, JSON.stringify(artifact, null, 2));
  writeFileSync(LATEST_FILE, JSON.stringify(artifact, null, 2));

  console.log("\n" + "=".repeat(64));
  console.log(`  indexed: ${indexedCount}/${sitemapNorm.length}` + (notYet > 0 ? `  (${notYet} still pending inspection)` : ""));
  if (trend) console.log(`  trend: ${trend}`);
  console.log(`  inspection spend this run: ${spent} (state: ${STATE_FILE})`);
  console.log(`  artifact: ${dailyFile}`);
  console.log("=".repeat(64));
}

main().catch((e) => {
  console.error("FATAL: " + errMsg(e, 400));
  process.exit(2);
});

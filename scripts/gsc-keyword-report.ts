// GSC KEYWORD-OPPORTUNITY REPORT
// ============================================================
// Standalone, read-only against GSC (same service account + apex
// property + fail-soft discipline as gsc-coverage-audit.ts):
//   npx tsx scripts/gsc-keyword-report.ts
//
// Pulls 90d of search analytics (respecting the ~2d data lag),
// classifies every query, and emits per-class ASCII tables + a
// CONTENT TARGET queue + a JSON artifact for run-over-run diffing
// (scripts/gsc-coverage-out/keywords-<date>.json, gitignored).
//
// The classifier + entity token matcher live in src/lib/seo/keywords.ts —
// ONE implementation shared with the /api/seo/sense weekly cron (organic
// growth loop piece 1). This script is the human-readable renderer.
//
// Classes:
//   WINNING            clicks > 0 and position <= 10 (protect)
//   SEEN_NOT_CLICKED   impressions >= 5, clicks = 0, position <= 20
//   STRIKING_DISTANCE  position 11-30, impressions >= 5
//   NO_PAGE_MATCH      query rides a weak/generic page or has no
//                      dedicated URL - CONTENT TARGETS
//   Branded (miltonly) queries are reported separately.
//
// Exit codes: 0 = report ran, 2 = cannot run at all (key/auth/API).

import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  getSearchConsole,
  fetchSitemapUrls,
  GSC_PROPERTY,
  APEX,
  dayStr,
  type SearchConsole,
} from "@/lib/seo/gscClient";
import {
  buildEntities,
  classifyKeywords,
  pullKeywordData,
  type ClassifiedKeyword,
  type SeoEntity,
} from "@/lib/seo/keywords";

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), "gsc-coverage-out");

const errMsg = (e: unknown, max = 200) =>
  (e instanceof Error ? e.message : String(e)).slice(0, max);

const pad = (s: string, w: number) => (s.length >= w ? s.slice(0, w - 1) + "…" : s + " ".repeat(w - s.length));
const num = (n: number, w: number) => String(n).padStart(w);
const pct = (n: number) => (100 * n).toFixed(1) + "%";
const num2h = (h: string) => h.padStart(h === "IMPR" ? 6 : 5);

async function main(): Promise<void> {
  console.log("=".repeat(70));
  console.log("  GSC KEYWORD-OPPORTUNITY REPORT  (read-only, 90d window)");
  console.log(`  property: ${GSC_PROPERTY}   window: ${dayStr(92)} .. ${dayStr(2)}   run: ${new Date().toISOString()}`);
  console.log("=".repeat(70));

  let sc: SearchConsole;
  try {
    sc = getSearchConsole();
  } catch (e) {
    console.error("FATAL: GSC auth setup failed: " + errMsg(e));
    process.exit(2);
  }

  // Entity index from the live sitemap (fail-soft: report still runs without it).
  let entities: SeoEntity[] = [];
  try {
    const urls = await fetchSitemapUrls();
    entities = buildEntities(urls.map((u) => u.replace(APEX, "") || "/"));
    console.log(`\n[0] entity index: ${entities.length} street/condo/school/mosque/neighbourhood pages from sitemap`);
  } catch (e) {
    console.error("WARN: sitemap fetch failed (" + errMsg(e) + ") - NO_PAGE_MATCH ownership naming disabled");
  }

  let classified: ClassifiedKeyword[];
  try {
    const { qRows, qpRows } = await pullKeywordData(sc);
    console.log(`[1] pulled ${qRows.length} queries, ${qpRows.length} query-page rows`);
    classified = classifyKeywords(qRows, qpRows, entities);
  } catch (e) {
    console.error("FATAL: searchanalytics pull failed: " + errMsg(e, 400));
    process.exit(2);
  }

  const brandedRows = classified.filter((c) => c.branded);
  const organic = classified.filter((c) => !c.branded);
  const byCls = (c: string) => organic.filter((x) => x.cls === c).sort((a, b) => b.impressions - a.impressions);

  const winning = byCls("WINNING");
  const seenNotClicked = byCls("SEEN_NOT_CLICKED");
  const striking = byCls("STRIKING_DISTANCE");
  const noPageMatch = byCls("NO_PAGE_MATCH");
  const contentTargets = organic
    .filter((c) => c.shouldOwn !== null || c.needsPage)
    .sort((a, b) => b.impressions - a.impressions);

  const table = (title: string, rows: ClassifiedKeyword[], pageCol: (c: ClassifiedKeyword) => string, cap = 30) => {
    console.log("\n" + "=".repeat(70));
    console.log(`  ${title}  [${rows.length}]`);
    console.log("=".repeat(70));
    if (rows.length === 0) {
      console.log("  (none)");
      return;
    }
    console.log("  " + pad("QUERY", 38) + num2h("IMPR") + num2h("CLK") + "  " + pad("CTR", 7) + pad("POS", 6) + "PAGE");
    for (const c of rows.slice(0, cap)) {
      console.log(
        "  " + pad(c.query, 38) + num(c.impressions, 6) + num(c.clicks, 5) + "  " +
        pad(pct(c.ctr), 7) + pad(c.position.toFixed(1), 6) + pageCol(c),
      );
    }
    if (rows.length > cap) console.log(`  ...and ${rows.length - cap} more (full list in the JSON artifact)`);
  };

  table("WINNING - protect these (clicks > 0, position <= 10)", winning, (c) => c.winningPage ?? "-");
  table("SEEN-NOT-CLICKED - title/meta opportunity (impr >= 5, 0 clicks, pos <= 20)", seenNotClicked, (c) => c.topPage ?? "-");
  table("STRIKING-DISTANCE - strengthen page / internal links (pos 11-30, impr >= 5)", striking, (c) => c.topPage ?? "-");
  table("NO-PAGE-MATCH - query rides the wrong/no page", noPageMatch, (c) =>
    c.shouldOwn ? `${c.topPage ?? "-"} -> should own: ${c.shouldOwn}` : `${c.topPage ?? "-"} (no dedicated URL)`);

  console.log("\n" + "=".repeat(70));
  console.log(`  CONTENT TARGET QUEUE - ranked by impressions  [${contentTargets.length}]`);
  console.log("=".repeat(70));
  for (const c of contentTargets.slice(0, 40)) {
    const owner = c.shouldOwn
      ? `EXISTING page should own it: ${c.shouldOwn} (now riding ${c.topPage})`
      : `NO dedicated URL (riding ${c.topPage}) - content target`;
    console.log(`  ${num(c.impressions, 5)} impr  pos ${c.position.toFixed(1).padStart(5)}  "${c.query}"`);
    console.log(`         ${owner}  [${c.cls}]`);
  }
  if (contentTargets.length > 40) console.log(`  ...and ${contentTargets.length - 40} more (JSON artifact)`);

  console.log("\n" + "=".repeat(70));
  console.log(`  BRANDED (miltonly) - reported separately  [${brandedRows.length}]`);
  console.log("=".repeat(70));
  for (const c of brandedRows.slice(0, 15)) {
    console.log("  " + pad(c.query, 38) + num(c.impressions, 6) + num(c.clicks, 5) + "  " + pad(pct(c.ctr), 7) + c.position.toFixed(1));
  }

  const totalClicks = classified.reduce((s, c) => s + c.clicks, 0);
  const totalImpr = classified.reduce((s, c) => s + c.impressions, 0);
  const artifact = {
    runAt: new Date().toISOString(),
    property: GSC_PROPERTY,
    window: { start: dayStr(92), end: dayStr(2) },
    totals: { queries: classified.length, impressions: totalImpr, clicks: totalClicks },
    counts: {
      winning: winning.length,
      seenNotClicked: seenNotClicked.length,
      strikingDistance: striking.length,
      noPageMatch: noPageMatch.length,
      contentTargets: contentTargets.length,
      branded: brandedRows.length,
    },
    winning,
    seenNotClicked,
    strikingDistance: striking,
    noPageMatch,
    contentTargets,
    branded: brandedRows,
  };
  try {
    mkdirSync(OUT_DIR, { recursive: true });
    const file = join(OUT_DIR, `keywords-${new Date().toISOString().slice(0, 10)}.json`);
    writeFileSync(file, JSON.stringify(artifact, null, 2));
    console.log("\n" + "=".repeat(70));
    console.log(`  totals: ${classified.length} queries, ${totalImpr} impressions, ${totalClicks} clicks (90d)`);
    console.log(`  winning ${winning.length} | seen-not-clicked ${seenNotClicked.length} | striking ${striking.length} | no-page-match ${noPageMatch.length} | content targets ${contentTargets.length} | branded ${brandedRows.length}`);
    console.log(`  artifact: ${file}`);
    console.log("=".repeat(70));
  } catch (e) {
    console.error("WARN: artifact write failed: " + errMsg(e));
  }
}

main().catch((e) => {
  console.error("FATAL: " + errMsg(e, 400));
  process.exit(2);
});

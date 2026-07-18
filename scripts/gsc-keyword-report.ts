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
// Classes:
//   WINNING            clicks > 0 and position <= 10 (protect)
//   SEEN_NOT_CLICKED   impressions >= 5, clicks = 0, position <= 20
//                      (title/meta opportunity)
//   STRIKING_DISTANCE  position 11-30, impressions >= 5
//                      (strengthen page / internal links)
//   NO_PAGE_MATCH      query rides a weak/generic page or has no
//                      dedicated URL - CONTENT TARGETS. Where the query
//                      maps to an entity we already have (street /
//                      condo / school / mosque / neighbourhood), the
//                      report names WHICH page should own it.
//   Branded (miltonly) queries are reported separately, never as
//   opportunities.
//
// Exit codes: 0 = report ran, 2 = cannot run at all (key/auth/API).

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { google } from "googleapis";

const PROPERTY = "sc-domain:miltonly.com";
const APEX = "https://miltonly.com";
const SITEMAP_URL = "https://miltonly.com/sitemap.xml";
const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), "gsc-coverage-out");

const MIN_IMPRESSIONS = 5;

// Hub/index/utility pages: a query resting here that maps to a specific
// entity is a content-ownership gap, not a win for the hub.
const GENERIC_PAGES = new Set([
  "/", "/listings", "/streets", "/neighbourhoods", "/condos", "/schools",
  "/mosques", "/sold", "/compare", "/sell", "/rentals", "/about",
  "/condos-guide", "/freehold", "/potl", "/value", "/blog", "/saved",
]);

// --- helpers ------------------------------------------------------------
const errMsg = (e: unknown, max = 200) =>
  (e instanceof Error ? e.message : String(e)).slice(0, max);

const dayStr = (daysAgo: number) =>
  new Date(Date.now() - daysAgo * 86400000).toISOString().slice(0, 10);

const pathOf = (url: string) => {
  try {
    const u = new URL(url);
    let p = u.pathname;
    if (p !== "/" && p.endsWith("/")) p = p.slice(0, -1);
    return p;
  } catch {
    return url;
  }
};

const pad = (s: string, w: number) => (s.length >= w ? s.slice(0, w - 1) + "…" : s + " ".repeat(w - s.length));
const num = (n: number, w: number) => String(n).padStart(w);
const pct = (n: number) => (100 * n).toFixed(1) + "%";

function envKey(): string | null {
  if (process.env.GSC_SERVICE_ACCOUNT_KEY) return process.env.GSC_SERVICE_ACCOUNT_KEY;
  try {
    const m = readFileSync(".env", "utf8").match(/^GSC_SERVICE_ACCOUNT_KEY=(.*)$/m);
    if (!m) return null;
    let v = m[1].trim();
    if ((v.startsWith("'") && v.endsWith("'")) || (v.startsWith('"') && v.endsWith('"'))) v = v.slice(1, -1);
    return v || null;
  } catch {
    return null;
  }
}

// --- types --------------------------------------------------------------
interface QueryAgg {
  query: string;
  impressions: number;
  clicks: number;
  ctr: number;
  position: number;
}
interface QueryPageRow extends QueryAgg {
  page: string; // path form
}
type KeywordClass = "WINNING" | "SEEN_NOT_CLICKED" | "STRIKING_DISTANCE" | "NO_PAGE_MATCH" | "OTHER";

interface Classified extends QueryAgg {
  cls: KeywordClass;
  branded: boolean;
  topPage: string | null; // page with most impressions for this query
  winningPage: string | null; // page with most clicks (WINNING only)
  shouldOwn: string | null; // entity page that should own the query (content target)
  needsPage: boolean; // content target with no existing dedicated URL
}

// --- entity index from the live sitemap ---------------------------------
interface Entity {
  path: string;
  tokens: string[]; // non-noise slug tokens, lowercased
  name: string;
}
const NOISE_TOKENS = new Set(["milton", "ps", "ss", "es", "n", "a", "catholic", "secondary", "school"]);

function buildEntities(paths: string[]): Entity[] {
  const out: Entity[] = [];
  for (const p of paths) {
    const m = p.match(/^\/(streets|condos|schools|mosques|neighbourhoods)\/([^/]+)$/);
    if (!m) continue;
    const tokens = m[2].split("-").filter((t) => t && !NOISE_TOKENS.has(t));
    if (tokens.length === 0) continue;
    out.push({ path: p, tokens, name: tokens.join(" ") });
  }
  return out;
}

// Best entity for a query: every non-numeric token of the entity appears in
// the query (whole-word). Prefer most matched tokens, then longest name.
function matchEntity(query: string, entities: Entity[]): Entity | null {
  const qWords = new Set(query.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean));
  let best: Entity | null = null;
  let bestScore = 0;
  for (const e of entities) {
    const textual = e.tokens.filter((t) => !/^\d+$/.test(t));
    if (textual.length === 0) continue;
    // single-token entities need a distinctive token (>=5 chars) to match
    if (textual.length === 1 && textual[0].length < 5) continue;
    if (!textual.every((t) => qWords.has(t))) continue;
    const score = textual.length * 100 + e.name.length;
    if (score > bestScore) {
      best = e;
      bestScore = score;
    }
  }
  return best;
}

// --- GSC pulls ----------------------------------------------------------
async function pullAll(
  sc: ReturnType<typeof google.searchconsole>,
  dimensions: string[],
): Promise<Array<{ keys: string[]; clicks: number; impressions: number; ctr: number; position: number }>> {
  const rows: Array<{ keys: string[]; clicks: number; impressions: number; ctr: number; position: number }> = [];
  const LIMIT = 25000;
  for (let startRow = 0; ; startRow += LIMIT) {
    const res = await sc.searchanalytics.query({
      siteUrl: PROPERTY,
      requestBody: {
        startDate: dayStr(92),
        endDate: dayStr(2),
        dimensions,
        rowLimit: LIMIT,
        startRow,
      },
    });
    const batch = res.data.rows ?? [];
    for (const r of batch) {
      rows.push({
        keys: (r.keys ?? []) as string[],
        clicks: r.clicks ?? 0,
        impressions: r.impressions ?? 0,
        ctr: r.ctr ?? 0,
        position: r.position ?? 0,
      });
    }
    if (batch.length < LIMIT) break;
  }
  return rows;
}

// --- main ---------------------------------------------------------------
async function main(): Promise<void> {
  console.log("=".repeat(70));
  console.log("  GSC KEYWORD-OPPORTUNITY REPORT  (read-only, 90d window)");
  console.log(`  property: ${PROPERTY}   window: ${dayStr(92)} .. ${dayStr(2)}   run: ${new Date().toISOString()}`);
  console.log("=".repeat(70));

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

  // Entity index from the live sitemap (fail-soft: report still runs without it).
  let entities: Entity[] = [];
  try {
    const xml = await (await fetch(SITEMAP_URL)).text();
    let locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
    if (xml.includes("<sitemapindex")) {
      const children = locs;
      locs = [];
      for (const child of children) {
        const cx = await (await fetch(child)).text();
        locs.push(...[...cx.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim()));
      }
    }
    entities = buildEntities(locs.map(pathOf));
    console.log(`\n[0] entity index: ${entities.length} street/condo/school/mosque/neighbourhood pages from sitemap`);
  } catch (e) {
    console.error("WARN: sitemap fetch failed (" + errMsg(e) + ") - NO_PAGE_MATCH ownership naming disabled");
  }

  // Pull 1: per-query aggregates. Pull 2: query x page.
  let qRows: QueryAgg[];
  let qpRows: QueryPageRow[];
  try {
    const [qs, qps] = await Promise.all([pullAll(sc, ["query"]), pullAll(sc, ["query", "page"])]);
    qRows = qs.map((r) => ({ query: r.keys[0] ?? "", impressions: r.impressions, clicks: r.clicks, ctr: r.ctr, position: r.position }));
    qpRows = qps.map((r) => ({
      query: r.keys[0] ?? "",
      page: pathOf(r.keys[1] ?? ""),
      impressions: r.impressions,
      clicks: r.clicks,
      ctr: r.ctr,
      position: r.position,
    }));
  } catch (e) {
    console.error("FATAL: searchanalytics pull failed: " + errMsg(e, 400));
    process.exit(2);
  }
  console.log(`[1] pulled ${qRows.length} queries, ${qpRows.length} query-page rows`);

  const entityByPath = new Map(entities.map((e) => [e.path, e]));

  // Per-query page rollups.
  const pagesByQuery = new Map<string, QueryPageRow[]>();
  for (const r of qpRows) {
    const list = pagesByQuery.get(r.query);
    if (list) list.push(r);
    else pagesByQuery.set(r.query, [r]);
  }

  // Classify.
  const classified: Classified[] = qRows.map((q) => {
    const pages = (pagesByQuery.get(q.query) ?? []).slice().sort((a, b) => b.impressions - a.impressions);
    const topPage = pages[0]?.page ?? null;
    const byClicks = pages.slice().sort((a, b) => b.clicks - a.clicks);
    const winningPage = byClicks[0] && byClicks[0].clicks > 0 ? byClicks[0].page : topPage;
    const branded = /milton\s?ly/.test(q.query.toLowerCase().replace(/\s+/g, " ")) || q.query.toLowerCase().includes("miltonly");

    let cls: KeywordClass = "OTHER";
    if (q.clicks > 0 && q.position <= 10) cls = "WINNING";
    else if (q.impressions >= MIN_IMPRESSIONS && q.clicks === 0 && q.position <= 20) cls = "SEEN_NOT_CLICKED";
    else if (q.position > 10 && q.position <= 30 && q.impressions >= MIN_IMPRESSIONS) cls = "STRIKING_DISTANCE";

    // Entity ownership (content targets) - never demote a WINNING query.
    let shouldOwn: string | null = null;
    let needsPage = false;
    if (!branded && cls !== "WINNING" && q.impressions >= MIN_IMPRESSIONS && topPage !== null) {
      // If the page already ranking is itself a full-token entity match for
      // this query, it owns it - do not hand ownership to a longer-named
      // sibling entity (e.g. /streets/farmstead-drive-milton must not lose
      // "farmstead drive" to /condos/610-farmstead-drive-milton).
      const topEnt = entityByPath.get(topPage);
      const qWords = new Set(q.query.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean));
      const topOwns =
        topEnt !== undefined &&
        topEnt.tokens.filter((t) => !/^\d+$/.test(t)).every((t) => qWords.has(t));
      const ent = !topOwns && entities.length > 0 ? matchEntity(q.query, entities) : null;
      if (ent && topPage !== ent.path) {
        shouldOwn = ent.path; // an existing page should own this query
        if (cls === "OTHER") cls = "NO_PAGE_MATCH";
      } else if (!ent && GENERIC_PAGES.has(topPage) && cls === "OTHER") {
        needsPage = true; // entity-less query resting on a generic page
        cls = "NO_PAGE_MATCH";
      }
    }

    return { ...q, cls, branded, topPage, winningPage, shouldOwn, needsPage };
  });

  const brandedRows = classified.filter((c) => c.branded);
  const organic = classified.filter((c) => !c.branded);
  const byCls = (c: KeywordClass) => organic.filter((x) => x.cls === c).sort((a, b) => b.impressions - a.impressions);

  const winning = byCls("WINNING");
  const seenNotClicked = byCls("SEEN_NOT_CLICKED");
  const striking = byCls("STRIKING_DISTANCE");
  const noPageMatch = byCls("NO_PAGE_MATCH");
  // Content targets: every non-winning query where an entity page should own
  // it, or where no dedicated URL exists - ranked by impressions.
  const contentTargets = organic
    .filter((c) => c.shouldOwn !== null || c.needsPage)
    .sort((a, b) => b.impressions - a.impressions);

  const table = (title: string, rows: Classified[], pageCol: (c: Classified) => string, cap = 30) => {
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
  const num2h = (h: string) => h.padStart(h === "IMPR" ? 6 : 5);

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

  // Summary + artifact.
  const totalClicks = classified.reduce((s, c) => s + c.clicks, 0);
  const totalImpr = classified.reduce((s, c) => s + c.impressions, 0);
  const artifact = {
    runAt: new Date().toISOString(),
    property: PROPERTY,
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

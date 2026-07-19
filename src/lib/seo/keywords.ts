// src/lib/seo/keywords.ts
// The keyword classifier + entity token matcher — ONE implementation shared
// by scripts/gsc-keyword-report.ts (CLI report) and /api/seo/sense (weekly
// cron). Logic extracted verbatim from the CLI script (merged 87c56ec);
// changing behavior here changes both consumers deliberately.
import { GSC_PROPERTY, dayStr, pathOf, normUrl, type SearchConsole } from "./gscClient";

export const MIN_IMPRESSIONS = 5;

// Hub/index/utility pages: a query resting here that maps to a specific
// entity is a content-ownership gap, not a win for the hub.
export const GENERIC_PAGES = new Set([
  "/", "/listings", "/streets", "/neighbourhoods", "/condos", "/schools",
  "/mosques", "/sold", "/compare", "/sell", "/rentals", "/about",
  "/condos-guide", "/freehold", "/potl", "/value", "/blog", "/saved",
]);

export type KeywordClass = "WINNING" | "SEEN_NOT_CLICKED" | "STRIKING_DISTANCE" | "NO_PAGE_MATCH" | "OTHER";

export interface QueryAgg {
  query: string;
  impressions: number;
  clicks: number;
  ctr: number;
  position: number;
}
export interface QueryPageRow extends QueryAgg {
  page: string; // path form
}
export interface ClassifiedKeyword extends QueryAgg {
  cls: KeywordClass;
  branded: boolean;
  topPage: string | null; // page with most impressions for this query
  winningPage: string | null; // page with most clicks (WINNING only)
  shouldOwn: string | null; // entity page that should own the query
  needsPage: boolean; // content target with no existing dedicated URL
}

// --- entity index from the live sitemap ---------------------------------
export interface SeoEntity {
  path: string;
  tokens: string[]; // non-noise slug tokens, lowercased
  name: string;
}
const NOISE_TOKENS = new Set(["milton", "ps", "ss", "es", "n", "a", "catholic", "secondary", "school"]);

export function buildEntities(paths: string[]): SeoEntity[] {
  const out: SeoEntity[] = [];
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
export function matchEntity(query: string, entities: SeoEntity[]): SeoEntity | null {
  const qWords = new Set(query.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean));
  let best: SeoEntity | null = null;
  let bestScore = 0;
  for (const e of entities) {
    const textual = e.tokens.filter((t) => !/^\d+$/.test(t));
    if (textual.length === 0) continue;
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

// --- paginated pulls ----------------------------------------------------
async function pullAll(
  sc: SearchConsole,
  dimensions: string[],
): Promise<Array<{ keys: string[]; clicks: number; impressions: number; ctr: number; position: number }>> {
  const rows: Array<{ keys: string[]; clicks: number; impressions: number; ctr: number; position: number }> = [];
  const LIMIT = 25000;
  for (let startRow = 0; ; startRow += LIMIT) {
    const res = await sc.searchanalytics.query({
      siteUrl: GSC_PROPERTY,
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

export async function pullKeywordData(
  sc: SearchConsole,
): Promise<{ qRows: QueryAgg[]; qpRows: QueryPageRow[] }> {
  const [qs, qps] = await Promise.all([pullAll(sc, ["query"]), pullAll(sc, ["query", "page"])]);
  return {
    qRows: qs.map((r) => ({ query: r.keys[0] ?? "", impressions: r.impressions, clicks: r.clicks, ctr: r.ctr, position: r.position })),
    qpRows: qps.map((r) => ({
      query: r.keys[0] ?? "",
      page: pathOf(r.keys[1] ?? ""),
      impressions: r.impressions,
      clicks: r.clicks,
      ctr: r.ctr,
      position: r.position,
    })),
  };
}

// --- classification -----------------------------------------------------
export function classifyKeywords(
  qRows: QueryAgg[],
  qpRows: QueryPageRow[],
  entities: SeoEntity[],
): ClassifiedKeyword[] {
  const pagesByQuery = new Map<string, QueryPageRow[]>();
  for (const r of qpRows) {
    const list = pagesByQuery.get(r.query);
    if (list) list.push(r);
    else pagesByQuery.set(r.query, [r]);
  }
  const entityByPath = new Map(entities.map((e) => [e.path, e]));

  return qRows.map((q) => {
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
      // sibling entity.
      const topEnt = entityByPath.get(topPage);
      const qWords = new Set(q.query.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean));
      const topOwns =
        topEnt !== undefined &&
        topEnt.tokens.filter((t) => !/^\d+$/.test(t)).every((t) => qWords.has(t));
      const ent = !topOwns && entities.length > 0 ? matchEntity(q.query, entities) : null;
      if (ent && topPage !== ent.path) {
        shouldOwn = ent.path;
        if (cls === "OTHER") cls = "NO_PAGE_MATCH";
      } else if (!ent && GENERIC_PAGES.has(topPage) && cls === "OTHER") {
        needsPage = true;
        cls = "NO_PAGE_MATCH";
      }
    }

    return { ...q, cls, branded, topPage, winningPage, shouldOwn, needsPage };
  });
}

export { normUrl };

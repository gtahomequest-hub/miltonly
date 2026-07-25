// src/lib/geni/matchNeighbourhoods.ts
// GENI Phase 2 — the DETERMINISTIC matcher. Turns Phase-1 whitelist criteria into a ranked,
// card-ready result set. NO LLM, NO prose, NO routing/UI. Every number traces to either the
// Phase-0 table (analytics.neighbourhood_match_stats, read as-is) or the ONE live count query.
//
// INVARIANT: only ever runs on a clean parse (outcome proceed | proceed_with_note). A declined
// result returns empty. No fair-housing guard needed — it only ever sees the whitelist, which has
// no field a proxy can act through.
import { prisma } from "@/lib/prisma";
import { NEIGHBOURHOOD_SEED } from "@/lib/neighbourhood";
import { getNeighbourhoodMatchStats, type NeighbourhoodMatchRow } from "./neighbourhoodMatchRead";
import type { GeniParseResult } from "./parseGeniQuery";
import type { GeniCriteria, PropertyType } from "./parsePrompt";

export interface MatchTag { key: "budget_comfortable" | "near_go" | "active_market"; met: boolean }

export interface RankedMatch {
  slug: string;
  name: string;
  profile: string;
  kind: string;
  liveCount: number; // "N listed now [under $X]"
  typical: number | null; // typical for the requested type (null if no type / rent / no data)
  typicalLowConfidence: boolean; // DEC-GENI-7 — rural tiny-n price skew
  aboveTypicalBudget: boolean; // typical > budget but real matching inventory ("entry-level for the area")
  distGoKm: number | null;
  domAvg: number | null;
  sold12mo: number | null;
  tags: MatchTag[]; // applicable tags only
  metCount: number;
  applicableCount: number;
  listingsUrl: string;
}

export interface MatchResult {
  matches: RankedMatch[];
  notes: string[];
  thresholds: { nearGoKm: number | null; townMedianDom: number | null; townMedianVol: number | null };
  transaction: "sale" | "rent";
}

const TYPE_COL: Record<PropertyType, keyof NeighbourhoodMatchRow> = {
  detached: "typical_detached", semi: "typical_semi", townhouse: "typical_town", condo: "typical_condo",
};
const n = (v: unknown): number | null => (v === null || v === undefined ? null : Number.isFinite(Number(v)) ? Number(v) : null);
function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
// asc comparator with nulls last
const ascNullLast = (a: number | null, b: number | null) => (a === null ? 1 : b === null ? -1 : a - b);
const descNullLast = (a: number | null, b: number | null) => (a === null ? 1 : b === null ? -1 : b - a);

function buildListingsUrl(name: string, c: GeniCriteria, transaction: "sale" | "rent"): string {
  const p = new URLSearchParams();
  p.set("neighbourhood", name);
  if (c.propertyType) p.set("type", c.propertyType);
  if (c.maxPrice) p.set("max", String(c.maxPrice));
  if (c.minPrice) p.set("min", String(c.minPrice));
  if (c.bedrooms) p.set("beds", String(c.bedrooms));
  if (c.bathrooms) p.set("baths", String(c.bathrooms));
  if (transaction === "rent") p.set("status", "rent");
  return `/listings?${p.toString()}`;
}

export async function matchNeighbourhoods(parseResult: GeniParseResult): Promise<MatchResult> {
  const transaction: "sale" | "rent" = parseResult.criteria.transaction ?? "sale";
  if (parseResult.outcome === "declined") {
    return { matches: [], notes: ["Query was declined at the input firewall — no match run."], thresholds: { nearGoKm: null, townMedianDom: null, townMedianVol: null }, transaction };
  }
  const c = parseResult.criteria;

  // ── READ 1: Phase-0 table (as-is; do NOT recompute) ──
  const rows = await getNeighbourhoodMatchStats();

  // ── READ 2: ONE grouped live active-count aggregate (DEC-GENI-2; exact to max, no bands) ──
  const rawToSlug = new Map<string, string>();
  for (const seed of NEIGHBOURHOOD_SEED) for (const rs of seed.rawStrings) rawToSlug.set(rs, seed.slug);
  const priceWhere: { lte?: number; gte?: number } = {};
  if (c.maxPrice) priceWhere.lte = c.maxPrice;
  if (c.minPrice) priceWhere.gte = c.minPrice;
  const grouped = await prisma.listing.groupBy({
    by: ["neighbourhood", "propertyType"],
    where: {
      status: "active",
      permAdvertise: true,
      transactionType: transaction === "rent" ? "For Lease" : "For Sale",
      ...(Object.keys(priceWhere).length ? { price: priceWhere } : {}),
      ...(c.propertyType ? { propertyType: c.propertyType } : {}),
      ...(c.bedrooms ? { bedrooms: { gte: c.bedrooms } } : {}),
      ...(c.bathrooms ? { bathrooms: { gte: c.bathrooms } } : {}),
      // DEC-GENI-10: minSqft / minLot are NOT filtered (no /listings param) — acknowledged, not honored.
    },
    _count: { _all: true },
  });
  const liveBySlug = new Map<string, number>();
  for (const g of grouped) {
    const slug = g.neighbourhood ? rawToSlug.get(g.neighbourhood) : undefined;
    if (!slug) continue; // not one of the 24 canonical neighbourhoods
    liveBySlug.set(slug, (liveBySlug.get(slug) ?? 0) + g._count._all);
  }

  // ── DATA-DERIVED THRESHOLDS (town medians; NOT magic constants) ──
  const nearGoKm = median(rows.map((r) => n(r.dist_go_km)).filter((x): x is number => x !== null));
  const townMedianDom = median(rows.map((r) => n(r.dom_avg)).filter((x): x is number => x !== null));
  const townMedianVol = median(rows.map((r) => n(r.sold_12mo)).filter((x): x is number => x !== null));

  const isRent = transaction === "rent";
  const matches: RankedMatch[] = [];
  for (const r of rows) {
    const slug = r.neighbourhood_slug;
    const liveCount = liveBySlug.get(slug) ?? 0;
    if (liveCount < 1) continue; // HARD FILTER: inventory-bearing only

    const distGoKm = n(r.dist_go_km);
    // For rent, sale-based price/activity would mislead → suppress them.
    const typicalRaw = c.propertyType ? n(r[TYPE_COL[c.propertyType]]) : null;
    const typical = isRent ? null : typicalRaw;
    const domAvg = isRent ? null : n(r.dom_avg);
    const sold12mo = isRent ? null : n(r.sold_12mo);
    const isRural = r.kind === "rural";
    const typicalLowConfidence = !isRent && typical !== null && isRural; // DEC-GENI-7
    const aboveTypicalBudget = !isRent && c.maxPrice != null && typical !== null && !isRural && typical > c.maxPrice;

    const tags: MatchTag[] = [];
    // budget_comfortable — urban only (DEC-GENI-7: never a rural budget signal), sale only.
    if (!isRent && c.maxPrice != null && typical !== null && r.kind === "urban") {
      tags.push({ key: "budget_comfortable", met: typical <= c.maxPrice });
    }
    // near_go — the only proximity signal; needs a centroid.
    if (c.nearGO) tags.push({ key: "near_go", met: distGoKm !== null && nearGoKm !== null && distGoKm <= nearGoKm });
    // active_market — sale only.
    if (!isRent && c.activity) {
      const met = c.activity === "fast_selling"
        ? domAvg !== null && townMedianDom !== null && domAvg <= townMedianDom
        : sold12mo !== null && townMedianVol !== null && sold12mo >= townMedianVol;
      tags.push({ key: "active_market", met });
    }

    matches.push({
      slug, name: r.neighbourhood_name, profile: r.profile, kind: r.kind,
      liveCount, typical, typicalLowConfidence, aboveTypicalBudget,
      distGoKm, domAvg, sold12mo,
      tags, metCount: tags.filter((t) => t.met).length, applicableCount: tags.length,
      listingsUrl: buildListingsUrl(r.neighbourhood_name, c, transaction),
    });
  }

  // ── SORT: metCount desc → primary expressed preference → slug (deterministic) ──
  matches.sort((a, b) => {
    if (b.metCount !== a.metCount) return b.metCount - a.metCount;
    let t = 0;
    if (c.nearGO) t = ascNullLast(a.distGoKm, b.distGoKm);
    else if (c.activity === "fast_selling") t = ascNullLast(a.domAvg, b.domAvg);
    else if (c.activity === "high_volume") t = descNullLast(a.sold12mo, b.sold12mo);
    else t = b.liveCount - a.liveCount;
    if (t !== 0) return t;
    return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
  });

  const notes: string[] = [];
  if (c.minSqft != null || c.minLot != null) notes.push("Size/lot filtering isn't available yet — these matches and the listing links ignore it.");
  if (isRent) notes.push("Rental matches rank on live rental inventory and GO distance; sale-based price, volume, and days-on-market are not shown.");

  return { matches, notes, thresholds: { nearGoKm, townMedianDom, townMedianVol }, transaction };
}

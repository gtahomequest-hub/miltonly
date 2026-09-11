// src/lib/guides/figures.ts
//
// Every live number a guide is allowed to print, already k-gated, each one
// carrying the window it was computed over.
//
// THE RULE THIS FILE EXISTS TO KEEP. A guide draws its figures from the same
// helpers the pages it links to draw theirs from, at the same thresholds, so no
// reader can click through from a guide to /sold or to a hub and find a
// different "typical". `getMiltonSoldAggregates()` is not re-implemented here
// and must never be: it already gates at K_ANON_PRICE and K_ANON_RANGE, rounds
// to 5k, bounds every window at NOW(), and matches its aggregate KIND to the
// sibling page (Milton-wide median, per-neighbourhood mean, DEC-GENI-1).
//
// Suppression arrives as null and stays null. Nothing in this file converts a
// null to 0, to a dash, or to a sentence with a hole in it — a sentence that
// needs a suppressed figure is dropped whole by the builder.

import "server-only";
import { prisma } from "@/lib/prisma";
import { config } from "@/lib/config";
import { getMiltonSoldAggregates, type SoldAggregatesData } from "@/lib/soldAggregates";
import { schools, type School } from "@/lib/schools";
import { BOC_POLICY_RATE } from "@/data/policyRate";
import { neighbourhoodDisplayName } from "@/lib/content/neighbourhoodName";
import type { GroundedFigure, GroundedFigures } from "@/lib/content/groundedFigures";

const TWELVE = "trailing 12 months";

export function fig(
  key: string,
  value: number | string | null,
  label: string,
  kind: GroundedFigure["kind"],
  source: string,
): GroundedFigure {
  return { key, value, label, kind, source };
}

// ── the sold layer, shared by four of the six guides ──────────────────────

export interface SoldFigures {
  data: SoldAggregatesData;
  bundle: GroundedFigures;
}

export async function getSoldFigures(): Promise<SoldFigures> {
  const data = await getMiltonSoldAggregates();
  const o = data.overall;

  const figures: GroundedFigure[] = [
    fig("sold.count", o.count, `sales, ${TWELVE}`, "count", "getMiltonSoldOverall"),
    fig("sold.median", o.medianPrice, `typical sold price, ${TWELVE}`, "dollar", "getMiltonSoldOverall"),
    fig("sold.mean", o.meanPrice, `average sold price, ${TWELVE}`, "dollar", "getMiltonSoldOverall"),
    fig("sold.bandLow", o.bandLow, `middle-half low, ${TWELVE}`, "dollar", "getMiltonSoldOverall"),
    fig("sold.bandHigh", o.bandHigh, `middle-half high, ${TWELVE}`, "dollar", "getMiltonSoldOverall"),
    fig("sold.dom", o.avgDom, `days on market, ${TWELVE}`, "days", "getMiltonSoldOverall"),
    fig("sold.soldToAsk", o.soldToAskPct, `sold to ask, ${TWELVE}`, "percent", "getMiltonSoldOverall"),
  ];

  for (const t of data.byType) {
    figures.push(fig(`type.${t.slug}.count`, t.count, `${t.label} sales, ${TWELVE}`, "count", "getMiltonSoldByType"));
    figures.push(fig(`type.${t.slug}.median`, t.medianPrice, `typical ${t.label.toLowerCase()} price, ${TWELVE}`, "dollar", "getMiltonSoldByType"));
  }
  for (const n of data.byNeighbourhood) {
    figures.push(fig(`nbhd.${n.slug}.count`, n.count, `${n.name} sales, ${TWELVE}`, "count", "getMiltonSoldByNeighbourhood"));
    figures.push(fig(`nbhd.${n.slug}.typical`, n.typicalPrice, `typical ${n.name} price, ${TWELVE}`, "dollar", "getMiltonSoldByNeighbourhood"));
  }
  for (const q of data.quarterly) {
    figures.push(fig(`q.${q.label}.count`, q.count, `${q.label} sales`, "count", "getMiltonSoldQuarterly"));
    figures.push(fig(`q.${q.label}.median`, q.medianPrice, `typical ${q.label} price`, "dollar", "getMiltonSoldQuarterly"));
  }

  const entities = [config.CITY_NAME, ...data.byNeighbourhood.map((n) => n.name)];
  return { data, bundle: { figures, entities } };
}

// ── condo fees: per active listing, as stated, or nothing ─────────────────
//
// Ruling 4, 2026-09-10: a fee may be shown ONLY as it is stated on an active
// listing currently displayed on the site, per listing. No historical fee, no
// derived fee, no typical fee, and nothing at all when there is no active
// listing. `CondoBuilding.avgMaintenanceFee` is therefore NOT read here — it is
// exactly the derived figure the ruling excludes.
//
// No address and no building name is rendered. A raw MLS address carries an
// abbreviation and sometimes a direction the Town contradicts ("1050 Main St W"
// is an address the Town records as MAIN STREET E), and resolving it would mean
// this worktree reaching into the condo naming path. The listing link is the
// citation; the fee is stated there.

export interface CondoFeeRow {
  mlsNumber: string;
  /** The REGISTRY name, or null. Never the raw TREB string. */
  neighbourhood: string | null;
  propertyType: string;
  bedrooms: number;
  parking: number;
  locker: string | null;
  monthlyFee: number;
  price: number;
}

export async function getActiveCondoFees(limit = 24): Promise<CondoFeeRow[]> {
  const rows = await prisma.listing.findMany({
    where: {
      city: config.PRISMA_CITY_VALUE,
      status: "active",
      permAdvertise: true,
      displayAddress: true,
      propertyType: "condo",
      // ONE FEE COLUMN IS READ, ANYWHERE: `maintenanceFeeAmt` (Float), which the
      // sync writes from the feed's AssociationFee. The Int column beside it in
      // the schema was declared in the same commit and never written by anything:
      // NULL on all 3,394 Listing rows (re-measured 2026-09-11; an earlier note here
      // called it 0, which was the falsy null being read as a number). The first
      // version of this query read that column and the guide published "No Milton
      // condo currently for sale states a monthly maintenance fee", which was
      // false. A page asserting an absence has to be as sure of the absence as it
      // would be of a figure. scripts/test-fee-column.ts keeps the dead identifier
      // out of src/ so the same read cannot come back.
      maintenanceFeeAmt: { not: null, gt: 0 },
    },
    select: {
      mlsNumber: true,
      neighbourhood: true,
      propertyType: true,
      bedrooms: true,
      parking: true,
      locker: true,
      maintenanceFeeAmt: true,
      price: true,
    },
    orderBy: { maintenanceFeeAmt: "asc" },
    take: limit,
  });
  return rows.map((r) => ({
    mlsNumber: r.mlsNumber,
    neighbourhood: neighbourhoodDisplayName(r.neighbourhood),
    propertyType: r.propertyType,
    bedrooms: r.bedrooms,
    parking: r.parking,
    locker: r.locker,
    monthlyFee: Math.round(r.maintenanceFeeAmt as number),
    price: r.price,
  }));
}

// ── schools ───────────────────────────────────────────────────────────────
//
// Ruling 6, 2026-09-10: board, address, distance; never attend, serve,
// catchment or zoned.
//
// ADDRESS AND DISTANCE ARE NOT AVAILABLE AND ARE NOT INVENTED. `schools.ts`
// carries no street address, and neither does the school page's own
// PostalAddress JSON-LD (locality, region, country only) — the site has never
// held one. The lat/lng that some rows carry is a NEIGHBOURHOOD CENTROID,
// approximate to about 300 m by the file's own comment, which is not a basis
// for a distance claim on a town-level page with no origin point. So the guide
// ships board, board name, level, grades and neighbourhood, and says plainly
// that it cannot tell you the rest. Flagged in HANDOFF-content.md.

export interface SchoolRow {
  slug: string;
  name: string;
  boardName: string;
  level: School["level"];
  grades: string;
  neighbourhood: string;
}

export function getSchoolRows(): SchoolRow[] {
  return schools
    .map((s) => ({
      slug: s.slug,
      name: s.name,
      boardName: s.boardName,
      level: s.level,
      grades: s.grades,
      neighbourhood: s.neighbourhood,
    }))
    .sort((a, b) => (a.level === b.level ? a.name.localeCompare(b.name) : a.level === "elementary" ? -1 : 1));
}

// ── first-home arithmetic ─────────────────────────────────────────────────
//
// Deterministic given a rate, and the ONLY rate in this codebase is the Bank
// of Canada policy rate with its date. A policy rate is not a mortgage rate;
// the guide says so beside every figure derived from it.

export { BOC_POLICY_RATE };

/** Minimum down payment under the Canadian sliding rule. Pure arithmetic. */
export function minimumDownPayment(price: number): number {
  if (price <= 500_000) return price * 0.05;
  if (price < 1_500_000) return 25_000 + (price - 500_000) * 0.1;
  return price * 0.2;
}

// ── live supply ───────────────────────────────────────────────────────────
// A count of what is on the market right now. A count is non-sensitive at any
// n (market-pulse.ts's ratified posture), so this carries no k gate — but it
// carries the same IDX/DDF display gate every other public count on the site
// does, because an undisplayable listing is not part of the public market.

export interface ActiveSupply {
  total: number;
  byType: Array<{ slug: string; count: number }>;
}

export async function getActiveSupply(): Promise<ActiveSupply> {
  const rows = await prisma.listing.groupBy({
    by: ["propertyType"],
    where: {
      city: config.PRISMA_CITY_VALUE,
      status: "active",
      permAdvertise: true,
      displayAddress: true,
      transactionType: "For Sale",
    },
    _count: { _all: true },
  });
  const byType = rows.map((r) => ({ slug: r.propertyType, count: r._count._all }));
  return { total: byType.reduce((s, r) => s + r.count, 0), byType };
}

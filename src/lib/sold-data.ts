// Server-only fetchers for sold/lease data. All queries enforce VOW
// compliance (perm_advertise = TRUE, 90-day window, transaction_type filter)
// and use Redis caching with graceful degradation. Call these from server
// components only.

import "server-only";
import { soldDb, analyticsDb } from "./db";
import { cached, CACHE_TTL } from "./cache";
import type {
  SoldRecord,
  StreetSoldStats,
  NeighbourhoodSoldStats,
  StreetMonthlyStats,
} from "./db-types";

const MAX_CONSUMER_RECORDS = 100; // VOW rule — never exceed per consumer query

export interface PublicSaleStats {
  sold_count_90days: number;
  sold_count_12months: number;
  avg_sold_price: number | null;      // authed-only — reserved here, callers decide visibility
  median_sold_price: number | null;   // authed-only
  avg_list_price: number | null;      // authed-only
  avg_dom: number | null;             // authed-only
  avg_sold_to_ask: number | null;     // authed-only
  price_change_yoy: number | null;    // authed-only
  peak_month: number | null;
  market_temperature: string | null;
}

export interface PublicLeaseStats {
  leased_count_90days: number;
  leased_count_12months: number;
  avg_leased_price: number | null;          // authed-only
  avg_leased_price_1bed: number | null;     // authed-only
  avg_leased_price_2bed: number | null;     // authed-only
  avg_leased_price_3bed: number | null;     // authed-only
  avg_leased_price_4bed: number | null;     // authed-only
  avg_lease_dom: number | null;             // authed-only
}

export interface PublicNeighbourhoodSaleStats {
  sold_count_90days: number;
  sold_count_12months: number;
  avg_sold_detached: number | null;  // authed-only
  avg_sold_semi: number | null;      // authed-only
  avg_sold_town: number | null;      // authed-only
  avg_sold_condo: number | null;     // authed-only
  avg_dom: number | null;            // authed-only
  avg_sold_to_ask: number | null;    // authed-only
  price_change_yoy: number | null;   // authed-only
  market_score: number | null;
}

function n(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  const x = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(x) ? x : null;
}

// ────────────────────────────────────────
// STREET — SALE
// ────────────────────────────────────────

export async function getStreetSaleStats(streetSlug: string): Promise<PublicSaleStats | null> {
  if (!analyticsDb) return null;
  return cached(`street-sale-stats:${streetSlug}`, CACHE_TTL.stats, async () => {
    const rows = (await analyticsDb!`
      SELECT * FROM analytics.street_sold_stats WHERE street_slug = ${streetSlug}
    `) as Array<StreetSoldStats>;
    const r = rows[0];
    if (!r) return null;
    return {
      sold_count_90days: r.sold_count_90days,
      sold_count_12months: r.sold_count_12months,
      avg_sold_price: n(r.avg_sold_price),
      median_sold_price: n(r.median_sold_price),
      avg_list_price: n(r.avg_list_price),
      avg_dom: n(r.avg_dom),
      avg_sold_to_ask: n(r.avg_sold_to_ask),
      price_change_yoy: n(r.price_change_yoy),
      peak_month: r.peak_month,
      market_temperature: r.market_temperature,
    };
  });
}

export async function getStreetLeaseStats(streetSlug: string): Promise<PublicLeaseStats | null> {
  if (!analyticsDb) return null;
  return cached(`street-lease-stats:${streetSlug}`, CACHE_TTL.stats, async () => {
    const rows = (await analyticsDb!`
      SELECT * FROM analytics.street_sold_stats WHERE street_slug = ${streetSlug}
    `) as Array<StreetSoldStats>;
    const r = rows[0];
    if (!r) return null;
    return {
      leased_count_90days: r.leased_count_90days,
      leased_count_12months: r.leased_count_12months,
      avg_leased_price: n(r.avg_leased_price),
      avg_leased_price_1bed: n(r.avg_leased_price_1bed),
      avg_leased_price_2bed: n(r.avg_leased_price_2bed),
      avg_leased_price_3bed: n(r.avg_leased_price_3bed),
      avg_leased_price_4bed: n(r.avg_leased_price_4bed),
      avg_lease_dom: n(r.avg_lease_dom),
    };
  });
}

export async function getStreetMonthlySales(streetSlug: string): Promise<Array<{ year: number; month: number; avg_sold_price: number | null; sold_count: number }>> {
  if (!analyticsDb) return [];
  return cached(`street-monthly-sales:${streetSlug}`, CACHE_TTL.stats, async () => {
    const rows = (await analyticsDb!`
      SELECT year, month, avg_sold_price, sold_count
      FROM analytics.street_monthly_stats
      WHERE street_slug = ${streetSlug}
      ORDER BY year ASC, month ASC
    `) as Array<StreetMonthlyStats>;
    return rows.map((r) => ({
      year: r.year,
      month: r.month,
      avg_sold_price: n(r.avg_sold_price),
      sold_count: r.sold_count,
    }));
  });
}

// ────────────────────────────────────────
// NEIGHBOURHOOD — SALE + LEASE
// ────────────────────────────────────────

export async function getNeighbourhoodSaleStats(neighbourhood: string): Promise<PublicNeighbourhoodSaleStats | null> {
  if (!analyticsDb) return null;
  return cached(`nbhd-sale-stats:${neighbourhood}`, CACHE_TTL.stats, async () => {
    const rows = (await analyticsDb!`
      SELECT * FROM analytics.neighbourhood_sold_stats WHERE neighbourhood = ${neighbourhood}
    `) as Array<NeighbourhoodSoldStats>;
    const r = rows[0];
    if (!r) return null;
    return {
      sold_count_90days: r.sold_count_90days,
      sold_count_12months: r.sold_count_12months,
      avg_sold_detached: n(r.avg_sold_detached),
      avg_sold_semi: n(r.avg_sold_semi),
      avg_sold_town: n(r.avg_sold_town),
      avg_sold_condo: n(r.avg_sold_condo),
      avg_dom: n(r.avg_dom),
      avg_sold_to_ask: n(r.avg_sold_to_ask),
      price_change_yoy: n(r.price_change_yoy),
      market_score: n(r.market_score),
    };
  });
}

export async function getNeighbourhoodLeaseStats(neighbourhood: string): Promise<PublicLeaseStats | null> {
  if (!analyticsDb) return null;
  return cached(`nbhd-lease-stats:${neighbourhood}`, CACHE_TTL.stats, async () => {
    const rows = (await analyticsDb!`
      SELECT * FROM analytics.neighbourhood_sold_stats WHERE neighbourhood = ${neighbourhood}
    `) as Array<NeighbourhoodSoldStats>;
    const r = rows[0];
    if (!r) return null;
    return {
      leased_count_90days: r.leased_count_90days,
      leased_count_12months: r.leased_count_12months,
      avg_leased_price: n(r.avg_leased_price),
      avg_leased_price_1bed: n(r.avg_leased_price_1bed),
      avg_leased_price_2bed: n(r.avg_leased_price_2bed),
      avg_leased_price_3bed: n(r.avg_leased_price_3bed),
      avg_leased_price_4bed: n(r.avg_leased_price_4bed),
      avg_lease_dom: n(r.avg_lease_dom),
    };
  });
}

// ────────────────────────────────────────
// RAW RECORDS (authed-only callers must gate)
// ────────────────────────────────────────

export interface SoldListItem {
  mls_number: string;
  address: string;               // already redacted if display_address = false
  street_name: string;
  street_slug: string;
  neighbourhood: string;
  sold_price: number;
  list_price: number;
  sold_to_ask_ratio: number;
  sold_date: string;
  days_on_market: number;
  beds: number | null;
  baths: number | null;
  property_type: string;
  transaction_type: "For Sale" | "For Lease";
  mls_status: string;
  sqft_range: string | null;
}

function toListItem(r: SoldRecord): SoldListItem {
  return {
    mls_number: r.mls_number,
    address: r.display_address ? r.address : "Address withheld",
    street_name: r.street_name,
    street_slug: r.street_slug,
    neighbourhood: r.neighbourhood,
    sold_price: n(r.sold_price) ?? 0,
    list_price: n(r.list_price) ?? 0,
    sold_to_ask_ratio: n(r.sold_to_ask_ratio) ?? 0,
    sold_date: r.sold_date,
    days_on_market: r.days_on_market,
    beds: r.beds,
    baths: n(r.baths),
    property_type: r.property_type,
    transaction_type: (r.transaction_type as "For Sale" | "For Lease") ?? "For Sale",
    mls_status: r.mls_status,
    sqft_range: r.sqft_range,
  };
}

export async function getStreetSoldList(
  streetSlug: string,
  type: "sale" | "lease",
  days: number = 90,
  limit: number = 20
): Promise<SoldListItem[]> {
  if (!soldDb) return [];
  const safeDays = Math.min(90, Math.max(1, days));
  const safeLimit = Math.min(MAX_CONSUMER_RECORDS, Math.max(1, limit));
  const txn = type === "sale" ? "For Sale" : "For Lease";
  return cached(`sold-list:street:${streetSlug}:${type}:${safeDays}:${safeLimit}`, CACHE_TTL.soldList, async () => {
    const rows = (await soldDb!`
      SELECT * FROM sold.sold_records
      WHERE street_slug = ${streetSlug}
        AND perm_advertise = TRUE
        AND transaction_type = ${txn}
        AND sold_date >= NOW() - (${safeDays} || ' days')::interval
      ORDER BY sold_date DESC
      LIMIT ${safeLimit}
    `) as Array<SoldRecord>;
    return rows.map(toListItem);
  });
}

export async function getNeighbourhoodSoldList(
  neighbourhood: string,
  type: "sale" | "lease",
  days: number = 90,
  limit: number = 20
): Promise<SoldListItem[]> {
  if (!soldDb) return [];
  const safeDays = Math.min(90, Math.max(1, days));
  const safeLimit = Math.min(MAX_CONSUMER_RECORDS, Math.max(1, limit));
  const txn = type === "sale" ? "For Sale" : "For Lease";
  return cached(`sold-list:nbhd:${neighbourhood}:${type}:${safeDays}:${safeLimit}`, CACHE_TTL.soldList, async () => {
    const rows = (await soldDb!`
      SELECT * FROM sold.sold_records
      WHERE neighbourhood = ${neighbourhood}
        AND perm_advertise = TRUE
        AND transaction_type = ${txn}
        AND sold_date >= NOW() - (${safeDays} || ' days')::interval
      ORDER BY sold_date DESC
      LIMIT ${safeLimit}
    `) as Array<SoldRecord>;
    return rows.map(toListItem);
  });
}

export async function getRecentSoldList(
  type: "sale" | "lease",
  days: number = 90,
  limit: number = 60,
  filters?: { neighbourhood?: string; property_type?: string }
): Promise<SoldListItem[]> {
  if (!soldDb) return [];
  const safeDays = Math.min(90, Math.max(1, days));
  const safeLimit = Math.min(MAX_CONSUMER_RECORDS, Math.max(1, limit));
  const txn = type === "sale" ? "For Sale" : "For Lease";
  const nbhd = filters?.neighbourhood ?? null;
  const ptype = filters?.property_type ?? null;
  return cached(
    `sold-list:all:${type}:${safeDays}:${safeLimit}:${nbhd ?? "-"}:${ptype ?? "-"}`,
    CACHE_TTL.soldList,
    async () => {
      const rows = (await soldDb!`
        SELECT * FROM sold.sold_records
        WHERE city = 'Milton'
          AND perm_advertise = TRUE
          AND transaction_type = ${txn}
          AND sold_date >= NOW() - (${safeDays} || ' days')::interval
          AND (${nbhd}::text IS NULL OR neighbourhood = ${nbhd})
          AND (${ptype}::text IS NULL OR property_type = ${ptype})
        ORDER BY sold_date DESC
        LIMIT ${safeLimit}
      `) as Array<SoldRecord>;
      return rows.map(toListItem);
    }
  );
}

// ────────────────────────────────────────
// TOTALS
// ────────────────────────────────────────

export async function getMiltonSoldTotals(): Promise<{ last30: number; last90: number }> {
  if (!soldDb) return { last30: 0, last90: 0 };
  return cached(`milton-sold-totals`, CACHE_TTL.homepage, async () => {
    const rows = (await soldDb!`
      SELECT
        (SELECT COUNT(*) FROM sold.sold_records
          WHERE city = 'Milton' AND perm_advertise = TRUE
            AND transaction_type = 'For Sale'
            AND sold_date >= NOW() - INTERVAL '30 days')::int AS last30,
        (SELECT COUNT(*) FROM sold.sold_records
          WHERE city = 'Milton' AND perm_advertise = TRUE
            AND transaction_type = 'For Sale'
            AND sold_date >= NOW() - INTERVAL '90 days')::int AS last90
    `) as Array<{ last30: number; last90: number }>;
    return rows[0] ?? { last30: 0, last90: 0 };
  });
}

export async function getDistinctSoldNeighbourhoods(): Promise<string[]> {
  if (!soldDb) return [];
  return cached(`milton-sold-nbhds`, CACHE_TTL.homepage, async () => {
    const rows = (await soldDb!`
      SELECT DISTINCT neighbourhood FROM sold.sold_records
      WHERE city = 'Milton' AND perm_advertise = TRUE
        AND transaction_type = 'For Sale'
        AND sold_date >= NOW() - INTERVAL '90 days'
      ORDER BY neighbourhood ASC
    `) as Array<{ neighbourhood: string }>;
    return rows.map((r) => r.neighbourhood);
  });
}

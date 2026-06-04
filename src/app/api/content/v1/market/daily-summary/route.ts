// /api/content/v1/market/daily-summary
//
// Returns yesterday's market activity for a given city, grouped by
// neighborhood and split into SALES vs LEASES (which track separately —
// mixing $3K monthly rents with $900K sale prices makes averages useless).
//
// "Yesterday" = the previous calendar day in America/Toronto timezone.
//
// Definitions:
//   sales.newListings  = transactionType=For Sale + listedAt in yesterday
//   sales.sold         = status=sold + soldDate in yesterday + soldPrice present
//   sales.expired      = status=expired + updatedAt in yesterday (sale side)
//   leases.newListings = transactionType=For Lease + listedAt in yesterday
//   leases.leased      = status=rented + leaseStatus=leased + updatedAt in yesterday
//   leases.terminated  = status=rented + leaseStatus=terminated + updatedAt in yesterday
//   leases.expired     = status=rented + leaseStatus=expired + updatedAt in yesterday
//
// Note on date proxying: only `sold` has a dedicated close-date (soldDate).
// `leased`, `terminated`, and both `expired` buckets have no close/dead-date
// column, so we proxy via updatedAt — approximately when ingest re-stamped the
// listing into that state, not necessarily when the event occurred. Good-enough
// for daily market reports; add explicit date columns + backfill if exactness
// matters later.
//
// Note on sale-side state collapsing: ingest (mapListingStates) folds MLS
// "Terminated"/"Suspended" into status=expired and "Sold Conditional" into
// status=sold, so sales.expired here includes terminations and sales.sold
// includes conditionals. Splitting those out is upstream ingest work, out of
// scope for this endpoint.
//
// All queries respect IDX/DDF compliance: permAdvertise=true AND
// displayAddress=true.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function torontoYesterdayWindow(): { startUtc: Date; endUtc: Date; isoDate: string } {
  const now = new Date();
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = fmt.formatToParts(now);
  const y = parts.find((p) => p.type === "year")!.value;
  const m = parts.find((p) => p.type === "month")!.value;
  const d = parts.find((p) => p.type === "day")!.value;
  const localGuess = new Date(`${y}-${m}-${d}T00:00:00Z`);
  const offsetTest = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    hour: "2-digit",
    hour12: false,
  }).format(localGuess);
  const hourInToronto = parseInt(offsetTest);
  const offsetHours = hourInToronto === 20 ? -4 : -5;
  const todayLocalUtc = new Date(
    `${y}-${m}-${d}T00:00:00${offsetHours >= 0 ? "+" : "-"}${String(Math.abs(offsetHours)).padStart(2, "0")}:00`
  );
  const yesterdayStartUtc = new Date(todayLocalUtc.getTime() - 24 * 60 * 60 * 1000);
  const yesterdayEndUtc = new Date(todayLocalUtc.getTime() - 1);
  const isoDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(yesterdayStartUtc)
    .replace(/\//g, "-");
  return { startUtc: yesterdayStartUtc, endUtc: yesterdayEndUtc, isoDate };
}

// Strips "1033 - HA Harrison" → "Harrison" and "1051 - Walker" → "Walker".
// The miltonly neighbourhood values store the MLS area code prefix; for posts
// we want the clean name. The letter code is optional: some areas come
// through as "NNNN - Name" with no code.
function cleanNeighbourhoodName(raw: string): string {
  // Pattern: "NNNN - [XX ]Name" → "Name"
  const match = raw.match(/^\d+\s*-\s*(?:[A-Z]{1,3}\s+)?(.+)$/);
  if (match) return match[1].trim();
  return raw.trim();
}

type ByType = Record<string, { count: number; sum: number }>;

function average(sum: number, count: number): number {
  if (count === 0) return 0;
  return Math.round(sum / count);
}

function aggregate(byType: ByType): {
  count: number;
  avgPrice: number;
  byType: Record<string, { count: number; avgPrice: number }>;
} {
  let totalCount = 0;
  let totalSum = 0;
  const out: Record<string, { count: number; avgPrice: number }> = {};
  for (const [type, { count, sum }] of Object.entries(byType)) {
    totalCount += count;
    totalSum += sum;
    out[type] = { count, avgPrice: average(sum, count) };
  }
  return { count: totalCount, avgPrice: average(totalSum, totalCount), byType: out };
}

type NeighbourhoodBuckets = {
  salesNew: ByType;
  salesSold: ByType;
  salesExpired: ByType;
  leaseNew: ByType;
  leaseLeased: ByType;
  leaseTerminated: ByType;
  leaseExpired: ByType;
};

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${process.env.CONTENT_ENGINE_API_TOKEN ?? ""}`;
  if (!process.env.CONTENT_ENGINE_API_TOKEN || auth !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const city = searchParams.get("city") ?? "Milton";
  const { startUtc, endUtc, isoDate } = torontoYesterdayWindow();

  const baseFilter = { city, permAdvertise: true, displayAddress: true };
  const dayWindow = { gte: startUtc, lte: endUtc };

  const [
    salesNew,
    salesSold,
    salesExpired,
    leaseNew,
    leaseLeased,
    leaseTerminated,
    leaseExpired,
  ] = await Promise.all([
    prisma.listing.findMany({
      where: {
        ...baseFilter,
        transactionType: "For Sale",
        listedAt: dayWindow,
      },
      select: { neighbourhood: true, propertyType: true, price: true },
    }),
    prisma.listing.findMany({
      where: {
        ...baseFilter,
        transactionType: "For Sale",
        status: "sold",
        soldDate: dayWindow,
        soldPrice: { not: null },
      },
      select: { neighbourhood: true, propertyType: true, soldPrice: true },
    }),
    // Sale-side expired (includes MLS terminated/suspended via ingest collapse).
    // No dead-date column, so window on updatedAt.
    prisma.listing.findMany({
      where: {
        ...baseFilter,
        transactionType: "For Sale",
        status: "expired",
        updatedAt: dayWindow,
      },
      select: { neighbourhood: true, propertyType: true, price: true },
    }),
    prisma.listing.findMany({
      where: {
        ...baseFilter,
        transactionType: "For Lease",
        listedAt: dayWindow,
      },
      select: { neighbourhood: true, propertyType: true, price: true },
    }),
    prisma.listing.findMany({
      where: {
        ...baseFilter,
        transactionType: "For Lease",
        status: "rented",
        leaseStatus: "leased",
        updatedAt: dayWindow,
      },
      select: { neighbourhood: true, propertyType: true, price: true },
    }),
    prisma.listing.findMany({
      where: {
        ...baseFilter,
        transactionType: "For Lease",
        status: "rented",
        leaseStatus: "terminated",
        updatedAt: dayWindow,
      },
      select: { neighbourhood: true, propertyType: true, price: true },
    }),
    prisma.listing.findMany({
      where: {
        ...baseFilter,
        transactionType: "For Lease",
        status: "rented",
        leaseStatus: "expired",
        updatedAt: dayWindow,
      },
      select: { neighbourhood: true, propertyType: true, price: true },
    }),
  ]);

  // Group everything by clean neighborhood name.
  const buckets: Record<string, NeighbourhoodBuckets> = {};

  function add(
    bucket: keyof NeighbourhoodBuckets,
    n: string,
    t: string,
    amount: number | null | undefined
  ) {
    const clean = cleanNeighbourhoodName(n);
    if (!buckets[clean]) {
      buckets[clean] = {
        salesNew: {},
        salesSold: {},
        salesExpired: {},
        leaseNew: {},
        leaseLeased: {},
        leaseTerminated: {},
        leaseExpired: {},
      };
    }
    if (!buckets[clean][bucket][t]) buckets[clean][bucket][t] = { count: 0, sum: 0 };
    buckets[clean][bucket][t].count++;
    buckets[clean][bucket][t].sum += amount ?? 0;
  }

  for (const r of salesNew) add("salesNew", r.neighbourhood, r.propertyType, r.price);
  for (const r of salesSold) add("salesSold", r.neighbourhood, r.propertyType, r.soldPrice);
  for (const r of salesExpired)
    add("salesExpired", r.neighbourhood, r.propertyType, r.price);
  for (const r of leaseNew) add("leaseNew", r.neighbourhood, r.propertyType, r.price);
  for (const r of leaseLeased)
    add("leaseLeased", r.neighbourhood, r.propertyType, r.price);
  for (const r of leaseTerminated)
    add("leaseTerminated", r.neighbourhood, r.propertyType, r.price);
  for (const r of leaseExpired)
    add("leaseExpired", r.neighbourhood, r.propertyType, r.price);

  // Total activity across all 7 states — drives the neighbourhood filter and
  // the most-active-first sort.
  function neighbourhoodActivity(n: {
    sales: { newListings: { count: number }; sold: { count: number }; expired: { count: number } };
    leases: {
      newListings: { count: number };
      leased: { count: number };
      terminated: { count: number };
      expired: { count: number };
    };
  }): number {
    return (
      n.sales.newListings.count +
      n.sales.sold.count +
      n.sales.expired.count +
      n.leases.newListings.count +
      n.leases.leased.count +
      n.leases.terminated.count +
      n.leases.expired.count
    );
  }

  const neighbourhoodSummaries = Object.entries(buckets)
    .map(([name, b]) => ({
      name,
      sales: {
        newListings: aggregate(b.salesNew),
        sold: aggregate(b.salesSold),
        expired: aggregate(b.salesExpired),
      },
      leases: {
        newListings: aggregate(b.leaseNew),
        leased: aggregate(b.leaseLeased),
        terminated: aggregate(b.leaseTerminated),
        expired: aggregate(b.leaseExpired),
      },
    }))
    .filter((n) => neighbourhoodActivity(n) > 0)
    .sort((a, b) => neighbourhoodActivity(b) - neighbourhoodActivity(a));

  // City-wide totals.
  function totalByType(rows: Array<{ propertyType: string; price?: number | null; soldPrice?: number | null }>) {
    const m: ByType = {};
    for (const r of rows) {
      if (!m[r.propertyType]) m[r.propertyType] = { count: 0, sum: 0 };
      m[r.propertyType].count++;
      m[r.propertyType].sum += r.price ?? r.soldPrice ?? 0;
    }
    return m;
  }

  const totals = {
    sales: {
      newListings: aggregate(totalByType(salesNew)),
      sold: aggregate(totalByType(salesSold)),
      expired: aggregate(totalByType(salesExpired)),
    },
    leases: {
      newListings: aggregate(totalByType(leaseNew)),
      leased: aggregate(totalByType(leaseLeased)),
      terminated: aggregate(totalByType(leaseTerminated)),
      expired: aggregate(totalByType(leaseExpired)),
    },
  };

  // hasActivity reflects the PRIMARY market signal (new + closed), not the
  // dead-listing buckets (expired/terminated). Kept stable so existing
  // consumers see the same meaning; the orchestrator no longer gates on it.
  const hasActivity =
    totals.sales.newListings.count +
      totals.sales.sold.count +
      totals.leases.newListings.count +
      totals.leases.leased.count >
    0;

  return NextResponse.json(
    {
      ok: true,
      period: { date: isoDate, label: "yesterday", timezone: "America/Toronto" },
      city,
      hasActivity,
      totals,
      neighbourhoods: neighbourhoodSummaries,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
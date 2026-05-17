// /api/content/v1/market/daily-summary
//
// Returns yesterday's market activity for a given city, grouped by
// neighborhood and split into SALES vs LEASES (which track separately —
// mixing $3K monthly rents with $900K sale prices makes averages useless).
//
// "Yesterday" = the previous calendar day in America/Toronto timezone.
//
// Definitions:
//   sales.newListings = transactionType=For Sale + listedAt in yesterday
//   sales.sold        = status=sold + soldDate in yesterday + soldPrice present
//   leases.newListings = transactionType=For Lease + listedAt in yesterday
//   leases.leased      = status=rented + leaseStatus=leased + updatedAt in yesterday
//
// Note on leased: there's no leasedDate column in the schema, so we proxy
// via updatedAt. This is approximately when the listing was marked rented,
// not necessarily when the lease was signed. Good-enough signal for daily
// market reports; if exact lease-close-date matters later, add leasedDate
// to the schema and backfill.
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

// Strips "1033 - HA Harrison" → "Harrison". The miltonly neighbourhood
// values store the MLS area code prefix; for posts we want the clean name.
function cleanNeighbourhoodName(raw: string): string {
  // Pattern: "NNNN - XX Name" → "Name"
  const match = raw.match(/^\d+\s*-\s*[A-Z]{1,3}\s+(.+)$/);
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
  leaseNew: ByType;
  leaseLeased: ByType;
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

  const [salesNew, salesSold, leaseNew, leaseLeased] = await Promise.all([
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
        leaseNew: {},
        leaseLeased: {},
      };
    }
    if (!buckets[clean][bucket][t]) buckets[clean][bucket][t] = { count: 0, sum: 0 };
    buckets[clean][bucket][t].count++;
    buckets[clean][bucket][t].sum += amount ?? 0;
  }

  for (const r of salesNew) add("salesNew", r.neighbourhood, r.propertyType, r.price);
  for (const r of salesSold) add("salesSold", r.neighbourhood, r.propertyType, r.soldPrice);
  for (const r of leaseNew) add("leaseNew", r.neighbourhood, r.propertyType, r.price);
  for (const r of leaseLeased)
    add("leaseLeased", r.neighbourhood, r.propertyType, r.price);

  const neighbourhoodSummaries = Object.entries(buckets)
    .map(([name, b]) => ({
      name,
      sales: {
        newListings: aggregate(b.salesNew),
        sold: aggregate(b.salesSold),
      },
      leases: {
        newListings: aggregate(b.leaseNew),
        leased: aggregate(b.leaseLeased),
      },
    }))
    .filter(
      (n) =>
        n.sales.newListings.count > 0 ||
        n.sales.sold.count > 0 ||
        n.leases.newListings.count > 0 ||
        n.leases.leased.count > 0
    )
    .sort((a, b) => {
      const ac =
        a.sales.newListings.count +
        a.sales.sold.count +
        a.leases.newListings.count +
        a.leases.leased.count;
      const bc =
        b.sales.newListings.count +
        b.sales.sold.count +
        b.leases.newListings.count +
        b.leases.leased.count;
      return bc - ac;
    });

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
    },
    leases: {
      newListings: aggregate(totalByType(leaseNew)),
      leased: aggregate(totalByType(leaseLeased)),
    },
  };

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
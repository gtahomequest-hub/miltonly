// /api/content/v1/market/daily-summary
//
// Returns yesterday's NEW listings for a given city, grouped by neighborhood and split into
// SALES vs LEASES (which track separately; mixing $3K monthly rents with $900K sale prices makes
// averages useless).
//
// "Yesterday" = the previous calendar day in America/Toronto timezone.
//
// Definitions:
//   sales.newListings  = transactionType=For Sale + status=active + listedAt in yesterday
//   leases.newListings = transactionType=For Lease + leaseStatus=active + listedAt in yesterday
//
// MC-046 Stage 1 (R14): IDX values only. The sold, sale-expired, leased, terminated and
// lease-expired buckets (counts and average prices by neighbourhood and type) were derived from
// VOW records and went to the ContentEngine token holder, whose output publishes. They are gone,
// with the queries behind them. New listings are counted over rows still active, so a listing that
// closed the same day is not in them either.
//
// All queries respect IDX/DDF compliance: permAdvertise=true AND displayAddress=true.

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
  leaseNew: ByType;
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

  const [salesNew, leaseNew] = await Promise.all([
    prisma.listing.findMany({
      where: {
        ...baseFilter,
        transactionType: "For Sale",
        status: "active",
        listedAt: dayWindow,
      },
      select: { neighbourhood: true, propertyType: true, price: true },
    }),
    prisma.listing.findMany({
      where: {
        ...baseFilter,
        transactionType: "For Lease",
        leaseStatus: "active",
        listedAt: dayWindow,
      },
      select: { neighbourhood: true, propertyType: true, price: true },
    }),
  ]);

  // Group by clean neighborhood name.
  const buckets: Record<string, NeighbourhoodBuckets> = {};

  function add(bucket: keyof NeighbourhoodBuckets, n: string, t: string, amount: number | null | undefined) {
    const clean = cleanNeighbourhoodName(n);
    if (!buckets[clean]) buckets[clean] = { salesNew: {}, leaseNew: {} };
    if (!buckets[clean][bucket][t]) buckets[clean][bucket][t] = { count: 0, sum: 0 };
    buckets[clean][bucket][t].count++;
    buckets[clean][bucket][t].sum += amount ?? 0;
  }

  for (const r of salesNew) add("salesNew", r.neighbourhood, r.propertyType, r.price);
  for (const r of leaseNew) add("leaseNew", r.neighbourhood, r.propertyType, r.price);

  const activity = (n: { sales: { newListings: { count: number } }; leases: { newListings: { count: number } } }) =>
    n.sales.newListings.count + n.leases.newListings.count;

  const neighbourhoodSummaries = Object.entries(buckets)
    .map(([name, b]) => ({
      name,
      sales: { newListings: aggregate(b.salesNew) },
      leases: { newListings: aggregate(b.leaseNew) },
    }))
    .filter((n) => activity(n) > 0)
    .sort((a, b) => activity(b) - activity(a));

  // City-wide totals.
  function totalByType(rows: Array<{ propertyType: string; price: number }>) {
    const m: ByType = {};
    for (const r of rows) {
      if (!m[r.propertyType]) m[r.propertyType] = { count: 0, sum: 0 };
      m[r.propertyType].count++;
      m[r.propertyType].sum += r.price ?? 0;
    }
    return m;
  }

  const totals = {
    sales: { newListings: aggregate(totalByType(salesNew)) },
    leases: { newListings: aggregate(totalByType(leaseNew)) },
  };

  // hasActivity now means new listings on either side.
  const hasActivity = totals.sales.newListings.count + totals.leases.newListings.count > 0;

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

// /api/content/v1/market/open-houses
//
// Returns the upcoming weekend's public open houses for Milton, pulled LIVE
// from the AMPRE feed at request time (no ingest, no staleness — the consumer
// is a Friday-afternoon cron whose whole point is currency).
//
// Weekend window: Saturday 00:00 -> Sunday 23:59 America/Toronto, computed
// with luxon (never a hardcoded offset; survives the EST/EDT switch).
// "Upcoming" = the first Saturday on or after today, except on Sunday the
// in-progress weekend is returned so same-day open houses still show.
//
// Data flow per request:
//   1. AMPRE /odata/OpenHouse  — date-windowed, Active + Public only
//   2. AMPRE /odata/Property   — Milton actives, for address/price/type
//   3. local Listing inner-join — the HARD display gate (see below) + slug
//
// Display gate: these posts publish autonomously with no human approval, so
// the gate is the entire safety net. A property is returned ONLY if its local
// Listing row exists AND permAdvertise AND displayAddress AND status=active.
// Fail any check -> silently dropped. The feed's OpenHouseURL is never
// returned (it ships leads to the listing brokerage); the URL is always the
// local /listings/<mlsNumber> page.
//
// Multi-day events are grouped: one record per property with a sessions[]
// array, not one row per open-house sitting.

import { NextRequest, NextResponse } from "next/server";
import { DateTime } from "luxon";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const AMPRE_BASE = "https://query.ampre.ca/odata";
const TZ = "America/Toronto";
const PAGE_SIZE = 1000;
// Both endpoints paginate; cap the loop so a feed bug can't spin us forever.
const MAX_PAGES = 10;

type FeedOpenHouse = {
  ListingKey: string;
  OpenHouseDate: string; // local calendar date, e.g. "2026-06-06"
  OpenHouseStartTime: string; // UTC ISO
  OpenHouseEndTime: string; // UTC ISO
  OpenHouseStatus: string;
  OpenHouseType: string | null;
};

type FeedProperty = {
  ListingKey: string;
  UnparsedAddress: string | null;
  ListPrice: number;
  PropertySubType: string | null;
  TransactionType: string | null;
};

// The feed shouts some street names ("393 GEORGE Street"). Collapse fully
// uppercase words to title case; mixed-case words (McDougall, O'Connor) are
// left alone, as are single letters (unit "B") and ordinals ("5TH" has digits).
function unshoutAddress(addr: string): string {
  return addr.replace(/\b[A-Z]{2,}\b/g, (w) => w[0] + w.slice(1).toLowerCase());
}

// First Saturday on/after today in Toronto; on Sunday, the weekend already in
// progress (yesterday's Saturday) so Sunday-afternoon callers still see today.
function torontoWeekendWindow(now: DateTime = DateTime.now().setZone(TZ)): {
  saturday: DateTime;
  sunday: DateTime;
} {
  const local = now.setZone(TZ);
  // luxon weekday: 1 = Monday ... 6 = Saturday, 7 = Sunday
  const daysUntilSaturday = local.weekday === 7 ? -1 : 6 - local.weekday;
  const saturday = local.plus({ days: daysUntilSaturday }).startOf("day");
  const sunday = saturday.plus({ days: 1 });
  return { saturday, sunday };
}

// orderBy is REQUIRED: OData $skip paging without a stable $orderby returns
// overlapping/missing rows across pages (observed live — duplicate sittings
// and silently dropped properties).
async function fetchAllPages<T>(
  url: string,
  token: string,
  orderBy: string
): Promise<T[]> {
  const out: T[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const res = await fetch(
      `${url}&$orderby=${encodeURIComponent(orderBy)}&$top=${PAGE_SIZE}&$skip=${page * PAGE_SIZE}`,
      {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) {
      throw new Error(`AMPRE request failed: HTTP ${res.status}`);
    }
    const data = (await res.json()) as { value: T[] };
    out.push(...data.value);
    if (data.value.length < PAGE_SIZE) break;
  }
  return out;
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${process.env.CONTENT_ENGINE_API_TOKEN ?? ""}`;
  if (!process.env.CONTENT_ENGINE_API_TOKEN || auth !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const feedToken = process.env.TREB_API_TOKEN ?? "";
  if (!feedToken) {
    return NextResponse.json({ error: "Feed token not configured" }, { status: 500 });
  }

  const { saturday, sunday } = torontoWeekendWindow();
  const satIso = saturday.toISODate()!;
  const sunIso = sunday.toISODate()!;

  // 1. Weekend open houses, live from the feed. OpenHouseDate is the board's
  //    local calendar date, so a date-only window matches the Toronto weekend
  //    without time-of-day conversion. Public sittings only — broker/agent
  //    opens must never be advertised.
  const ohFilter = encodeURIComponent(
    `OpenHouseDate ge ${satIso} and OpenHouseDate le ${sunIso} and OpenHouseStatus eq 'Active' and OpenHouseType eq 'Public'`
  );
  const openHouses = await fetchAllPages<FeedOpenHouse>(
    `${AMPRE_BASE}/OpenHouse?$filter=${ohFilter}&$select=ListingKey,OpenHouseDate,OpenHouseStartTime,OpenHouseEndTime,OpenHouseStatus,OpenHouseType`,
    feedToken,
    "OpenHouseKey asc"
  );

  if (openHouses.length === 0) {
    return NextResponse.json(
      {
        ok: true,
        weekend: { saturday: satIso, sunday: sunIso, timezone: TZ },
        count: 0,
        openHouses: [],
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  // 2. Milton actives from the feed for live address/price/type. One filtered
  //    query beats per-key lookups, and the city filter happens feed-side.
  const propFilter = encodeURIComponent(
    `City eq 'Milton' and StandardStatus eq 'Active'`
  );
  const properties = await fetchAllPages<FeedProperty>(
    `${AMPRE_BASE}/Property?$filter=${propFilter}&$select=ListingKey,UnparsedAddress,ListPrice,PropertySubType,TransactionType`,
    feedToken,
    "ListingKey asc"
  );
  const propByKey = new Map(properties.map((p) => [p.ListingKey, p]));

  const miltonKeys = Array.from(
    new Set(openHouses.map((oh) => oh.ListingKey))
  ).filter((k) => propByKey.has(k));
  if (miltonKeys.length === 0) {
    return NextResponse.json(
      {
        ok: true,
        weekend: { saturday: satIso, sunday: sunIso, timezone: TZ },
        count: 0,
        openHouses: [],
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  // 3. HARD display gate: local Listing row must exist, be active, and carry
  //    both IDX display permissions. Inner join — no local row, no post.
  const gated = await prisma.listing.findMany({
    where: {
      mlsNumber: { in: miltonKeys },
      status: "active",
      permAdvertise: true,
      displayAddress: true,
    },
    select: { mlsNumber: true, neighbourhood: true, propertyType: true },
  });
  const gatedByKey = new Map(gated.map((l) => [l.mlsNumber, l]));

  // Group sittings per property; one record per listing, sessions sorted.
  type OutRecord = {
    mlsNumber: string;
    address: string;
    price: number;
    propertyType: string; // local simple type: detached|semi|townhouse|condo
    propertySubType: string; // feed display type, e.g. "Condo Townhouse"
    neighbourhood: string;
    transactionType: string;
    slug: string;
    url: string;
    sessions: Array<{
      date: string;
      day: "Saturday" | "Sunday";
      startLocal: string; // "14:00" America/Toronto
      endLocal: string;
    }>;
  };
  const byListing = new Map<string, OutRecord>();

  for (const oh of openHouses) {
    const local = gatedByKey.get(oh.ListingKey);
    const prop = propByKey.get(oh.ListingKey);
    if (!local || !prop) continue; // failed the gate or not Milton-active

    const start = DateTime.fromISO(oh.OpenHouseStartTime, { zone: "utc" }).setZone(TZ);
    const end = DateTime.fromISO(oh.OpenHouseEndTime, { zone: "utc" }).setZone(TZ);
    if (!start.isValid || !end.isValid) continue;

    let rec = byListing.get(oh.ListingKey);
    if (!rec) {
      rec = {
        mlsNumber: oh.ListingKey,
        // Feed address is the live source of truth; strip the ", Milton, ON
        // L9T..." tail — consumers re-add city context themselves.
        address: unshoutAddress(
          (prop.UnparsedAddress ?? "").replace(/,\s*Milton.*$/i, "").trim()
        ),
        price: prop.ListPrice,
        propertyType: local.propertyType,
        propertySubType: (prop.PropertySubType ?? "").trim(),
        neighbourhood: local.neighbourhood,
        transactionType: prop.TransactionType ?? "For Sale",
        slug: oh.ListingKey,
        url: `https://miltonly.com/listings/${oh.ListingKey}`,
        sessions: [],
      };
      byListing.set(oh.ListingKey, rec);
    }
    // The feed carries duplicate sittings (same date/time, different
    // OpenHouseKey) for some listings — dedup on the rendered window.
    const session = {
      date: oh.OpenHouseDate,
      day: (oh.OpenHouseDate === satIso ? "Saturday" : "Sunday") as
        | "Saturday"
        | "Sunday",
      startLocal: start.toFormat("HH:mm"),
      endLocal: end.toFormat("HH:mm"),
    };
    const dup = rec.sessions.some(
      (s) =>
        s.date === session.date &&
        s.startLocal === session.startLocal &&
        s.endLocal === session.endLocal
    );
    if (!dup) rec.sessions.push(session);
  }

  const records = Array.from(byListing.values())
    .filter((r) => r.address && r.sessions.length > 0)
    .map((r) => ({
      ...r,
      sessions: r.sessions.sort((a, b) =>
        (a.date + a.startLocal).localeCompare(b.date + b.startLocal)
      ),
    }))
    // Earliest sitting first; stable, predictable order for the consumer.
    .sort((a, b) =>
      (a.sessions[0].date + a.sessions[0].startLocal).localeCompare(
        b.sessions[0].date + b.sessions[0].startLocal
      )
    );

  return NextResponse.json(
    {
      ok: true,
      weekend: { saturday: satIso, sunday: sunIso, timezone: TZ },
      count: records.length,
      openHouses: records,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}

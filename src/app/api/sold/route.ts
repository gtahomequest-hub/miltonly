// GET /api/sold — authed-only read of VOW sold records (DB2).
//
// Compliance gates (all enforced at read, never at storage):
//   - Auth session required (401 if missing) — zero VOW data to anon users.
//   - perm_advertise = TRUE — excludes records the seller has withdrawn from display.
//   - sold_date >= NOW() - 90 days — VOW board rule.
//   - mls_status = 'Sold' — hides records that flipped back to Active after a deal collapse.
//   - display_address = false → address substituted with "Address withheld".
//
// Rate limiting: @upstash/ratelimit, per-user + per-IP. Deferred tuning in
// CHANGELOG-DECISIONS; initial limits are conservative.
//
// Caching: read-through via `cached()` helper (stampede-protected), with
// graceful degradation on Redis or DB3 outage (Point E).

import { NextRequest, NextResponse } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { soldDb } from "@/lib/db";
import { redis, cached, CACHE_TTL } from "@/lib/cache";
import { getSession } from "@/lib/auth";
import type { SoldRecord } from "@/lib/db-types";

export const dynamic = "force-dynamic";

const MAX_LIMIT = 50;

// Rate limiter — null when Redis isn't configured; in that case we skip
// the limit gate entirely rather than blocking real traffic.
const userLimiter = redis
  ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(60, "1 m"), prefix: "rl:sold:user" })
  : null;
const ipLimiter = redis
  ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(30, "1 m"), prefix: "rl:sold:ip" })
  : null;

function getIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}

interface SoldApiRow {
  mls_number: string;
  address: string;
  street_name: string;
  street_slug: string;
  neighbourhood: string;
  list_price: string;
  sold_price: string;
  sold_date: string;
  list_date: string;
  days_on_market: number;
  sold_to_ask_ratio: string;
  beds: number | null;
  baths: string | null;
  property_type: string;
  sqft_range: string | null;
  lat: string | null;
  lng: string | null;
}

function redact(row: SoldRecord & { display_address: boolean }): SoldApiRow {
  return {
    mls_number: row.mls_number,
    address: row.display_address ? row.address : "Address withheld",
    street_name: row.street_name,
    street_slug: row.street_slug,
    neighbourhood: row.neighbourhood,
    list_price: row.list_price,
    sold_price: row.sold_price,
    sold_date: row.sold_date,
    list_date: row.list_date,
    days_on_market: row.days_on_market,
    sold_to_ask_ratio: row.sold_to_ask_ratio,
    beds: row.beds,
    baths: row.baths,
    property_type: row.property_type,
    sqft_range: row.sqft_range,
    lat: row.display_address ? row.lat : null,
    lng: row.display_address ? row.lng : null,
  };
}

export async function GET(req: NextRequest) {
  // 1. Auth gate — 401 immediately if not signed in or not verified.
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ error: "Sign in to view sold data" }, { status: 401 });
  }

  // 2. Rate limit (user + IP, whichever fires first). Gracefully skipped when Redis is down.
  try {
    if (userLimiter) {
      const r = await userLimiter.limit(user.id);
      if (!r.success) {
        return NextResponse.json(
          { error: "Rate limit exceeded" },
          { status: 429, headers: { "Retry-After": "60" } }
        );
      }
    }
    if (ipLimiter) {
      const r = await ipLimiter.limit(getIp(req));
      if (!r.success) {
        return NextResponse.json(
          { error: "Rate limit exceeded" },
          { status: 429, headers: { "Retry-After": "60" } }
        );
      }
    }
  } catch (err) {
    console.warn("[api/sold] rate limiter failed, allowing request:", err);
  }

  // 3. Parse query.
  const street = req.nextUrl.searchParams.get("street");
  const neighbourhood = req.nextUrl.searchParams.get("neighbourhood");
  const daysParam = parseInt(req.nextUrl.searchParams.get("days") || "90", 10);
  const days = Math.min(90, Math.max(1, Number.isFinite(daysParam) ? daysParam : 90)); // VOW ceiling
  const limitParam = parseInt(req.nextUrl.searchParams.get("limit") || "20", 10);
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number.isFinite(limitParam) ? limitParam : 20));

  if (!street && !neighbourhood) {
    return NextResponse.json(
      { error: "street or neighbourhood parameter required" },
      { status: 400 }
    );
  }

  // 4. DB3 fallback guard (Point E) — if DB2 client isn't configured, render
  // a graceful empty response, not a 500.
  if (!soldDb) {
    console.warn("[api/sold] soldDb is not configured");
    return NextResponse.json({
      source: "TREB MLS®",
      records: [],
      unavailable: true,
      message: "Sold data is updating — check back shortly.",
    });
  }

  const cacheKey = street
    ? `sold-records:street:${street}:${days}:${limit}`
    : `sold-records:nbhd:${neighbourhood}:${days}:${limit}`;

  try {
    const rows = await cached<SoldApiRow[]>(cacheKey, CACHE_TTL.soldList, async () => {
      const sql = soldDb!;
      const result = (street
        ? await sql`
            SELECT * FROM sold.sold_records
            WHERE street_slug = ${street}
              AND perm_advertise = TRUE
              AND mls_status = 'Sold'
              AND sold_date >= NOW() - (${days} || ' days')::interval
            ORDER BY sold_date DESC
            LIMIT ${limit}
          `
        : await sql`
            SELECT * FROM sold.sold_records
            WHERE neighbourhood = ${neighbourhood}
              AND perm_advertise = TRUE
              AND mls_status = 'Sold'
              AND sold_date >= NOW() - (${days} || ' days')::interval
            ORDER BY sold_date DESC
            LIMIT ${limit}
          `) as Array<SoldRecord>;

      return result.map(redact);
    });

    return NextResponse.json({
      source: "TREB MLS®",
      records: rows,
      count: rows.length,
    });
  } catch (err) {
    console.error("[api/sold] read failed, serving graceful empty:", err);
    return NextResponse.json({
      source: "TREB MLS®",
      records: [],
      unavailable: true,
      message: "Sold data is temporarily unavailable.",
    });
  }
}

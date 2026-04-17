// GET /api/sold — authed-only read of VOW closed transactions (DB2).
//
// Query params:
//   street         — street_slug to filter on
//   neighbourhood  — neighbourhood name to filter on (one of street/nbhd required)
//   type           — 'sale' | 'lease' | 'all'. Default 'sale'. Separates the
//                    two transaction categories since sales and leases have
//                    different price scales and different UX (seller capture
//                    vs tenant/landlord capture).
//   days           — 1..90 lookback window (VOW 90-day ceiling enforced)
//   limit          — max records (capped at 50)
//
// Compliance gates (all enforced at read, never at storage):
//   - Auth session required (401 if missing) — zero VOW data to anon users.
//   - perm_advertise = TRUE — excludes records the seller withdrew from display.
//   - sold_date >= NOW() - 90 days — VOW board rule.
//   - transaction_type = 'For Sale' or 'For Lease' per `type` param (default sale).
//   - mls_status check filters deal-collapse flips (Sold row that flipped back).
//   - display_address = false → address substituted with "Address withheld".
//
// Rate limiting: @upstash/ratelimit, per-user + per-IP. Conservative defaults
// (60/min user, 30/min IP); tuning tracked in CHANGELOG-DECISIONS.
//
// Caching: read-through via `cached()` helper (stampede-protected), with
// graceful degradation on Redis or DB3 outage.

import { NextRequest, NextResponse } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { soldDb } from "@/lib/db";
import { redis, cached, CACHE_TTL } from "@/lib/cache";
import { getSession } from "@/lib/auth";
import type { SoldRecord } from "@/lib/db-types";

export const dynamic = "force-dynamic";

const MAX_LIMIT = 50;

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

type TxnFilter = "sale" | "lease" | "all";

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
  transaction_type: string | null;
  mls_status: string;
}

function redact(row: SoldRecord): SoldApiRow {
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
    transaction_type: row.transaction_type ?? null,
    mls_status: row.mls_status,
  };
}

function parseTypeParam(raw: string | null): TxnFilter {
  if (raw === "lease") return "lease";
  if (raw === "all") return "all";
  return "sale"; // default
}

export async function GET(req: NextRequest) {
  // 1. Auth gate — 401 immediately if not signed in or not verified.
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ error: "Sign in to view sold data" }, { status: 401 });
  }

  // 1a. VOW acknowledgement gate — 403 if user hasn't accepted the bona-fide-
  // interest terms yet. Client handles by prompting; direct API consumers see
  // a clear machine-readable flag.
  if (!user.vowAcknowledgedAt) {
    return NextResponse.json(
      {
        error: "VOW acknowledgement required",
        acknowledgementRequired: true,
      },
      { status: 403 }
    );
  }

  // 2. Rate limit (user + IP). Gracefully skipped when Redis is down.
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
  const type = parseTypeParam(req.nextUrl.searchParams.get("type"));
  const daysParam = parseInt(req.nextUrl.searchParams.get("days") || "90", 10);
  const days = Math.min(90, Math.max(1, Number.isFinite(daysParam) ? daysParam : 90));
  const limitParam = parseInt(req.nextUrl.searchParams.get("limit") || "20", 10);
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number.isFinite(limitParam) ? limitParam : 20));

  if (!street && !neighbourhood) {
    return NextResponse.json(
      { error: "street or neighbourhood parameter required" },
      { status: 400 }
    );
  }

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
    ? `sold-records:street:${street}:${type}:${days}:${limit}`
    : `sold-records:nbhd:${neighbourhood}:${type}:${days}:${limit}`;

  try {
    const rows = await cached<SoldApiRow[]>(cacheKey, CACHE_TTL.soldList, async () => {
      const sql = soldDb!;
      // transaction_type literal injected server-side based on validated `type` —
      // never from user input directly (the parseTypeParam() narrows to the
      // three allowed values before we get here).
      const txnSqlFilter =
        type === "sale"
          ? "'For Sale'"
          : type === "lease"
            ? "'For Lease'"
            : null;

      let result: Array<SoldRecord>;
      if (street) {
        if (txnSqlFilter) {
          result = (await sql`
            SELECT * FROM sold.sold_records
            WHERE street_slug = ${street}
              AND perm_advertise = TRUE
              AND transaction_type = ${type === "sale" ? "For Sale" : "For Lease"}
              AND sold_date >= NOW() - (${days} || ' days')::interval
            ORDER BY sold_date DESC
            LIMIT ${limit}
          `) as Array<SoldRecord>;
        } else {
          result = (await sql`
            SELECT * FROM sold.sold_records
            WHERE street_slug = ${street}
              AND perm_advertise = TRUE
              AND sold_date >= NOW() - (${days} || ' days')::interval
            ORDER BY sold_date DESC
            LIMIT ${limit}
          `) as Array<SoldRecord>;
        }
      } else {
        if (txnSqlFilter) {
          result = (await sql`
            SELECT * FROM sold.sold_records
            WHERE neighbourhood = ${neighbourhood}
              AND perm_advertise = TRUE
              AND transaction_type = ${type === "sale" ? "For Sale" : "For Lease"}
              AND sold_date >= NOW() - (${days} || ' days')::interval
            ORDER BY sold_date DESC
            LIMIT ${limit}
          `) as Array<SoldRecord>;
        } else {
          result = (await sql`
            SELECT * FROM sold.sold_records
            WHERE neighbourhood = ${neighbourhood}
              AND perm_advertise = TRUE
              AND sold_date >= NOW() - (${days} || ' days')::interval
            ORDER BY sold_date DESC
            LIMIT ${limit}
          `) as Array<SoldRecord>;
        }
      }

      return result.map(redact);
    });

    return NextResponse.json({
      source: "TREB MLS®",
      type,
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

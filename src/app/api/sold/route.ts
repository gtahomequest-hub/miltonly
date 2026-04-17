// GET /api/sold — authed-only read of VOW closed transactions (DB2).
//
// Query params:
//   street         — street_slug to filter on
//   neighbourhood  — neighbourhood name to filter on (one of street/nbhd required)
//   type           — 'sale' | 'lease' | 'all'. Default 'sale'.
//   days           — 1..90 lookback window (VOW 90-day ceiling enforced)
//   limit          — max records (capped at 50)
//
// Gating is now layered:
//   1. Route-level: this handler checks session + vowAcknowledgedAt and
//      returns 401/403 early if either is missing.
//   2. Fetcher-level: sold-data.ts fetchers also run canServeRecordsToThisRequest()
//      before any cache or DB read — defence-in-depth so a caller-side bug
//      cannot leak records.
//   3. Display-level: sold_date >= NOW() - 90d, perm_advertise=TRUE, and
//      display_address redaction are enforced inside the fetchers.
//
// Rate limiting: @upstash/ratelimit, per-user + per-IP.
// Caching: the fetchers in sold-data.ts handle Redis with stampede protection —
// this route no longer double-caches.

import { NextRequest, NextResponse } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { redis } from "@/lib/cache";
import { getSession } from "@/lib/auth";
import {
  getStreetSoldList,
  getNeighbourhoodSoldList,
  type SoldListItem,
} from "@/lib/sold-data";

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

function parseTypeParam(raw: string | null): TxnFilter {
  if (raw === "lease") return "lease";
  if (raw === "all") return "all";
  return "sale"; // default
}

export async function GET(req: NextRequest) {
  // 1. Auth gate — 401 if not signed in or not verified.
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ error: "Sign in to view sold data" }, { status: 401 });
  }

  // 2. VOW acknowledgement gate — 403 if user hasn't accepted the bona-fide-
  // interest terms. Client handles by prompting; direct API consumers see a
  // machine-readable flag.
  if (!user.vowAcknowledgedAt) {
    return NextResponse.json(
      {
        error: "VOW acknowledgement required",
        acknowledgementRequired: true,
      },
      { status: 403 }
    );
  }

  // 3. Rate limit — gracefully skipped if Redis is down.
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

  // 4. Parse query.
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

  // 5. Delegate to the gated fetchers — single source of truth for gating,
  // caching (Redis with stampede protection), and shaping (SoldListItem
  // includes list_office_name per VOW 6.3(c) and redacts address when
  // display_address=false).
  try {
    let rows: SoldListItem[];

    if (type === "all") {
      // Fetch both categories (each fetcher applies its own 100-row consumer
      // cap), merge, sort by sold_date DESC, slice to the requested limit.
      const [saleRows, leaseRows] = await Promise.all([
        street
          ? getStreetSoldList(street, "sale", days, limit)
          : getNeighbourhoodSoldList(neighbourhood!, "sale", days, limit),
        street
          ? getStreetSoldList(street, "lease", days, limit)
          : getNeighbourhoodSoldList(neighbourhood!, "lease", days, limit),
      ]);
      rows = [...saleRows, ...leaseRows]
        .sort((a, b) => b.sold_date.localeCompare(a.sold_date))
        .slice(0, limit);
    } else {
      rows = street
        ? await getStreetSoldList(street, type, days, limit)
        : await getNeighbourhoodSoldList(neighbourhood!, type, days, limit);
    }

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

// GET /api/sold-stats — authed-only read of street-level SOLD aggregates.
//
// This route serves the same class of data as /api/sold and
// /api/streets/[slug]/sold-records, so it uses the same rail they do:
// getSession + vowAcknowledgedAt, checked before any DB read.
//
// It previously served every figure below to anyone, gated only on
// `sold_count_90days >= 3`. At n=3 a median IS an individual sale price, and
// the rendered street page suppresses at that sample. Two defects, both fixed
// here:
//   1. the floor was 3, not K_ANON_PRICE
//   2. `price_change_yoy` is derived from a 365-day average against the prior
//      365 days, but was released on the 90-day count — a guard that checks a
//      different sample than it releases. The stored row carries no n for the
//      prior-year window, so that figure cannot be guarded and is no longer
//      returned. See the WINDOW note below.

import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { prisma } from "@/lib/prisma";
import { config } from "@/lib/config";
import { getSession } from "@/lib/auth";
import { K_ANON_PRICE } from "@/lib/kAnon";
import { MILTON_STREET_REGISTRY } from "@/data/miltonStreetRegistry";
import { titleCaseOfficial } from "@/lib/streetName";

export const dynamic = 'force-dynamic';

const url = process.env.ANALYTICS_DATABASE_URL;
const aSql = url ? neon(url) : null;

// `analytics.street_sold_stats` is computed nightly with `perm_advertise = TRUE`
// upstream (see src/lib/sold-stats.ts).

interface StreetStatsRow {
  street_slug: string;
  avg_sold_price: string | null;
  median_sold_price: string | null;
  avg_list_price: string | null;
  avg_dom: string | null;
  avg_sold_to_ask: string | null;
  sold_count_90days: number;
  sold_count_12months: number;
  price_change_yoy: string | null;
  market_temperature: string | null;
  last_updated: string;
}

export async function GET(req: NextRequest) {
  try {
    // 1. Auth gate — identical to /api/sold. Checked before any DB read.
    const user = await getSession();
    if (!user) {
      return NextResponse.json(
        { error: "Sign in to view sold data", authRequired: true },
        { status: 401 }
      );
    }
    // 2. VOW acknowledgement gate — bona-fide interest, machine-readable flag.
    if (!user.vowAcknowledgedAt) {
      return NextResponse.json(
        { error: "VOW acknowledgement required", acknowledgementRequired: true },
        { status: 403 }
      );
    }

    if (!aSql) {
      return NextResponse.json({ error: "Analytics DB not configured" }, { status: 500 });
    }
    const { searchParams } = new URL(req.url);
    const name = (searchParams.get("name") || "").trim();
    if (!name) {
      return NextResponse.json({ error: "name required" }, { status: 400 });
    }

    // Primary join key: kebab-case(name) + "-milton" matches the analytics
    // sync's slugifier (which feeds off the streetName already in abbreviated
    // form, e.g. "Costigan Rd" → "costigan-rd-milton", "Main St E" → "main-st-e-milton").
    // REJOINED ON SLUG (DEC-NAME-SOURCE Build 1). The comment above was wrong: analytics does NOT
    // store the abbreviated MLS form. Measured against the live analytics DB — for the stored names
    // "Buckthorn", "Main St E" and "Costigan Rd" the derived keys buckthorn-milton /
    // main-st-e-milton / costigan-rd-milton each returned ZERO rows, while the canonical slugs
    // buckthorn-garden-milton / main-street-milton / costigan-road-milton each returned one. The
    // primary join has been dead the whole time; every request was silently paying for the
    // Listing-equality fallback below.
    //
    // Registry lookup first (name -> official slug), kebab only as a last resort.
    const registrySlug = MILTON_STREET_REGISTRY.find(
      (r) => titleCaseOfficial(r.name).toLowerCase() === name.toLowerCase(),
    )?.slug;
    const derivedSlug =
      registrySlug ??
      name.toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "")
      + `-${config.SLUG_SUFFIX}`;

    let rows = (await aSql`
      SELECT
        street_slug,
        avg_sold_price,
        median_sold_price,
        avg_list_price,
        avg_dom,
        avg_sold_to_ask,
        sold_count_90days,
        sold_count_12months,
        price_change_yoy,
        market_temperature,
        last_updated
      FROM analytics.street_sold_stats
      WHERE street_slug = ${derivedSlug}
      LIMIT 1
    `) as StreetStatsRow[];

    // Fallback for edge cases (apostrophes, unusual punctuation, naming drift).
    // Look up the operational Listing.streetSlug and try it against analytics.
    if (!rows?.[0]) {
      console.warn(`[sold-stats] derived slug miss for "${name}" → ${derivedSlug}, trying operational fallback`);
      const listing = await prisma.listing.findFirst({
        where: { streetName: name, city: config.PRISMA_CITY_VALUE },
        select: { streetSlug: true },
      });
      if (listing?.streetSlug) {
        rows = (await aSql`
          SELECT
            street_slug,
            avg_sold_price,
            median_sold_price,
            avg_list_price,
            avg_dom,
            avg_sold_to_ask,
            sold_count_90days,
            sold_count_12months,
            price_change_yoy,
            market_temperature,
            last_updated
          FROM analytics.street_sold_stats
          WHERE street_slug = ${listing.streetSlug}
          LIMIT 1
        `) as StreetStatsRow[];
      }
    }

    if (!rows?.[0]) {
      return NextResponse.json({ found: false, name });
    }

    const r = rows[0];
    const num = (v: string | null): number | null => (v === null ? null : Number(v));
    const count90 = r.sold_count_90days ?? 0;
    const count12 = r.sold_count_12months ?? 0;

    // 3. k-anon guard, checked against the EXACT sample it releases.
    //
    // WINDOW: in computeStreetSaleStats (src/lib/sold-stats.ts) avg_sold_price,
    // median_sold_price, avg_list_price, avg_dom and avg_sold_to_ask are all
    // computed over the d90 CTE — the same 90 days sold_count_90days counts.
    // market_temperature is classified from avg_sold_to_ask + avg_dom, so it
    // inherits d90 too. count90 is therefore the correct n for every figure
    // released below, and K_ANON_PRICE is the correct floor for it.
    if (count90 < K_ANON_PRICE) {
      return NextResponse.json({ found: true, sparse: true, name, slug: r.street_slug, count90, count12 });
    }

    // price_change_yoy is NOT released. It compares AVG(sold_price) over the
    // last 365 days against the 365 days before that; the row stores no count
    // for the prior window, so there is no n to check it against. A figure
    // whose sample cannot be counted cannot be floored — so it is suppressed
    // rather than guarded by a count that belongs to a different window.
    return NextResponse.json({
      found: true,
      sparse: false,
      name,
      slug: r.street_slug,
      window: "90d",
      count90,
      count12,
      avgSold: num(r.avg_sold_price),
      medianSold: num(r.median_sold_price),
      avgList: num(r.avg_list_price),
      avgDom: num(r.avg_dom),
      soldToAskPct: r.avg_sold_to_ask !== null ? Math.round(Number(r.avg_sold_to_ask) * 1000) / 10 : null,
      temperature: r.market_temperature,
      lastUpdated: r.last_updated,
    });
  } catch (err) {
    console.error("[sold-stats] error", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { prisma } from "@/lib/prisma";

const url = process.env.ANALYTICS_DATABASE_URL;
const aSql = url ? neon(url) : null;

// `analytics.street_sold_stats` is computed nightly with `perm_advertise = TRUE`
// upstream (see src/lib/sold-stats.ts), so render to anon users is VOW-safe.

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
    const derivedSlug =
      name.toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "")
      + "-milton";

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
        where: { streetName: name, city: "Milton" },
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

    // Privacy guard: < 3 sales in 90 days → return sparse, no per-stat reveal.
    if (count90 < 3) {
      return NextResponse.json({ found: true, sparse: true, name, slug: r.street_slug, count90, count12 });
    }

    return NextResponse.json({
      found: true,
      sparse: false,
      name,
      slug: r.street_slug,
      count90,
      count12,
      avgSold: num(r.avg_sold_price),
      medianSold: num(r.median_sold_price),
      avgList: num(r.avg_list_price),
      avgDom: num(r.avg_dom),
      soldToAskPct: r.avg_sold_to_ask !== null ? Math.round(Number(r.avg_sold_to_ask) * 1000) / 10 : null,
      priceYoyPct: r.price_change_yoy !== null ? Math.round(Number(r.price_change_yoy) * 1000) / 10 : null,
      temperature: r.market_temperature,
      lastUpdated: r.last_updated,
    });
  } catch (err) {
    console.error("[sold-stats] error", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

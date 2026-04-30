import { prisma } from "@/lib/prisma";
import { config } from "@/lib/config";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const street = request.nextUrl.searchParams.get("street") || "";
  const type = request.nextUrl.searchParams.get("type") || "all";

  if (!street) {
    return NextResponse.json({ error: "street param required" }, { status: 400 });
  }

  // Build slug from street name
  const slug = street.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + `-${config.SLUG_SUFFIX}`;

  const where: Record<string, unknown> = { streetSlug: slug, permAdvertise: true };
  if (type !== "all") {
    where.propertyType = type;
  }

  const agg = await prisma.listing.aggregate({
    where,
    _avg: { price: true, daysOnMarket: true },
    _count: true,
  });

  // If no data for this street, return city-wide stats for this property type
  if (agg._count === 0) {
    const cityWhere: Record<string, unknown> = { city: config.PRISMA_CITY_VALUE, permAdvertise: true };
    if (type !== "all") cityWhere.propertyType = type;

    const cityAgg = await prisma.listing.aggregate({
      where: cityWhere,
      _avg: { price: true, daysOnMarket: true },
    });

    return NextResponse.json({
      found: false,
      message: `No recent data on this street — showing ${config.CITY_NAME} average`,
      avgPrice: Math.round(cityAgg._avg.price || 0),
      avgDOM: Math.round(cityAgg._avg.daysOnMarket || 0),
      soldVsAsk: 100,
      count: 0,
    });
  }

  // Phase 2.6: soldVsAsk used to be computed from DB1 soldPrice values.
  // DB1 no longer carries sold prices (VOW compliance). Real sold-to-ask
  // ratios come from the gated DB2 analytics pipeline (see
  // /api/sold + StreetSoldBlock). This public endpoint returns a neutral
  // 100 so existing call sites keep their response shape without exposing
  // any sold-derived data.
  return NextResponse.json({
    found: true,
    avgPrice: Math.round(agg._avg.price || 0),
    avgDOM: Math.round(agg._avg.daysOnMarket || 0),
    soldVsAsk: 100,
    count: agg._count,
  });
}

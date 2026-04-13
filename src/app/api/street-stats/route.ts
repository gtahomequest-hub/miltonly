import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const street = request.nextUrl.searchParams.get("street") || "";
  const type = request.nextUrl.searchParams.get("type") || "all";

  if (!street) {
    return NextResponse.json({ error: "street param required" }, { status: 400 });
  }

  // Build slug from street name
  const slug = street.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "-milton";

  const where: Record<string, unknown> = { streetSlug: slug, permAdvertise: true };
  if (type !== "all") {
    where.propertyType = type;
  }

  const agg = await prisma.listing.aggregate({
    where,
    _avg: { price: true, daysOnMarket: true },
    _count: true,
  });

  // If no data for this street, return Milton-wide stats for this property type
  if (agg._count === 0) {
    const miltonWhere: Record<string, unknown> = { city: "Milton", permAdvertise: true };
    if (type !== "all") miltonWhere.propertyType = type;

    const miltonAgg = await prisma.listing.aggregate({
      where: miltonWhere,
      _avg: { price: true, daysOnMarket: true },
    });

    return NextResponse.json({
      found: false,
      message: "No recent data on this street — showing Milton average",
      avgPrice: Math.round(miltonAgg._avg.price || 0),
      avgDOM: Math.round(miltonAgg._avg.daysOnMarket || 0),
      soldVsAsk: 100,
      count: 0,
    });
  }

  // Calculate sold vs ask for this street
  const soldOnStreet = await prisma.listing.findMany({
    where: { streetSlug: slug, status: "sold", soldPrice: { not: null } },
    select: { price: true, soldPrice: true },
  });

  let soldVsAsk = 100;
  if (soldOnStreet.length > 0) {
    const ratios = soldOnStreet.filter((l) => l.price > 0).map((l) => (l.soldPrice! / l.price) * 100);
    if (ratios.length > 0) soldVsAsk = Math.round(ratios.reduce((a, b) => a + b, 0) / ratios.length);
  }

  return NextResponse.json({
    found: true,
    avgPrice: Math.round(agg._avg.price || 0),
    avgDOM: Math.round(agg._avg.daysOnMarket || 0),
    soldVsAsk,
    count: agg._count,
  });
}

import { prisma } from "@/lib/prisma";
import { sendDealAlertEmail } from "@/lib/email-user";
import { NextRequest, NextResponse } from "next/server";

// Run daily via cron — matches saved searches against new listings
export async function POST(request: NextRequest) {
  // Simple auth via bearer token
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searches = await prisma.savedSearch.findMany({
    where: { alertEnabled: true },
    include: { user: true },
  });

  let totalAlerts = 0;

  for (const search of searches) {
    // Build filter for listings added since last alert (or last 24h)
    const since = search.lastAlertAt || new Date(Date.now() - 24 * 60 * 60 * 1000);

    const where: Record<string, unknown> = {
      status: "active",
      permAdvertise: true,
      createdAt: { gte: since },
    };

    if (search.propertyType) where.propertyType = search.propertyType;
    if (search.neighbourhood) where.neighbourhood = { contains: search.neighbourhood, mode: "insensitive" };
    if (search.streetSlug) where.streetSlug = search.streetSlug;
    if (search.priceMin || search.priceMax) {
      where.price = {};
      if (search.priceMin) (where.price as Record<string, number>).gte = search.priceMin;
      if (search.priceMax) (where.price as Record<string, number>).lte = search.priceMax;
    }
    if (search.bedsMin) where.bedrooms = { gte: search.bedsMin };
    if (search.bathsMin) where.bathrooms = { gte: search.bathsMin };
    if (search.transactionType) where.transactionType = search.transactionType;

    const matches = await prisma.listing.findMany({
      where,
      select: { address: true, price: true, mlsNumber: true, propertyType: true },
      take: 20,
      orderBy: { createdAt: "desc" },
    });

    if (matches.length > 0 && search.user.verified) {
      await sendDealAlertEmail(
        search.user.email,
        search.user.firstName,
        search.name,
        matches.map((m) => ({
          address: m.address,
          price: m.price,
          mlsNumber: m.mlsNumber,
          propertyType: m.propertyType || "Home",
        }))
      );

      await prisma.savedSearch.update({
        where: { id: search.id },
        data: { lastAlertAt: new Date(), lastMatchCount: matches.length },
      });

      totalAlerts++;
    }
  }

  return NextResponse.json({ success: true, alertsSent: totalAlerts, searchesChecked: searches.length });
}

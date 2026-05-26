import { prisma } from "@/lib/prisma";
import { config } from "@/lib/config";
import { NextRequest, NextResponse } from "next/server";
import { getSoldDb } from "@/lib/db";

const VIP_THRESHOLD = 5; // Streets with 5+ active listings become VIP Hubs

export async function GET(request: NextRequest) {
  return POST(request);
}

// Run after daily sync — detects VIP hub streets
export async function POST(request: NextRequest) {
  const secret =
    request.headers.get("authorization")?.replace("Bearer ", "") ||
    request.nextUrl.searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Find streets with 5+ active listings
  const hotStreets = await prisma.listing.groupBy({
    by: ["streetSlug"],
    where: { status: "active", permAdvertise: true },
    _count: true,
    having: { streetSlug: { _count: { gte: VIP_THRESHOLD } } },
    orderBy: { _count: { streetSlug: "desc" } },
  });

  const hotSlugs = hotStreets.map((s) => s.streetSlug);

  // Promote new VIP hubs
  let promoted = 0;
  for (const slug of hotSlugs) {
    const existing = await prisma.streetContent.findUnique({
      where: { streetSlug: slug },
      select: { isVipHub: true },
    });

    if (existing && !existing.isVipHub) {
      await prisma.streetContent.update({
        where: { streetSlug: slug },
        data: { isVipHub: true, vipHubAt: new Date() },
      });
      promoted++;
   } else if (!existing) {
  // Need to create a StreetContent entry — get the street name
  const sample = await prisma.listing.findFirst({
    where: { streetSlug: slug },
    select: { streetName: true },
  });

  // Pull neighbourhood from DB2 sold records (most common neighbourhood for this slug).
  // Without this, the row would be created with neighbourhood=null and Phase 4.1
  // generation would skip it — the same gap that produced 115 null rows in April.
  const sd = getSoldDb();
  const nbRows = sd
    ? await (sd`
        SELECT neighbourhood
          FROM sold.sold_records
         WHERE street_slug = ${slug}
           AND neighbourhood IS NOT NULL
         GROUP BY neighbourhood
         ORDER BY COUNT(*) DESC
         LIMIT 1
      ` as unknown as Promise<Array<{ neighbourhood: string }>>).catch(() => [])
    : [];
  const neighbourhood = nbRows[0]?.neighbourhood ?? null;

  await prisma.streetContent.create({
    data: {
      streetSlug: slug,
      streetName: sample?.streetName || slug,
      neighbourhood,
      description: `Real estate data for ${sample?.streetName || slug} in ${config.CITY_NAME}, ${config.CITY_PROVINCE}.`,
      status: "draft",
      isVipHub: true,
      vipHubAt: new Date(),
    },
  });
  promoted++;
}
  }

  // Demote streets that dropped below threshold
  const demoted = await prisma.streetContent.updateMany({
    where: {
      isVipHub: true,
      streetSlug: { notIn: hotSlugs },
    },
    data: { isVipHub: false },
  });

  return NextResponse.json({
    success: true,
    vipHubs: hotSlugs.length,
    promoted,
    demoted: demoted.count,
    threshold: VIP_THRESHOLD,
  });
}

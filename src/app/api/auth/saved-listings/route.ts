import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const mls = request.nextUrl.searchParams.get("mls");
  if (!mls) return NextResponse.json({ listings: [] });

  const mlsNumbers = mls.split(",").filter(Boolean);
  if (mlsNumbers.length === 0) return NextResponse.json({ listings: [] });

  const listings = await prisma.listing.findMany({
    where: { mlsNumber: { in: mlsNumbers } },
    select: {
      mlsNumber: true,
      address: true,
      price: true,
      propertyType: true,
      status: true,
      streetSlug: true,
      bedrooms: true,
      bathrooms: true,
    },
  });

  return NextResponse.json({ listings });
}

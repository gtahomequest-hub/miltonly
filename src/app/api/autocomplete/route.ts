import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() || "";
  const type = request.nextUrl.searchParams.get("type") || "street"; // street | neighbourhood | condo

  if (q.length < 2) {
    return NextResponse.json([]);
  }

  if (type === "street") {
    const results = await prisma.listing.findMany({
      where: {
        streetName: { contains: q, mode: "insensitive" },
        permAdvertise: true,
      },
      select: { streetName: true, streetSlug: true },
      distinct: ["streetName"],
      take: 8,
    });
    return NextResponse.json(
      results.map((r) => ({ name: r.streetName, slug: r.streetSlug }))
    );
  }

  if (type === "neighbourhood") {
    const results = await prisma.listing.findMany({
      where: {
        neighbourhood: { contains: q, mode: "insensitive" },
        permAdvertise: true,
      },
      select: { neighbourhood: true },
      distinct: ["neighbourhood"],
      take: 8,
    });
    return NextResponse.json(
      results.map((r) => ({ name: r.neighbourhood, slug: r.neighbourhood.toLowerCase().replace(/\s+/g, "-") }))
    );
  }

  if (type === "condo") {
    const results = await prisma.condoBuilding.findMany({
      where: {
        name: { contains: q, mode: "insensitive" },
      },
      select: { name: true, slug: true },
      take: 8,
    });
    return NextResponse.json(
      results.map((r) => ({ name: r.name, slug: r.slug }))
    );
  }

  return NextResponse.json([]);
}

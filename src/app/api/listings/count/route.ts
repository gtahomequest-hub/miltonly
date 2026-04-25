import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    // Accept both ?maxPrice= and ?max= for parity with the /listings page,
    // which has accepted both since day one.
    const maxPrice = parseInt(searchParams.get("maxPrice") || searchParams.get("max") || "0", 10);
    if (!maxPrice || maxPrice <= 0) {
      return NextResponse.json({ count: 0 });
    }
    // Match the rest of the site (FeaturedListings, hero stats, etc.) — only
    // count listings that are publicly displayable on the destination /listings page.
    const count = await prisma.listing.count({
      where: { status: "active", permAdvertise: true, price: { lte: maxPrice } },
    });
    return NextResponse.json({ count });
  } catch (err) {
    console.error("[listings/count] error", err);
    return NextResponse.json({ count: 0 });
  }
}

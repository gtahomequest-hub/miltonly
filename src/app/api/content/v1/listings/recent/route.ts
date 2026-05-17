// Contract API for ContentEngine — returns recently-listed properties shaped
// for downstream content generation (GBP posts, social variants, broadcasts).
//
// This endpoint is the stable boundary between miltonly and ContentEngine.
// The response shape is versioned via /v1/ in the path; future shape changes
// ship as /v2/ without breaking existing consumers.
//
// Compliance: only returns listings with permAdvertise=true and
// displayAddress=true (IDX/DDF display rules). Sold listings, expired
// listings, and non-displayable listings are excluded.
//
// Auth: Authorization: Bearer <CONTENT_ENGINE_API_TOKEN>
//
// Query params:
//   limit  — max rows to return (default 10, max 50)
//   since  — ISO datetime; only listings with listedAt >= since
//
// Response: { listings: ContentListing[], generatedAt: string }
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type ContentListing = {
  mlsNumber: string;
  address: string;
  streetName: string | null;
  neighbourhood: string;
  city: string;
  price: number;
  bedrooms: number;
  bathrooms: number;
  parking: number;
  sqft: number | null;
  propertyType: string;
  transactionType: string | null;
  heroPhoto: string | null;
  photos: string[];
  photoCount: number;
  listedAt: string;
  listingUrl: string;
  isOwnListing: boolean;
};

const SITE_ORIGIN =
  process.env.NEXT_PUBLIC_SITE_URL || "https://miltonly.com";
const OWN_OFFICE_NAME = process.env.OWN_OFFICE_NAME || "";

export async function GET(req: NextRequest) {
  const header = req.headers.get("authorization");
  const expected = `Bearer ${process.env.CONTENT_ENGINE_API_TOKEN}`;
  if (
    !header ||
    !process.env.CONTENT_ENGINE_API_TOKEN ||
    header !== expected
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const limitRaw = parseInt(searchParams.get("limit") || "10", 10);
    const limit = Math.min(Math.max(limitRaw, 1), 50);
    const sinceParam = searchParams.get("since");
    const since = sinceParam ? new Date(sinceParam) : null;
    if (since && isNaN(since.getTime())) {
      return NextResponse.json(
        { error: "Invalid 'since' parameter — must be ISO datetime" },
        { status: 400 }
      );
    }

    const rows = await prisma.listing.findMany({
      where: {
        status: "active",
        permAdvertise: true,
        displayAddress: true,
        ...(since ? { listedAt: { gte: since } } : {}),
      },
      orderBy: { listedAt: "desc" },
      take: limit,
      select: {
        mlsNumber: true,
        address: true,
        streetName: true,
        neighbourhood: true,
        city: true,
        price: true,
        bedrooms: true,
        bathrooms: true,
        parking: true,
        sqft: true,
        propertyType: true,
        transactionType: true,
        photos: true,
        listedAt: true,
        listOfficeName: true,
      },
    });

    const listings: ContentListing[] = rows.map((r) => ({
      mlsNumber: r.mlsNumber,
      address: r.address,
      streetName: r.streetName,
      neighbourhood: r.neighbourhood,
      city: r.city,
      price: r.price,
      bedrooms: r.bedrooms,
      bathrooms: r.bathrooms,
      parking: r.parking,
      sqft: r.sqft,
      propertyType: r.propertyType,
      transactionType: r.transactionType,
      heroPhoto: r.photos[0] ?? null,
      photos: r.photos,
      photoCount: r.photos.length,
      listedAt: r.listedAt.toISOString(),
      listingUrl: `${SITE_ORIGIN}/listings/${r.mlsNumber}`,
      isOwnListing: OWN_OFFICE_NAME
        ? r.listOfficeName === OWN_OFFICE_NAME
        : false,
    }));

    return NextResponse.json({
      listings,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[content/v1/listings/recent] error", err);
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500 }
    );
  }
}
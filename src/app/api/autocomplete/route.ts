import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { condoDisplayName } from "@/lib/condoName";
import { resolveStreetName } from "@/lib/streetName";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() || "";
  const type = request.nextUrl.searchParams.get("type") || "street"; // street | neighbourhood | condo

  if (q.length < 2) {
    return NextResponse.json([]);
  }

  if (type === "street") {
    // ENTITY-GATED. This used to read Listing rows directly and return whatever
    // streetName MLS had written, with no check that the street exists — so a typo at
    // the source became a suggestion. Searching "miltonbro" returned both
    // "Miltonbrook Cres" and "Miltonbrock Cres", the second being a street that does
    // not exist in Milton, carrying one expired listing and no sold history.
    //
    // THE GATE IS "THE ENTITY EXISTS", NOT hero-index's SURFACED_STREET_WHERE. I measured
    // both: the surfaced gate would also have removed 23 REGISTERED streets that carry
    // live listings but no sold history and no published page — Ashbrook Crt, Goodwin
    // Cres, Norris Cir, Snoek Point and 19 more, all of which serve a 200. hero-index can
    // afford that floor because it is a directory of pages worth ranking; autocomplete is
    // a finder, and refusing to find a real street is a worse failure than the one being
    // fixed. Entity-exists removes 72 phantom/junk names and loses nothing real.
    const results = await prisma.residentialStreet.findMany({
      where: { name: { contains: q, mode: "insensitive" } },
      select: { name: true, slug: true },
      orderBy: [{ recencyWeightedSold: "desc" }, { name: "asc" }],
      take: 8,
    });
    return NextResponse.json(results.map((r) => ({ name: resolveStreetName(r.slug, r.name).name, slug: r.slug })));
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
      select: { name: true, slug: true, streetNumber: true, streetSlug: true, buildingAddress: true, displayName: true },
      take: 8,
    });
    // DEC-CONDO-NAME: a search result names a building the way its page does, or the visitor
    // clicks "1005 Nadalin Hts" and lands on "1005 Nadalin Heights".
    return NextResponse.json(
      results.map((r) => ({
        name: condoDisplayName({ slug: r.slug, streetNumber: r.streetNumber, streetSlug: r.streetSlug, buildingAddress: r.buildingAddress ?? r.displayName ?? r.name }),
        slug: r.slug,
      }))
    );
  }

  return NextResponse.json([]);
}

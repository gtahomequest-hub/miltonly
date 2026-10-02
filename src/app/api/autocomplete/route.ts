import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { condoDisplayName } from "@/lib/condoName";
import { resolveStreetName } from "@/lib/streetName";
import { activeSaleCounts } from "@/lib/megaContext";
import { PUBLIC_LISTING_WHERE } from "@/lib/listings/vow";
import { publishedCondoSlugs } from "@/lib/condoSurface";
import { MILTON_STREET_REGISTRY } from "@/data/miltonStreetRegistry";
import { surfacedStreetWhere } from "@/lib/streetSurface";

const REGISTRY_SLUGS = new Set(MILTON_STREET_REGISTRY.map((r) => r.slug));

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
    //
    // THE ORDER IS HOMES FOR SALE NOW, TIES ALPHABETICAL (MC-046 R9). It was recency-weighted
    // sales, and a suggestion list ranked by sold volume discloses it with no figure shown.
    const matches = await prisma.residentialStreet.findMany({
      where: { name: { contains: q, mode: "insensitive" } },
      select: { name: true, slug: true },
    });
    // MC-046: a street is found if the Town's registry names it (open data), or it has a page or a
    // public listing. A few off-registry entities were created from sold records alone
    // (scripts/ws3-backfill.ts), and suggesting one of those would disclose VOW data by presence.
    const surfaced = new Set((await prisma.residentialStreet.findMany({ where: await surfacedStreetWhere(), select: { slug: true } })).map((r) => r.slug));
    const findable = matches.filter((r) => REGISTRY_SLUGS.has(r.slug) || surfaced.has(r.slug));
    matches.length = 0;
    matches.push(...findable);
    const counts = await activeSaleCounts(matches.map((r) => r.slug));
    const results = matches
      .map((r) => ({ name: resolveStreetName(r.slug, r.name).name, slug: r.slug, n: counts.get(r.slug) ?? 0 }))
      .sort((a, b) => b.n - a.n || a.name.localeCompare(b.name))
      .slice(0, 8);
    return NextResponse.json(results.map(({ name, slug }) => ({ name, slug })));
  }

  if (type === "neighbourhood") {
    const results = await prisma.listing.findMany({
      // MC-046: public rows only. A neighbourhood named only by sold or leased rows is VOW data.
      where: {
        AND: [PUBLIC_LISTING_WHERE, { neighbourhood: { contains: q, mode: "insensitive" } }],
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
      // MC-046: buildings with a published page only (src/lib/condoSurface.ts).
      where: {
        name: { contains: q, mode: "insensitive" },
        slug: { in: await publishedCondoSlugs() },
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

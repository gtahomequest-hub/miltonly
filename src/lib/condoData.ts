// src/lib/condoData.ts
// THE SEAM (read side). getCondoData(slug) reads vetted CondoContent (+ CondoGeneration
// sections, CondoBuilding facts, live listings, sibling condos) and maps to the CondoData
// render contract. Null-tolerant: fields the generation never produced stay null/empty and the
// page degrades honestly. Mirrors getHubData.
//
// MC-046 Stage 1 (PropTx VOW Best Practices item 40):
//   · CondoContent.statsJson (the building's stored sold aggregate: typical price and range) is
//     NOT read on the render path. "Typical price" and "Range" are gone from the page.
//   · The stored generated prose is served through the same visitor-view rule as the hubs
//     (hubData.ts: visitorParagraphs / visitorFaqs / visitorLede): VOW-topic sentences and
//     figure sentences are cut, an FAQ item whose question or surviving answer speaks about a
//     VOW topic goes whole, and the FAQPage JSON-LD is built from exactly the rendered list.
//   · The unitMix and condoMarket sections are not read at all: both were written from the
//     sold side (by-type sales mix and the building's sale aggregate).
//   · Active listings in the building stay (IDX).
import { prisma } from "@/lib/prisma";
import type { CondoData, CondoListing, CondoNearby } from "@/components/condo/types";
import { resolveCondoName, condoDisplayName } from "@/lib/condoName";
import type { CondoSection } from "@/types/hub-generator";
import { PUBLIC_LISTING_WHERE } from "@/lib/listings/vow";
import { visitorParagraphs, visitorFaqs, visitorLede } from "@/lib/hubData";

function hoodSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-");
}
function cleanHood(raw: string): string {
  return raw.replace(/^\d+\s*-\s*\w+\s+/, "").trim();
}

function intentsFor(slug: string): CondoData["intents"] {
  return [
    { key: "buy", label: "I'm buying", sub: "See units for sale here", href: `/condos/${slug}#listings` },
    { key: "sell", label: "I'm selling", sub: "What my unit is worth", href: "/sell" },
    { key: "rent", label: "I'm renting", sub: "Lease listings in the building", href: `/condos/${slug}#listings` },
    // MC-020: "/#mls" pointed at a homepage section that no longer exists (56 dead anchors a night).
    { key: "invest", label: "I'm investing", sub: "Yield & rental rules", href: "/listings" },
  ];
}

export async function getCondoData(slug: string): Promise<CondoData | null> {
  // Only the columns the page renders: statsJson (the stored sold aggregate) is not selected.
  const content = await prisma.condoContent.findUnique({
    where: { buildingSlug: slug },
    select: { status: true, faqJson: true },
  });
  if (!content || content.status !== "published") return null;

  const [building, generation] = await Promise.all([
    prisma.condoBuilding.findUnique({
      where: { slug },
      // Only what the page renders; the legacy avgSalePrice*/avgRent*/avgCapRate/priceGrowth1yr
      // columns (sold- and lease-derived) are not selected.
      select: {
        buildingAddress: true, legalStories: true, neighbourhood: true,
        neighbourhoodId: true, streetNumber: true, streetSlug: true, totalUnits: true, yearBuilt: true,
        neighbourhoodEntity: { select: { name: true, slug: true } },
      },
    }),
    prisma.condoGeneration.findUnique({ where: { buildingSlug: slug }, select: { status: true, sectionsJson: true } }),
  ]);
  if (!building) return null;

  // Editorial prose -> overview. Every narrative section except the conversion CTA block (the
  // design renders its own dual CTA), the projected schema markup, and the two sections written
  // from the sold side (unitMix, condoMarket), then the visitor-view filter.
  const sections: CondoSection[] =
    generation && generation.status === "succeeded"
      ? ((generation.sectionsJson as unknown as CondoSection[]) ?? [])
      : [];
  const SKIP = new Set(["buySellCtas", "schemaMarkup", "unitMix", "condoMarket"]);
  const overview = visitorParagraphs(
    sections.filter((s) => !SKIP.has(s.id)).flatMap((s) => s.paragraphs ?? []).filter(Boolean),
  );

  // FAQ: the visitor-view filter, the same list the FAQPage JSON-LD is built from.
  let rawFaqs: unknown = [];
  try {
    rawFaqs = JSON.parse(content.faqJson || "[]");
  } catch {
    rawFaqs = [];
  }
  const faqs: CondoData["faqs"] = visitorFaqs(rawFaqs);

  // MC-046: CondoBuilding.avgMaintenanceFee is a fee derived across the building's records, the
  // figure Ruling 4 (2026-09-10) already excluded; a fee is stated per active listing or not at all.
  const monthlyFee: string | null = null;
  const ownership: CondoData["ownership"] = { monthlyFee, feeIncludes: [] };
  if (!monthlyFee) ownership.feeNote = "Varies by suite. Confirm with the listing or management.";

  // Parent hub link.
  const nbName =
    building.neighbourhoodEntity?.name ?? (building.neighbourhood ? cleanHood(building.neighbourhood) : "Milton");
  const nbSlug = building.neighbourhoodEntity?.slug ?? hoodSlug(nbName);

  // Live units in THIS building: same street slug + civic-number prefix on the
  // address (Listing has no streetNumber column). Sale + lease, active only.
  const liveRows =
    building.streetNumber && building.streetSlug
      ? await prisma.listing.findMany({
          // MC-029: the public predicate, both sides (an available lease is status='rented',
          // leaseStatus='active'; `status: "active"` alone never matched a lease unit).
          // MC-036: displayAddress too. A unit listed under the building's street number and
          // name, with a link to its page, is placed at its address; a withheld one may not
          // be. This list is not a count.
          where: {
            ...PUBLIC_LISTING_WHERE,
            displayAddress: true,
            streetSlug: building.streetSlug,
            propertyType: "condo",
            address: { startsWith: `${building.streetNumber} ` },
          },
          orderBy: { listedAt: "desc" },
          take: 8,
          // MC-046: the columns the card prints, never the row (the row carries the VOW-only columns).
          select: { mlsNumber: true, transactionType: true, bedrooms: true, bathrooms: true, price: true, listOfficeName: true },
        })
      : [];
  const listings: CondoListing[] = liveRows.map((l) => {
    const lease = l.transactionType === "For Lease";
    // no square footage: Listing.sqft is the midpoint of the listing's range, not an MLS® field (MC-047, A4)
    return {
      title: `${l.bedrooms} bed`,
      meta: [`${l.bedrooms} bed`, `${l.bathrooms} bath`].join(" · "),
      price: lease ? `$${l.price.toLocaleString("en-CA")}/mo` : `$${l.price.toLocaleString("en-CA")}`,
      listOfficeName: l.listOfficeName,
      tenure: lease ? "lease" : "sale",
      href: `/listings/${l.mlsNumber}`,
    };
  });

  // Sibling condos in the same neighbourhood, published only.
  const siblings = building.neighbourhoodId
    ? await prisma.condoBuilding.findMany({
        where: { neighbourhoodId: building.neighbourhoodId, slug: { not: slug } },
        select: { slug: true, displayName: true, buildingAddress: true, streetNumber: true, streetSlug: true },
      })
    : [];
  const sibSlugs = siblings.map((s) => s.slug);
  const publishedSet = sibSlugs.length
    ? new Set(
        (
          await prisma.condoContent.findMany({
            where: { buildingSlug: { in: sibSlugs }, status: "published" },
            select: { buildingSlug: true },
          })
        ).map((c) => c.buildingSlug),
      )
    : new Set<string>();
  const nearbyCondos: CondoNearby[] = siblings
    .filter((s) => publishedSet.has(s.slug))
    .slice(0, 6)
    .map((s) => ({
      // DEC-CONDO-NAME: the nearby list names a building the same way its own page does.
      name: condoDisplayName({ slug: s.slug, streetNumber: s.streetNumber, streetSlug: s.streetSlug, buildingAddress: s.buildingAddress }),
      slug: s.slug,
    }));

  // DEC-CONDO-NAME (QUEUE item 4). The STORED CondoContent.buildingName is not read for display:
  // 57 of 59 rows carry an abbreviation and some carry a direction the Town contradicts. The name
  // is resolved from the building's own civic number and street slug, every time, on every
  // surface. The backfill rewrites the stored column to match; this does not depend on it having
  // run, which is what makes the two safe to land in either order.
  const resolved = resolveCondoName({
    slug,
    streetNumber: building.streetNumber,
    streetSlug: building.streetSlug,
    buildingAddress: building.buildingAddress,
  });
  const name = resolved.name;
  const address = resolved.address;
  // The lede is the filtered overview's first sentence that stands on its own, or nothing. It
  // no longer falls back to the stored meta description, which is not filtered prose.
  const character = visitorLede(overview);

  return {
    slug,
    name,
    address,
    character,
    neighbourhood: { name: nbName, slug: nbSlug },
    intents: intentsFor(slug),
    facts: {
      units: building.totalUnits,
      storeys: building.legalStories,
      yearBuilt: building.yearBuilt,
      developer: null,
      propertyType: "Condo apartment",
    },
    ownership,
    overview,
    listings,
    amenities: [],
    rules: { pets: null, rentals: null, parking: null, locker: null },
    faqs,
    nearbyCondos,
    ctaBuyer: {
      heading: `Interested in ${name}?`,
      body: "Register to be alerted the moment a unit is listed, with grounded pricing from real building comparables.",
      buttonLabel: "Get listing alerts",
      href: "/listings",
    },
    ctaSeller: {
      heading: `Own a unit at ${name}?`,
      body: `Get a grounded valuation built on real ${name} comparables.`,
      buttonLabel: "Value my unit",
      href: "/sell",
    },
  };
}

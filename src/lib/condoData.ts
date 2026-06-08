// src/lib/condoData.ts
// THE SEAM (read side). getCondoData(slug) reads VETTED, already-gated CondoContent
// (+ CondoGeneration sections, CondoBuilding facts, live listings, sibling condos)
// and maps to the CondoData render contract. It does NOT re-query trades or re-run
// the k-anon gate — that happened at generation; statsJson already encodes the
// suppression (null typicalPrice/priceRange = k-anon silent). Null-tolerant per the
// design: fields the generation never produced stay null/empty and the page degrades
// honestly. Mirrors getHubData (HubContent/HubGeneration siblings).
import { prisma } from "@/lib/prisma";
import { compactPrice } from "@/components/condo/format";
import type { CondoData, CondoListing, CondoNearby } from "@/components/condo/types";
import type { CondoSection } from "@/types/hub-generator";

function hoodSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-");
}
function cleanHood(raw: string): string {
  return raw.replace(/^\d+\s*-\s*\w+\s+/, "").trim();
}
function firstSentence(s: string): string {
  const m = s.match(/^.*?[.!?](\s|$)/);
  return (m ? m[0] : s).trim();
}
function intentsFor(slug: string): CondoData["intents"] {
  return [
    { key: "buy", label: "I'm buying", sub: "See units for sale here", href: `/condos/${slug}#listings` },
    { key: "sell", label: "I'm selling", sub: "What my unit is worth", href: "/sell" },
    { key: "rent", label: "I'm renting", sub: "Lease listings in the building", href: `/condos/${slug}#listings` },
    { key: "invest", label: "I'm investing", sub: "Yield & rental rules", href: "/build-wealth" },
  ];
}

export async function getCondoData(slug: string): Promise<CondoData | null> {
  const content = await prisma.condoContent.findUnique({ where: { buildingSlug: slug } });
  if (!content || content.status !== "published") return null;

  const [building, generation] = await Promise.all([
    prisma.condoBuilding.findUnique({
      where: { slug },
      include: { neighbourhoodEntity: { select: { name: true, slug: true } } },
    }),
    prisma.condoGeneration.findUnique({ where: { buildingSlug: slug } }),
  ]);
  if (!building) return null;

  // Editorial prose -> overview. Every narrative section except the conversion CTA
  // block (the design renders its own dual CTA) and the projected schema markup.
  const sections: CondoSection[] =
    generation && generation.status === "succeeded"
      ? ((generation.sectionsJson as unknown as CondoSection[]) ?? [])
      : [];
  const overview = sections
    .filter((s) => s.id !== "buySellCtas" && s.id !== "schemaMarkup")
    .flatMap((s) => s.paragraphs)
    .filter(Boolean);

  // FAQ — already vetted at generation.
  let faqs: CondoData["faqs"] = [];
  try {
    faqs = (JSON.parse(content.faqJson || "[]") as Array<{ question: string; answer: string }>).map((f) => ({
      question: f.question,
      answer: f.answer,
    }));
  } catch {
    faqs = [];
  }

  // ownership <- statsJson saleAggregates. k-anon already applied: null => silent.
  let typicalPrice: number | null = null;
  let priceRange: string | null = null;
  try {
    const stats = content.statsJson
      ? (JSON.parse(content.statsJson) as { typicalPrice?: number | null; priceRange?: { low: number; high: number } | null })
      : null;
    typicalPrice = stats?.typicalPrice ?? null;
    if (stats?.priceRange) priceRange = `$${compactPrice(stats.priceRange.low)} – $${compactPrice(stats.priceRange.high)}`;
  } catch {
    /* statsJson absent -> silent */
  }
  const maintenanceFee = building.avgMaintenanceFee
    ? `~$${building.avgMaintenanceFee.toLocaleString("en-CA")} / month`
    : null;
  const ownership: CondoData["ownership"] = { typicalPrice, priceRange, maintenanceFee, feeIncludes: [] };
  if (!maintenanceFee) ownership.feeNote = "Varies by suite — confirm with the listing or management.";

  // Parent hub link.
  const nbName =
    building.neighbourhoodEntity?.name ?? (building.neighbourhood ? cleanHood(building.neighbourhood) : "Milton");
  const nbSlug = building.neighbourhoodEntity?.slug ?? hoodSlug(nbName);

  // Live units in THIS building: same street slug + civic-number prefix on the
  // address (Listing has no streetNumber column). Sale + lease, active only.
  const liveRows =
    building.streetNumber && building.streetSlug
      ? await prisma.listing.findMany({
          where: {
            streetSlug: building.streetSlug,
            propertyType: "condo",
            status: "active",
            permAdvertise: true,
            address: { startsWith: `${building.streetNumber} ` },
          },
          orderBy: { listedAt: "desc" },
          take: 8,
        })
      : [];
  const listings: CondoListing[] = liveRows.map((l) => {
    const lease = l.transactionType === "For Lease";
    const sqft = l.sqft ? `${l.sqft.toLocaleString("en-CA")} sqft` : null;
    return {
      title: `${l.bedrooms} bed${sqft ? ` · ${sqft}` : ""}`,
      meta: [`${l.bedrooms} bed`, `${l.bathrooms} bath`, sqft].filter(Boolean).join(" · "),
      price: lease ? `$${l.price.toLocaleString("en-CA")}/mo` : `$${l.price.toLocaleString("en-CA")}`,
      tenure: lease ? "lease" : "sale",
      href: `/listings/${l.mlsNumber}`,
    };
  });

  // Sibling condos in the same neighbourhood, published only.
  const siblings = building.neighbourhoodId
    ? await prisma.condoBuilding.findMany({
        where: { neighbourhoodId: building.neighbourhoodId, slug: { not: slug } },
        select: { slug: true, displayName: true, buildingAddress: true },
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
    .map((s) => ({ name: s.displayName ?? s.buildingAddress ?? s.slug, slug: s.slug }));

  const name = content.buildingName;
  const address = building.buildingAddress ?? building.displayName ?? name;
  const character = overview.length ? firstSentence(overview[0]) : content.metaDescription ?? "";

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
    bedrooms: [],
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
      href: "/buy",
    },
    ctaSeller: {
      heading: `Own a unit at ${name}?`,
      body: `Get a grounded valuation built on real ${name} comparables.`,
      buttonLabel: "Value my unit",
      href: "/sell",
    },
  };
}

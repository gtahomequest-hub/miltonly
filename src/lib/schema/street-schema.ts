// JSON-LD @graph builder for the street page.
//
// Shape matches the reference schema at the head of
// docs/whitlock-avenue-mockup.html — one LocalBusiness with an embedded
// RealEstateAgent founder, a Place keyed by street slug, AggregateOffer
// per product type (k-anonymity-gated), a BreadcrumbList, FAQPage,
// and two ItemLists (alternative streets, nearby places).

import { generateBreadcrumbSchema, generateFAQSchema } from "@/lib/schema";
import type {
  StreetPageData,
  TypeSectionProps,
  DifferentPriorityItem,
  NearbyPlace,
  FAQItem,
} from "@/types/street";

const SITE_URL = "https://miltonly.com";
const ORG_ID = `${SITE_URL}/#organization`;
const AGENT_ID = `${SITE_URL}/#agent`;
const K_ANON_AGG = 5;

// ────────────────────────────────────────────────────────────────────
// Per-piece builders
// ────────────────────────────────────────────────────────────────────

/**
 * LocalBusiness with embedded RealEstateAgent founder. Keyed by ORG_ID so
 * AggregateOffer rows can reference via `{ "@id": ORG_ID }` as seller.
 */
export function buildLocalBusinessSchema(data: StreetPageData): object {
  const hoodNames = data.street.neighbourhoods.map((n) => `${n} neighbourhood`);
  return {
    "@type": "LocalBusiness",
    "@id": ORG_ID,
    name: "Team Miltonly",
    alternateName: "Miltonly",
    description:
      "Milton real estate advisory serving every street in Milton, Ontario. Street-by-street analysis, professional guidance for buyers and sellers, and deep local expertise.",
    url: SITE_URL,
    address: {
      "@type": "PostalAddress",
      addressLocality: "Milton",
      addressRegion: "ON",
      addressCountry: "CA",
    },
    areaServed: [
      {
        "@type": "City",
        name: "Milton",
        containedInPlace: { "@type": "AdministrativeArea", name: "Ontario" },
      },
    ],
    priceRange: "$$$",
    knowsAbout: [
      "Milton real estate",
      "Milton property valuations",
      "Milton neighbourhoods",
      ...hoodNames,
      data.street.name,
    ],
    founder: {
      "@type": "RealEstateAgent",
      "@id": AGENT_ID,
      name: "Aamir Yaqoob",
      jobTitle: "Real Estate Advisor",
      worksFor: { "@type": "Organization", name: "RE/MAX Realty Specialists Inc." },
      areaServed: { "@type": "City", name: "Milton" },
    },
  };
}

/**
 * Street as a Place, contained in its neighbourhood(s), contained in Milton, Ontario.
 */
export function buildPlaceSchema(data: StreetPageData): object {
  const containedInPlace = data.street.neighbourhoods.map((n) => ({
    "@type": "Place",
    name: n,
    "@id": `${SITE_URL}/neighbourhoods/${slugifyNbhd(n)}`,
    containedInPlace: {
      "@type": "City",
      name: "Milton",
      containedInPlace: { "@type": "AdministrativeArea", name: "Ontario" },
    },
  }));

  return {
    "@type": "Place",
    "@id": `${SITE_URL}/streets/${data.street.slug}#place`,
    name: data.street.name,
    description:
      data.street.characterSummary ||
      `A residential street in ${data.street.neighbourhoods.join(", ") || "Milton"}, Milton Ontario.`,
    url: `${SITE_URL}/streets/${data.street.slug}`,
    containedInPlace: containedInPlace.length > 0 ? containedInPlace : [
      { "@type": "City", name: "Milton" },
    ],
    address: {
      "@type": "PostalAddress",
      streetAddress: data.street.name,
      addressLocality: "Milton",
      addressRegion: "ON",
      addressCountry: "CA",
    },
  };
}

export function buildBreadcrumbListSchema(data: StreetPageData): object {
  return generateBreadcrumbSchema([
    { name: "Home", url: SITE_URL },
    { name: "Streets", url: `${SITE_URL}/streets` },
    { name: `${data.street.name}, Milton`, url: `${SITE_URL}/streets/${data.street.slug}` },
  ]);
}

export function buildFAQPageSchema(faqs: FAQItem[]): object | null {
  if (faqs.length === 0) return null;
  return generateFAQSchema(faqs);
}

export function buildAggregateOfferSchema(
  pt: TypeSectionProps,
  streetName: string,
  streetSlug: string,
  kind: "sale" | "lease"
): object | null {
  if (!pt.hasData || pt.showContactTeamPrompt) return null;
  if (kind === "sale" && pt.typicalPrice <= 0) return null;

  const n = inferSampleSize(pt.statsSold);
  if (n < K_ANON_AGG) return null;

  const itemTypeByProduct: Record<string, string> = {
    detached: "SingleFamilyResidence",
    semi: "House",
    townhouse: "House",
    condo: "Apartment",
    link: "House",
    "freehold-townhouse": "House",
  };

  return {
    "@type": "AggregateOffer",
    "@id": `${SITE_URL}/streets/${streetSlug}#offer-${pt.type}-${kind}`,
    name: `${pt.displayName} ${kind === "sale" ? "homes" : "leases"} on ${streetName}`,
    itemOffered: {
      "@type": itemTypeByProduct[pt.type] ?? "Residence",
      name: `${pt.displayName} on ${streetName}, Milton`,
    },
    offerCount: n,
    lowPrice: inferLowPrice(pt) ?? undefined,
    highPrice: inferHighPrice(pt) ?? undefined,
    price: pt.typicalPrice,
    priceCurrency: "CAD",
    businessFunction: kind === "sale"
      ? "http://purl.org/goodrelations/v1#Sell"
      : "http://purl.org/goodrelations/v1#LeaseOut",
    availability: "https://schema.org/InStock",
    seller: { "@id": ORG_ID },
    areaServed: { "@id": `${SITE_URL}/streets/${streetSlug}#place` },
    url: `${SITE_URL}/streets/${streetSlug}#type-${pt.type}`,
  };
}

export function buildAlternativesItemListSchema(
  items: DifferentPriorityItem[],
  streetSlug: string
): object | null {
  if (items.length === 0) return null;
  return {
    "@type": "ItemList",
    "@id": `${SITE_URL}/streets/${streetSlug}#alternatives`,
    name: "Alternative Milton streets for different priorities",
    description: "Milton streets that may suit buyers with different priorities than this one.",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      item: {
        "@type": "Place",
        name: it.strong,
        description: it.body,
      },
    })),
  };
}

export function buildNearbyPlacesItemListSchema(
  places: NearbyPlace[],
  streetSlug: string,
  streetName: string
): object | null {
  if (places.length === 0) return null;
  return {
    "@type": "ItemList",
    "@id": `${SITE_URL}/streets/${streetSlug}#nearby-places`,
    name: `Places near ${streetName}`,
    description: `Schools, transit, parks, and everyday amenities within reach of ${streetName}.`,
    itemListElement: places.map((p, i) => ({
      "@type": "ListItem",
      position: i + 1,
      item: {
        "@type": categoryToSchemaType(p.category),
        name: p.name,
        address: {
          "@type": "PostalAddress",
          addressLocality: "Milton",
          addressRegion: "ON",
          addressCountry: "CA",
        },
      },
    })),
  };
}

// ────────────────────────────────────────────────────────────────────
// Composer
// ────────────────────────────────────────────────────────────────────

export function buildStreetPageSchema(data: StreetPageData): object {
  const graph: object[] = [
    buildLocalBusinessSchema(data),
    buildPlaceSchema(data),
    buildBreadcrumbListSchema(data),
  ];

  const faq = buildFAQPageSchema(data.faqs);
  if (faq) graph.push(faq);

  for (const pt of data.productTypes) {
    const saleOffer = buildAggregateOfferSchema(pt, data.street.name, data.street.slug, "sale");
    if (saleOffer) graph.push(saleOffer);
  }

  const alternatives = buildAlternativesItemListSchema(
    data.descriptionBody.differentPriorities,
    data.street.slug
  );
  if (alternatives) graph.push(alternatives);

  const nearby = buildNearbyPlacesItemListSchema(
    data.descriptionSidebar.nearbyPlaces,
    data.street.slug,
    data.street.name
  );
  if (nearby) graph.push(nearby);

  return {
    "@context": "https://schema.org",
    "@graph": graph,
  };
}

// ────────────────────────────────────────────────────────────────────
// Category → schema.org type mapping for nearby places
// ────────────────────────────────────────────────────────────────────

function categoryToSchemaType(category: string): string {
  const c = category.toLowerCase();
  if (c.includes("go") || c.includes("station") || c.includes("train")) return "TrainStation";
  if (c.includes("secondary") || c.includes("high")) return "HighSchool";
  if (c.includes("elementary") || c.includes("primary")) return "ElementarySchool";
  if (c === "school" || c.includes("school")) return "School";
  if (c.includes("hospital") || c.includes("health")) return "Hospital";
  if (c.includes("park") || c.includes("conservation") || c.includes("rec")) return "Park";
  if (c.includes("grocer") || c.includes("supermarket") || c.includes("food")) return "GroceryStore";
  if (c.includes("shop") || c.includes("mall") || c.includes("plaza")) return "ShoppingCenter";
  if (c.includes("mosque") || c.includes("church") || c.includes("temple") || c.includes("worship")) return "PlaceOfWorship";
  return "Place";
}

function slugifyNbhd(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

// ────────────────────────────────────────────────────────────────────
// Inference helpers — pull numeric meta out of the stat cells.
// ────────────────────────────────────────────────────────────────────

function inferSampleSize(stats: Array<{ label: string; detail?: string }>): number {
  for (const s of stats) {
    const m = (s.detail ?? "").match(/across\s+(\d+)\s+sales?/i);
    if (m) return parseInt(m[1], 10);
  }
  return 0;
}

function inferLowPrice(pt: TypeSectionProps): number | null {
  const band = pt.statsSold.find((s) => s.label === "Price band");
  if (!band) return null;
  const m = band.value.match(/\$([0-9.]+)M?\s*[–-]/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  return band.value.includes("M") ? Math.round(n * 1_000_000) : Math.round(n * 1_000);
}

function inferHighPrice(pt: TypeSectionProps): number | null {
  const band = pt.statsSold.find((s) => s.label === "Price band");
  if (!band) return null;
  const m = band.value.match(/[–-]\s*\$([0-9.]+)M?/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  return band.value.includes("M") ? Math.round(n * 1_000_000) : Math.round(n * 1_000);
}

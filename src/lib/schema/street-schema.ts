// JSON-LD @graph builder for the street page.
//
// One LocalBusiness with an embedded RealEstateAgent founder, a Place keyed by street slug, a
// BreadcrumbList, a WebPage, FAQPage, and ItemLists (nearby places, the Town's addresses).
//
// NO VOW VALUE IN ANY NODE (MC-046 Stage 1, PropTx VOW Best Practices item 40). The Place's
// additionalProperty (the typical sale price per home type, "across N sales") and the
// AggregateOffer builder before it are gone; WebPage.dateModified is the profile's generation
// date, never a sale date; the FAQPage node is built from the page's own filtered FAQ list.

import { generateBreadcrumbSchema, generateFAQSchema } from "@/lib/schema";
import { config } from "@/lib/config";
import type { StreetVideoClip } from "@/lib/streetVideo";
import type { AddressLadder } from "@/lib/streetAddresses";
import type {
  StreetPageData,
  DifferentPriorityItem,
  NearbyPlace,
  FAQItem,
  StreetSection,
} from "@/types/street";

/**
 * Content resolved at the page-component level before schema is built.
 * Lets the composer emit schema from generation-aware sources (FAQ list,
 * 8-section body) instead of the `getStreetPageData` legacy fields.
 */
export interface ResolvedStreetContent {
  faqs: FAQItem[];
  sections: StreetSection[];
}

const SITE_URL = config.SITE_URL;
const ORG_ID = `${SITE_URL}/#organization`;
const AGENT_ID = `${SITE_URL}/#agent`;
const CITY_PROVINCE_LABEL = `${config.CITY_NAME} ${config.CITY_PROVINCE}`;

// ────────────────────────────────────────────────────────────────────
// Per-piece builders
// ────────────────────────────────────────────────────────────────────

/**
 * LocalBusiness with embedded RealEstateAgent founder. Keyed by ORG_ID.
 */
export function buildLocalBusinessSchema(data: StreetPageData): object {
  const hoodNames = data.street.neighbourhoods.map((n) => `${n} neighbourhood`);
  return {
    "@type": "LocalBusiness",
    "@id": ORG_ID,
    name: `Team ${config.SITE_NAME}`,
    alternateName: config.SITE_NAME,
    description: `${config.CITY_NAME} real estate advisory serving every street in ${CITY_PROVINCE_LABEL}. Street-by-street analysis, professional guidance for buyers and sellers, and deep local expertise.`,
    url: SITE_URL,
    address: {
      "@type": "PostalAddress",
      addressLocality: config.CITY_NAME,
      addressRegion: config.CITY_PROVINCE_CODE,
      addressCountry: config.CITY_COUNTRY_CODE,
    },
    areaServed: [
      {
        "@type": "City",
        name: config.CITY_NAME,
        containedInPlace: { "@type": "AdministrativeArea", name: config.CITY_PROVINCE },
      },
    ],
    priceRange: "$$$",
    knowsAbout: [
      `${config.CITY_NAME} real estate`,
      `${config.CITY_NAME} property valuations`,
      `${config.CITY_NAME} neighbourhoods`,
      ...hoodNames,
      data.street.name,
    ],
    founder: {
      "@type": "RealEstateAgent",
      "@id": AGENT_ID,
      name: config.realtor.name,
      jobTitle: "Real Estate Advisor",
      worksFor: { "@type": "Organization", name: config.brokerage.name },
      areaServed: { "@type": "City", name: config.CITY_NAME },
    },
  };
}

/**
 * Street as a Place, contained in its neighbourhood(s), contained in Milton, Ontario.
 */
export function buildPlaceSchema(data: StreetPageData): object {
  // containedInPlace prefers the RESOLVED published-hub links (data.contextCards.neighbourhoods —
  // registry-resolved + gated on published HubContent, the SAME resolution as the visible up-link),
  // so the @id is a real /neighbourhoods/<slug> URL, not the old name-guess that emitted broken hub
  // URLs (Walker → /neighbourhoods/1051---walker). When nothing resolves to a published hub, fall
  // back to name-only Places (valid schema, no dead link).
  const city = {
    "@type": "City",
    name: config.CITY_NAME,
    containedInPlace: { "@type": "AdministrativeArea", name: config.CITY_PROVINCE },
  };
  const resolvedHubs = data.contextCards?.neighbourhoods ?? [];
  const containedInPlace =
    resolvedHubs.length > 0
      ? resolvedHubs.map((h) => ({
          "@type": "Place",
          name: h.name,
          "@id": `${SITE_URL}/neighbourhoods/${h.slug}`,
          containedInPlace: city,
        }))
      : data.street.neighbourhoods.map((n) => ({
          "@type": "Place",
          name: n,
          containedInPlace: city,
        }));

  return {
    "@type": "Place",
    "@id": `${SITE_URL}/streets/${data.street.slug}#place`,
    name: data.street.name,
    description:
      data.street.characterSummary ||
      `A residential street in ${data.street.neighbourhoods.join(", ") || config.CITY_NAME}, ${CITY_PROVINCE_LABEL}.`,
    url: `${SITE_URL}/streets/${data.street.slug}`,
    containedInPlace: containedInPlace.length > 0 ? containedInPlace : [
      { "@type": "City", name: config.CITY_NAME },
    ],
    address: {
      "@type": "PostalAddress",
      streetAddress: data.street.name,
      addressLocality: config.CITY_NAME,
      addressRegion: config.CITY_PROVINCE_CODE,
      addressCountry: config.CITY_COUNTRY_CODE,
    },
  };
}

export function buildBreadcrumbListSchema(data: StreetPageData): object {
  return generateBreadcrumbSchema([
    { name: "Home", url: SITE_URL },
    { name: "Streets", url: `${SITE_URL}/streets` },
    { name: `${data.street.name}, ${config.CITY_NAME}`, url: `${SITE_URL}/streets/${data.street.slug}` },
  ]);
}

export function buildFAQPageSchema(faqs: FAQItem[]): object | null {
  if (faqs.length === 0) return null;
  return generateFAQSchema(faqs);
}

/** THE PAGE ITSELF (MH-005, MA-001 change 6): a WebPage node with the date the page last
 *  changed (the profile's generation date, never a sale date: MC-046, R5), its image (the
 *  filmed poster, or the rendered street card) and the Place it is about. */
export function buildWebPageSchema(data: StreetPageData): object {
  const url = `${SITE_URL}/streets/${data.street.slug}`;
  const poster = data.video?.day?.poster ?? data.video?.night?.poster ?? null;
  return {
    "@type": "WebPage",
    "@id": `${url}#webpage`,
    url,
    name: `${data.street.name}, ${config.CITY_NAME}: Homes, Prices and Sales History`,
    dateModified: data.lastUpdated,
    image: poster ?? `${url}/og.png`,
    about: { "@id": `${url}#place` },
    isPartOf: { "@type": "WebSite", url: SITE_URL, name: config.SITE_NAME },
    inLanguage: "en-CA",
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
    name: `Alternative ${config.CITY_NAME} streets for different priorities`,
    description: `${config.CITY_NAME} streets that may suit buyers with different priorities than this one.`,
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
          addressLocality: config.CITY_NAME,
          addressRegion: config.CITY_PROVINCE_CODE,
          addressCountry: config.CITY_COUNTRY_CODE,
        },
      },
    })),
  };
}

/**
 * ItemList of the street's civic addresses — QUEUE item 3.
 *
 * PostalAddress and nothing else. There is deliberately NO `offers`, NO `AggregateOffer` and NO
 * `price` on any item: an offers node on a single address is exactly the shape that would smuggle
 * a per-address figure into structured data, and it is the one thing this list must never emit.
 * The prebuild guard (scripts/test-address-anchors.ts) asserts that, so the rule survives an edit
 * that forgets it.
 *
 * Each item's `url` is the in-page anchor the section renders, so the list and the DOM agree.
 */
export function buildAddressesItemListSchema(
  ladder: AddressLadder | null,
  streetSlug: string,
  streetName: string
): object | null {
  if (!ladder || ladder.marks.length === 0) return null;
  const base = `${SITE_URL}/streets/${streetSlug}`;
  return {
    "@type": "ItemList",
    "@id": `${base}#addresses`,
    name: `Addresses on ${streetName}`,
    description: `Civic addresses on ${streetName} recorded by the Town of ${config.CITY_NAME}.`,
    numberOfItems: ladder.marks.length,
    itemListOrder: "https://schema.org/ItemListOrderAscending",
    itemListElement: ladder.marks.map((m, i) => ({
      "@type": "ListItem",
      position: i + 1,
      // Four fields and no fifth. addressCountry was dropped 2026-09-08: addressRegion "ON"
      // already disambiguates Milton, and on the longest street the field costs 24 bytes 387
      // times over, twice, once in the markup and once in the inlined flight payload.
      item: {
        "@type": "PostalAddress",
        streetAddress: `${m.number} ${streetName}`,
        addressLocality: config.CITY_NAME,
        addressRegion: config.CITY_PROVINCE_CODE,
        url: `${base}#${m.number}`,
      },
    })),
  };
}

/**
 * VideoObject for one resolved clip. Emitted for any page carrying video. Returns null
 * unless Google's required trio is satisfiable: name, uploadDate, and a thumbnailUrl
 * (the derived poster). `duration` comes from the sidecar (src/data/streetVideoMeta.json,
 * MC-015) and is omitted, never fabricated, when the clip has no entry.
 */
export function buildVideoObjectSchema(clip: StreetVideoClip): object | null {
  if (!clip.poster || !clip.uploadDate) return null;
  return {
    "@type": "VideoObject",
    name: clip.name,
    description: clip.description,
    thumbnailUrl: clip.poster,
    uploadDate: clip.uploadDate,
    contentUrl: clip.src,
    ...(clip.durationIso ? { duration: clip.durationIso } : {}),
  };
}

// ────────────────────────────────────────────────────────────────────
// Composer
// ────────────────────────────────────────────────────────────────────

export function buildStreetPageSchema(
  data: StreetPageData,
  resolved: ResolvedStreetContent,
): object {
  const graph: object[] = [
    buildLocalBusinessSchema(data),
    buildPlaceSchema(data),
    buildBreadcrumbListSchema(data),
    buildWebPageSchema(data),
  ];

  // FAQPage and Alternatives ItemList both source from `resolved`, not from
  // the legacy `data.faqs` / `data.descriptionBody`. The page component is
  // responsible for feeding the generation-aware versions when a succeeded
  // StreetGeneration row exists; otherwise it passes the legacy-shape values.
  const faq = buildFAQPageSchema(resolved.faqs);
  if (faq) graph.push(faq);

  // AGGREGATEOFFER IS GONE (MH-005, MA-001 defect 28), and so is the Place.additionalProperty
  // that replaced it (MC-046): the typical sale price per home type is a value derived from sold
  // records, and no node in this graph carries one.

  // DROPPED (A2): the "alternative streets" ItemList sourced from prose paragraphs, so every item
  // had an EMPTY name (strong:"") and NO url — an ItemList that names and points at nothing. Prose
  // can't yield real published-street slugs, so rather than ship an inert node we omit it. Genuine
  // street-to-street linking now lives on /neighbourhoods/[slug]/streets (published 200s only).
  // (buildAlternativesItemListSchema is left exported for its unit test; simply no longer emitted.)

  const nearby = buildNearbyPlacesItemListSchema(
    data.descriptionSidebar.nearbyPlaces,
    data.street.slug,
    data.street.name
  );
  if (nearby) graph.push(nearby);

  const addresses = buildAddressesItemListSchema(
    data.addressLadder,
    data.street.slug,
    data.street.name
  );
  if (addresses) graph.push(addresses);

  // VideoObject per present clip — on any page carrying video (standard or minimal).
  if (data.video) {
    for (const clip of [data.video.day, data.video.night]) {
      if (!clip) continue;
      const video = buildVideoObjectSchema(clip);
      if (video) graph.push(video);
    }
  }

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

// (slugifyNbhd removed — it produced unvalidated /neighbourhoods/ @id URLs; see buildPlaceSchema.)

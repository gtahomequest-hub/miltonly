const SITE_URL = "https://miltonly.com";

export function generateLocalBusinessSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "RealEstateAgent",
    name: "Miltonly",
    description:
      "Milton Ontario's only dedicated real estate platform. Street intelligence, neighbourhood comparisons, live TREB listings and home valuations.",
    url: SITE_URL,
    logo: `${SITE_URL}/logo.png`,
    image: `${SITE_URL}/og-image.jpg`,
    telephone: process.env.REALTOR_PHONE ?? "",
    email: process.env.REALTOR_EMAIL ?? "",
    address: {
      "@type": "PostalAddress",
      addressLocality: "Milton",
      addressRegion: "Ontario",
      addressCountry: "CA",
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: "43.5083",
      longitude: "-79.8822",
    },
    areaServed: {
      "@type": "City",
      name: "Milton",
      containedInPlace: {
        "@type": "AdministrativeArea",
        name: "Ontario",
        containedInPlace: {
          "@type": "Country",
          name: "Canada",
        },
      },
    },
    serviceType: [
      "Residential Real Estate",
      "Home Buying",
      "Home Selling",
      "Property Valuation",
      "Real Estate Market Analysis",
      "Rental Properties",
    ],
    openingHours: "Mo-Su 08:00-20:00",
    priceRange: "$$",
    sameAs: [
      "https://www.facebook.com/miltonly",
      "https://www.instagram.com/miltonly",
    ],
  };
}

export function generateWebSiteSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Miltonly",
    url: SITE_URL,
    description:
      "Milton Ontario real estate platform — homes for sale, street intelligence, neighbourhood comparisons and home valuations",
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITE_URL}/listings?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

export interface FAQItem {
  question: string;
  answer: string;
}

export function generateFAQSchema(faqs: FAQItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };
}

export interface BreadcrumbItem {
  name: string;
  url: string;
}

export function generateBreadcrumbSchema(items: BreadcrumbItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

export function generateListingSchema(listing: {
  mlsNumber: string;
  address: string;
  price: number;
  bedrooms: number;
  bathrooms: number;
  sqft?: number | null;
  description?: string | null;
  photos: string[];
  latitude: number;
  longitude: number;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "RealEstateListing",
    name: `${listing.address} — Milton Ontario`,
    description:
      listing.description ??
      `${listing.bedrooms} bed, ${listing.bathrooms} bath home at ${listing.address}, Milton ON. Listed at $${listing.price.toLocaleString()}.`,
    url: `${SITE_URL}/listings/${listing.mlsNumber}`,
    image: listing.photos.length > 0 ? listing.photos[0] : `${SITE_URL}/og-image.jpg`,
    offers: {
      "@type": "Offer",
      price: listing.price,
      priceCurrency: "CAD",
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: listing.latitude,
      longitude: listing.longitude,
    },
    numberOfRooms: listing.bedrooms,
    numberOfBathroomsTotal: listing.bathrooms,
    floorSize: listing.sqft
      ? { "@type": "QuantitativeValue", value: listing.sqft, unitCode: "SQF" }
      : undefined,
  };
}

export function generateStreetPageSchema(street: {
  streetName: string;
  streetSlug: string;
  avgListPrice: number;
  activeListings: number;
  neighbourhood: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Place",
    name: `${street.streetName}, Milton Ontario`,
    description: `Real estate data for ${street.streetName} in ${street.neighbourhood}, Milton Ontario. ${street.activeListings} active listings, average list price $${street.avgListPrice.toLocaleString()}.`,
    url: `${SITE_URL}/streets/${street.streetSlug}`,
    address: {
      "@type": "PostalAddress",
      streetAddress: street.streetName,
      addressLocality: "Milton",
      addressRegion: "Ontario",
      addressCountry: "CA",
    },
    containedInPlace: {
      "@type": "City",
      name: "Milton",
    },
  };
}

export function generateNeighbourhoodSchema(neighbourhood: {
  name: string;
  slug: string;
  description?: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Place",
    name: `${neighbourhood.name}, Milton Ontario`,
    description:
      neighbourhood.description ??
      `Explore homes for sale, schools, and detailed market data in ${neighbourhood.name}, Milton Ontario.`,
    url: `${SITE_URL}/neighbourhoods/${neighbourhood.slug}`,
    address: {
      "@type": "PostalAddress",
      addressLocality: "Milton",
      addressRegion: "Ontario",
      addressCountry: "CA",
    },
  };
}

export function generateCondoSchema(building: {
  name: string;
  slug: string;
  address: string;
  yearBuilt?: number | null;
  totalUnits?: number | null;
  latitude: number;
  longitude: number;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "ApartmentComplex",
    name: building.name,
    description: `Condo units for sale, rent, and investment data at ${building.name}, Milton Ontario.`,
    url: `${SITE_URL}/condos/${building.slug}`,
    address: {
      "@type": "PostalAddress",
      streetAddress: building.address,
      addressLocality: "Milton",
      addressRegion: "Ontario",
      addressCountry: "CA",
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: building.latitude,
      longitude: building.longitude,
    },
    yearBuilt: building.yearBuilt ?? undefined,
    numberOfAccommodationUnits: building.totalUnits ?? undefined,
  };
}

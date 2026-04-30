import { config } from "./config";

const SITE_URL = config.SITE_URL;
const CITY_PROVINCE_LABEL = `${config.CITY_NAME} ${config.CITY_PROVINCE}`;

export function generateLocalBusinessSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "RealEstateAgent",
    name: config.SITE_NAME,
    description: `${CITY_PROVINCE_LABEL}'s only dedicated real estate platform. Street intelligence, neighbourhood comparisons, live TREB listings and home valuations.`,
    url: SITE_URL,
    logo: `${SITE_URL}/logo.png`,
    image: `${SITE_URL}/og-image.jpg`,
    telephone: process.env.REALTOR_PHONE ?? "",
    email: process.env.REALTOR_EMAIL ?? "",
    address: {
      "@type": "PostalAddress",
      addressLocality: config.CITY_NAME,
      addressRegion: config.CITY_PROVINCE,
      addressCountry: config.CITY_COUNTRY_CODE,
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: "43.5083",
      longitude: "-79.8822",
    },
    areaServed: {
      "@type": "City",
      name: config.CITY_NAME,
      containedInPlace: {
        "@type": "AdministrativeArea",
        name: config.CITY_PROVINCE,
        containedInPlace: {
          "@type": "Country",
          name: config.CITY_COUNTRY,
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
      `https://www.facebook.com/${config.SITE_NAME.toLowerCase()}`,
      `https://www.instagram.com/${config.SITE_NAME.toLowerCase()}`,
    ],
  };
}

export function generateWebSiteSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: config.SITE_NAME,
    url: SITE_URL,
    description: `${CITY_PROVINCE_LABEL} real estate platform — homes for sale, street intelligence, neighbourhood comparisons and home valuations`,
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
    name: `${listing.address} — ${CITY_PROVINCE_LABEL}`,
    description:
      listing.description ??
      `${listing.bedrooms} bed, ${listing.bathrooms} bath home at ${listing.address}, ${config.CITY_NAME} ${config.CITY_PROVINCE_CODE}. Listed at $${listing.price.toLocaleString()}.`,
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
    name: `${street.streetName}, ${CITY_PROVINCE_LABEL}`,
    description: `Real estate data for ${street.streetName} in ${street.neighbourhood}, ${CITY_PROVINCE_LABEL}. ${street.activeListings} active listings, average list price $${street.avgListPrice.toLocaleString()}.`,
    url: `${SITE_URL}/streets/${street.streetSlug}`,
    address: {
      "@type": "PostalAddress",
      streetAddress: street.streetName,
      addressLocality: config.CITY_NAME,
      addressRegion: config.CITY_PROVINCE,
      addressCountry: config.CITY_COUNTRY_CODE,
    },
    containedInPlace: {
      "@type": "City",
      name: config.CITY_NAME,
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
    name: `${neighbourhood.name}, ${CITY_PROVINCE_LABEL}`,
    description:
      neighbourhood.description ??
      `Explore homes for sale, schools, and detailed market data in ${neighbourhood.name}, ${CITY_PROVINCE_LABEL}.`,
    url: `${SITE_URL}/neighbourhoods/${neighbourhood.slug}`,
    address: {
      "@type": "PostalAddress",
      addressLocality: config.CITY_NAME,
      addressRegion: config.CITY_PROVINCE,
      addressCountry: config.CITY_COUNTRY_CODE,
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
    description: `Condo units for sale, rent, and investment data at ${building.name}, ${CITY_PROVINCE_LABEL}.`,
    url: `${SITE_URL}/condos/${building.slug}`,
    address: {
      "@type": "PostalAddress",
      streetAddress: building.address,
      addressLocality: config.CITY_NAME,
      addressRegion: config.CITY_PROVINCE,
      addressCountry: config.CITY_COUNTRY_CODE,
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

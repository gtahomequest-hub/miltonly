// src/lib/config.ts
// Single source of truth for city-specific values.
// To fork for a new city: copy this file, replace values, redeploy with new domain.
// See Notion Decision: https://app.notion.com/p/3528f3a328f381c786f2f574b2dcf3ce

export const config = {
  // === City identity ===
  CITY_NAME: "Milton",
  CITY_PROVINCE: "Ontario",
  CITY_PROVINCE_CODE: "ON",
  CITY_COUNTRY: "Canada",
  CITY_COUNTRY_CODE: "CA",

  // === URLs and domain ===
  SITE_URL: "https://miltonly.com",
  SITE_URL_WWW: "https://www.miltonly.com",
  SITE_DOMAIN: "miltonly.com",
  SITE_NAME: "Miltonly",

  // === Slug pattern ===
  SLUG_SUFFIX: "milton",

  // === MLS data filters ===
  AMPRE_CITY_FILTER: "Milton",
  PRISMA_CITY_VALUE: "Milton",

  // === Realtor (per-fork compliance) ===
  realtor: {
    name: "Aamir Yaqoob",
    title: "Sales Representative",
    phone: "(647) 839-9090",
    phoneE164: "+16478399090",
    email: "aamir@miltonly.com",
    yearsExperience: 14,
  },

  // === Brokerage (RECO compliance) ===
  brokerage: {
    name: "RE/MAX Realty Specialists Inc., Brokerage",
    serviceArea: "Milton, Ontario",
  },

  // === SEO ===
  seo: {
    keywords: [
      "Milton Ontario real estate",
      "Milton homes for sale",
      "Milton real estate listings",
      "Milton Ontario homes",
      "buy home Milton",
      "sell home Milton",
      "Milton real estate market",
      "Milton neighbourhood comparison",
    ],
    defaultTitleSuffix: "Milton Ontario Real Estate — Homes For Sale, Street Data & Market Intelligence",
    defaultDescription: "Milton Ontario's only dedicated real estate platform. Search homes for sale, compare streets and neighbourhoods, get your home value, and access street-level market data. Live TREB listings updated daily.",
  },

  // === Featured neighbourhoods (for footer/links) ===
  FEATURED_NEIGHBOURHOODS: [
    "Dempsey", "Beaty", "Willmott", "Hawthorne Village", "Timberlea", "Old Milton"
  ],

  // === AI generation context ===
  ai: {
    cityContextForPrompts: "Milton, Ontario, a town of ~135K in Halton Region, ~30 min west of Toronto",
    knownAnchors: [
      "Old Milton", "Milton", "Ford", "Willmott", "Cobban", "Scott",
      "Highway 401", "Highway 407", "Milton GO", "GO", "TTC", "Derry Road",
      "Milton District Hospital", "Milton Islamic Centre",
    ],
  },
} as const;

export type Config = typeof config;

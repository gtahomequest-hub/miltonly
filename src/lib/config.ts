// src/lib/config.ts
// Single source of truth for city-specific values.
// To fork for a new city: copy this file, replace values, redeploy with new domain.
// See Notion Decision: https://app.notion.com/p/3528f3a328f381c786f2f574b2dcf3ce

// Realtor first name extracted at module load so the SLA copy block below can
// interpolate it without depending on the `config` object being fully defined.
// Forks: change this token together with `realtor.name` so the two stay in sync.
const REALTOR_FIRST_NAME = "Aamir";

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
    yearsExperience: 15,

    // Languages business is conducted in. Person schema reads from this
    // as `knowsLanguage`. Pending Aamir confirmation (item A6) on
    // business-level competence for Hindi/Urdu/Punjabi vs conversational.
    languages: ["English", "Hindi", "Urdu", "Punjabi"],

    // Awards. Brokerage compliance must approve any new entries before
    // they appear on a public marketing page.
    awards: ["RE/MAX Hall of Fame"],

    // Headline metrics for /about (and any future credibility surface).
    // Each value is null until Aamir confirms (items A1-A5 outstanding
    // per DEC-ABOUT-CANONICAL 2026-05-19). Components MUST render
    // "Coming shortly" or "—" states for null values; do not invent
    // numbers. When delivered, replace null + document the source and
    // as-of date in docs/about-page-stats-sources.md for RECO defensibility.
    metrics: {
      // A1 confirmed: $57.5M closed lifetime. Composition (sale-side
      // only vs combined sale + lease) still pending Aamir — does not
      // block display; treat as a portfolio-wide figure until clarified.
      totalVolumeClosed: "$57.5M" as string | null,
      // A2 confirmed value is 165 — but uniqueness (unique families vs
      // includes repeat clients) is still pending. Per gate brief,
      // render as "—" in stat tiles until that disambiguation lands so
      // we don't publish a number that could be challenged. When
      // confirmed, set transactionCount and/or familiesServed.
      transactionCount: null as number | null,
      familiesServed: null as number | null,
      yearsInMilton: null as number | null,         // A4 — may differ from yearsExperience
      googleRating: null as number | null,          // A5 — e.g. 4.9
      googleReviewsCount: null as number | null,    // A5 — review count
    },

    // Structured contact methods. Top-level phone/email above are
    // preserved for existing callers; this nested shape exposes the
    // WhatsApp + raw forms needed by /about components without breaking
    // imports. Email here is the actual public contact channel
    // (aamir@miltonly.com top-level is reserved for future routing).
    contact: {
      phoneDisplay: "(647) 839-9090",
      phoneRaw: "16478399090",
      phoneE164: "+16478399090",
      email: "gtahomequest@gmail.com",
      whatsapp: "16478399090",
    },

    // Service area — locked framing per DEC-ABOUT-CANONICAL 2026-05-19.
    // Aamir is provincially licensed and actively serves anywhere in
    // Ontario. primaryCity is for SEO/schema weighting only (deepest
    // transaction history); it is NOT a service-area boundary.
    // /about ServiceAreaSection must render Ontario-wide framing with
    // Milton as a subtle home-base anchor — never shade Milton as a
    // service-zone polygon.
    areaServed: {
      primaryCity: "Milton",
      licensedRegion: "Ontario",
      serviceAreaDisplay: "Serving buyers, sellers, and tenants across Ontario",
      serviceAreaSubtext: "Deepest market data in Milton. Same standards anywhere in Ontario.",
    },
  },

  // === Brokerage (RECO compliance) ===
  brokerage: {
    name: "RE/MAX Realty Specialists Inc., Brokerage",
    serviceArea: "Milton, Ontario",
  },

  // === SLA copy — single source of truth ===
  // Every surface in the sales funnel that promises a reply window reads from
  // this block. Ops policy (e.g. "we now answer until 10pm") cascades through
  // landing page sublines, trust card pill, message box footer, the sales
  // /thank-you page, and the sales auto-reply email by editing here once.
  // Canonical commitment: under 60 min during business hours (9am – 9pm ET,
  // 7 days). The hours qualifier appears on prose surfaces; pills stay short.
  sla: {
    // Pill / badge form — used in tight UI badges where the hours qualifier
    // doesn't fit and where the visitor will encounter the full statement
    // immediately above or below in prose.
    short: "Replies under 60 min",

    // ── Landing-page sublines ──
    topFormSubline: `${REALTOR_FIRST_NAME} replies under 60 min · 9am – 9pm ET · 7 days.`,
    bookingBandSubline: `${REALTOR_FIRST_NAME} confirms your time under 60 min · 9am – 9pm ET · 7 days.`,

    // ── /sales/thank-you surfaces ──
    // Hero line composes inline with the optional firstName greeting upstream,
    // so it's stored without a leading "Got it" — caller prepends.
    thankYouHero: `${REALTOR_FIRST_NAME} is calling you under 60 min (9am – 9pm ET, 7 days).`,
    thankYouReassurance: `${REALTOR_FIRST_NAME} reviews every sales request personally. You'll hear from him under 60 min (9am – 9pm ET, 7 days).`,
    // After the hero already states the SLA, the Save-Contact CTA hint just
    // points at the upcoming call without re-stating the window.
    thankYouSaveContactHint: "So you recognize his call when it comes.",
    thankYouAamirIntro: "I personally call every sales lead under 60 min during business hours (9am – 9pm ET, 7 days).",
    // Terse step variant for the timeline list.
    thankYouStepTwo: `${REALTOR_FIRST_NAME} calls you under 60 min (9am – 9pm ET, 7 days)`,

    // ── Auto-reply email surfaces ──
    // Subject fragment composes at the call site with the property phrase
    // (e.g. `Got your request for ${addr} — ${emailSubjectFragment}`).
    emailSubjectFragment: "calling you under 60 min (9am – 9pm ET, 7 days)",
    // The SLA-bearing sentence in the auto-reply body. Surrounding sentences
    // ("For anything urgent before then, call or text...") stay in route.ts
    // so they can interpolate the realtor phone number.
    emailBody: "I'll call you under 60 min during business hours (9am – 9pm ET, 7 days a week).",
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

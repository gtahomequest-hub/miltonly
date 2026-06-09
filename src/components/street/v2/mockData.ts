// src/components/street/v2/mockData.ts
// Two fixtures to exercise the shell standalone (the data window swaps these for
// getStreetV2Data(slug)). `rich` proves the full publishable state; `thin` proves
// EVERY k-anon silent state — silent typical/band, contact-team prompts, no chart,
// no lease pills, suppressed glance tiles, and the gated sold-records overlay.
import type { StreetV2Data, ChartPoint } from './types';

const SALE_CHART: ChartPoint[] = [
  { quarter: "Q2 '24", value: 1_040_000, count: 6 },
  { quarter: "Q3 '24", value: 1_080_000, count: 9 },
  { quarter: "Q4 '24", value: 1_120_000, count: 7 },
  { quarter: "Q1 '25", value: 1_140_000, count: 8 },
];

export const mockStreetRich: StreetV2Data = {
  slug: 'main-street-east-milton',
  name: 'Main Street East',
  shortName: 'Main St E',
  eyebrow: 'Street Profile · Old Milton · Milton, ON',
  subtitle:
    'A central spine of Old Milton where detached century homes meet walk-to-downtown convenience and the deepest sale history on the street grid.',
  neighbourhoods: ['Old Milton'],

  hero: {
    stats: [
      { label: 'Housing mix', value: null, kind: 'text', textValue: 'Detached · town' },
      {
        label: 'Typical price',
        value: 1_140_000,
        kind: 'price',
        sub: 'range $805K to $1.55M',
      },
      { label: 'Transactions tracked', value: 244, kind: 'count' },
      { label: 'Active right now', value: 5, kind: 'count' },
    ],
    salePills: [
      { type: 'detached', displayName: 'Detached', count: 18, typicalPrice: 1_210_000, priceLabel: 'typical', anchor: '#type-detached' },
      { type: 'townhouse', displayName: 'Townhouse', count: 11, typicalPrice: 905_000, priceLabel: 'typical', anchor: '#type-townhouse' },
      { type: 'semi', displayName: 'Semi', count: 6, typicalPrice: 985_000, priceLabel: 'typical', anchor: '#type-semi' },
    ],
    leasePills: [
      { type: 'condo', displayName: 'Lease', count: 223, typicalPrice: 2_650, priceLabel: 'typical / mo', anchor: '#type-condo' },
    ],
  },

  placeholder: false,
  ownerCtaPrice: 1_140_000,
  sections: [
    {
      id: 'about',
      heading: 'About Main Street East',
      paragraphs: [
        'Main Street East runs through the heart of Old Milton, where the town began. The housing stock is a deliberate blend — century-old detached homes on deep lots sit alongside infill townhomes, and the walk to the downtown core is measured in minutes rather than kilometres.',
        'It is one of the most-traded street identities in Milton, which means the read here is grounded in a deep record rather than a handful of sales.',
      ],
    },
    {
      id: 'homes',
      heading: 'The homes',
      paragraphs: [
        'Detached homes dominate the closed-sale record and command the top of the range, while a band of townhomes broadens the entry point. Lot depth is the quiet differentiator — the east side carries the largest parcels.',
      ],
    },
    {
      id: 'market',
      heading: 'The market',
      paragraphs: [
        'Over the trailing year homes on Main Street East have traded around the low-$1.1Ms, a premium to the Milton-wide typical that reflects the detached-heavy stock and central position. Activity stays brisk, with homes moving a few days faster than the city median.',
      ],
    },
    {
      id: 'bestFitFor',
      heading: 'Who it suits',
      paragraphs: [
        'It fits buyers who want walkability without surrendering a real lot — families trading up from the newer subdivisions, and downsizers who want to stay close to the core.',
      ],
    },
  ],

  sidebar: {
    facts: [
      { label: 'Neighbourhood', value: 'Old Milton' },
      { label: 'Typical price', value: '$1.14M' },
      { label: 'Price band', value: '$805K to $1.55M' },
      { label: 'Typical days on market', value: '21 days' },
      { label: 'Transactions tracked', value: '244' },
    ],
    nearby: [
      { category: 'Grocery', name: 'Sobeys Milton', distance: '4 min drive', icon: '🛒' },
      { category: 'GO Station', name: 'Milton GO', distance: '6 min drive', icon: '🚆' },
      { category: 'School', name: 'Martin Street PS', distance: '8 min walk', icon: '🏫' },
      { category: 'Mosque', name: 'Milton Islamic Centre', distance: '7 min drive', icon: '🕌' },
    ],
    cta: {
      eyebrow: 'For Main St E owners',
      headline: 'What is yours worth today?',
      body: 'A short conversation grounded in every sale we have tracked on Main Street East.',
      actionLabel: 'Request a valuation',
      actionHref: '#valuation',
      trustLine: 'Complimentary · Response within one hour',
    },
  },

  productTypes: [
    {
      type: 'detached',
      displayName: 'Detached',
      intro: 'Detached inventory on Main Street East has seen 18 closed sales recently — the deepest and priciest band on the street.',
      salesCount: 18,
      typicalPrice: 1_210_000,
      priceBand: { low: 950_000, high: 1_550_000 },
      dom: 19,
      soldToAsk: 0.99,
      activeCount: 3,
      activeAvgList: 1_240_000,
      chart: {
        headline: 'Quarterly sold trend · Detached',
        note: 'Based on closed detached sales on Main Street East.',
        trendLabel: '+9.6%',
        data: SALE_CHART,
      },
      contactTeamPrompt: false,
    },
    {
      type: 'townhouse',
      displayName: 'Townhouse',
      intro: 'Townhomes broaden the entry point with 11 closed sales recently.',
      salesCount: 11,
      typicalPrice: 905_000,
      priceBand: { low: 820_000, high: 1_010_000 },
      dom: 16,
      soldToAsk: 1.01,
      activeCount: 2,
      activeAvgList: 915_000,
      chart: null,
      contactTeamPrompt: false,
    },
  ],

  glance: [
    { label: 'Transactions tracked', value: '244', detail: 'recent activity' },
    { label: 'Typical sold', value: '$1.14M', detail: 'across sale records' },
    { label: 'Typical DOM', value: '21d', detail: 'closed sales' },
    { label: 'Sold to ask', value: '99%', detail: 'buyer competition' },
    { label: 'Detached sold', value: '$1.21M', detail: 'across 18' },
    { label: 'Townhouse sold', value: '$905K', detail: 'across 11' },
    { label: 'Lowest sold', value: '$805K', detail: 'last 12 mo' },
    { label: 'Highest sold', value: '$1.55M', detail: 'last 12 mo' },
    { label: 'Active right now', value: '5', detail: 'live listings' },
    { label: 'Trend', value: '+8.1%', detail: 'year over year' },
    { label: 'Market state', value: 'Balanced', detail: 'per current activity' },
    { label: 'Busiest month', value: 'May', detail: 'most closings' },
  ],

  market: {
    sales: {
      title: 'Sales',
      body: 'Sale activity on Main Street East in the recent period. Stats reflect closed transactions only.',
      stats: [
        { label: 'Recent sales', value: '21' },
        { label: 'Typical sold', value: '$1.14M' },
        { label: 'Days on market', value: '21' },
      ],
    },
    leases: {
      title: 'Leases',
      body: 'Rental activity on Main Street East across recent months. Breakdown by bed count below.',
      stats: [
        { label: 'Recent leases', value: '223' },
        { label: 'Typical rent', value: '$2,650' },
        { label: 'Days on market', value: '14' },
      ],
    },
    priceChart: {
      data: SALE_CHART,
      caption: 'Typical sold price across all product types on Main Street East, plotted with transaction volume.',
    },
    rentByBeds: [
      { label: '1 bed', value: '$2,100', detail: 'typical' },
      { label: '2 bed', value: '$2,650', detail: 'typical' },
      { label: '3 bed', value: '$3,200', detail: 'typical' },
      { label: '4+ bed', value: '$3,800', detail: 'typical' },
    ],
  },

  soldRecords: {
    caption: 'Recent closed sales, Main Street East',
    canSee: false,
    signinHref: '/signin?redirect=/streets/main-street-east-milton&intent=sold&street=main-street-east-milton',
    records: [
      { mlsNumber: 'W1', date: '2025-03-14', address: '142 Main Street East', beds: 4, soldPrice: 1_310_000, soldToAsk: 0.98, dom: 12, brokerage: 'Royal LePage Meadowtowne' },
      { mlsNumber: 'W2', date: '2025-02-02', address: '88 Main Street East', beds: 3, soldPrice: 1_055_000, soldToAsk: 1.02, dom: 9, brokerage: 'RE/MAX Aboutowne' },
      { mlsNumber: 'W3', date: '2025-01-19', address: '210 Main Street East', beds: 4, soldPrice: 1_480_000, soldToAsk: 0.97, dom: 22, brokerage: 'Keller Williams Edge' },
    ],
  },

  commute: [
    {
      id: 'transit',
      title: 'Transit & highways',
      subtitle: 'Milton GO, 401, and major routes',
      icon: 'transit',
      destinations: [
        { name: 'Milton GO Station', primaryTime: '6 min drive', secondaryTime: '18 min walk' },
        { name: 'Highway 401 on-ramp', primaryTime: '5 min drive' },
        { name: 'Union Station (GO)', primaryTime: '58 min transit' },
      ],
    },
    {
      id: 'schools',
      title: 'Schools',
      subtitle: 'Public and Catholic boards',
      icon: 'schools',
      destinations: [
        { name: 'Martin Street PS', primaryTime: '8 min walk' },
        { name: 'Bishop Reding CSS', primaryTime: '7 min drive' },
      ],
    },
    {
      id: 'health',
      title: 'Health',
      subtitle: 'Hospital and nearby care',
      icon: 'health',
      destinations: [{ name: 'Milton District Hospital', primaryTime: '6 min drive' }],
    },
    {
      id: 'shopping',
      title: 'Shopping & groceries',
      subtitle: 'Plazas, grocers, and big-box',
      icon: 'shopping',
      destinations: [
        { name: 'Sobeys Milton', primaryTime: '4 min drive' },
        { name: 'Milton Mall', primaryTime: '6 min drive' },
      ],
    },
  ],

  activeListings: [
    {
      mlsNumber: 'W5051001',
      address: '156 Main Street East',
      price: 1_249_000,
      bedrooms: 4,
      bathrooms: 3,
      parking: 4,
      propertyType: 'Detached',
      daysOnMarket: 8,
      href: '/listings/W5051001',
    },
    {
      mlsNumber: 'W5051002',
      address: '92 Main Street East',
      price: 899_000,
      bedrooms: 3,
      bathrooms: 2,
      parking: 1,
      propertyType: 'Townhouse',
      daysOnMarket: 21,
      href: '/listings/W5051002',
    },
  ],

  context: {
    similarStreets: [
      { slug: 'commercial-street-milton', name: 'Commercial Street', avgPrice: 1_210_000, count: 4 },
      { slug: 'mary-street-milton', name: 'Mary Street', avgPrice: 1_060_000, count: 3 },
      { slug: 'bronte-street-south-milton', name: 'Bronte Street South', avgPrice: 1_080_000, count: 5 },
    ],
    neighbourhoods: [{ slug: 'old-milton', name: 'Old Milton', summary: 'The historic core — mature lots, walkability, century stock.' }],
    schools: [
      { slug: 'martin-street-ps', name: 'Martin Street PS', board: 'HDSB', level: 'Elementary' },
      { slug: 'bishop-reding-css', name: 'Bishop Reding CSS', board: 'HCDSB', level: 'Secondary' },
    ],
  },

  faqs: [
    {
      question: 'What is the typical price on Main Street East?',
      answer:
        'The typical sold price on Main Street East over the trailing year is around $1.14M, ranging from roughly $805K to $1.55M depending on lot size and whether the home is detached or a townhome.',
    },
    {
      question: 'How fast do homes sell on Main Street East?',
      answer: 'Typical days on market is around 21 days, a touch faster than the Milton median.',
    },
  ],

  finalCtas: {
    seller: {
      eyebrow: 'For owners',
      headline: 'Selling on Main St E',
      body: 'A thoughtful conversation grounded in every sale we have tracked on Main Street East.',
      actionLabel: 'Request a valuation',
      actionHref: '#valuation',
    },
    buyer: {
      eyebrow: 'For buyers',
      headline: 'Buying on Main St E',
      body: 'Private access to new and upcoming listings before they go public.',
      actionLabel: 'Set an alert',
      actionHref: '#alerts',
      secondary: true,
    },
  },

  lastUpdated: '2026-06-09T00:00:00.000Z',
};

// ── THIN / SUB-K street — every suppressible surface goes silent ──────────────
export const mockStreetThin: StreetV2Data = {
  slug: 'marigold-court-milton',
  name: 'Marigold Court',
  shortName: 'Marigold',
  eyebrow: 'Street Profile · Coates · Milton, ON',
  subtitle: 'A quiet residential court with thin recent sale activity — the read leans on what is publicly safe to show.',
  neighbourhoods: ['Coates'],

  hero: {
    stats: [
      { label: 'Housing mix', value: null, kind: 'text', textValue: 'Detached' },
      { label: 'Typical price', value: null, kind: 'price', silentNote: 'sample too small to publish' },
      { label: 'Transactions tracked', value: 3, kind: 'count' },
      { label: 'Active right now', value: 1, kind: 'count' },
    ],
    // per-type pills present but price-silent (count shows, price suppressed)
    salePills: [
      { type: 'detached', displayName: 'Detached', count: 3, typicalPrice: null, priceLabel: 'sample too small', anchor: '#type-detached' },
    ],
    leasePills: [], // leased_count < k -> no lease pills at all
  },

  placeholder: false,
  ownerCtaPrice: null, // no publishable typical -> inline owner CTA hidden
  sections: [
    {
      id: 'about',
      heading: 'About Marigold Court',
      paragraphs: [
        'Marigold Court is a short detached court in the Coates neighbourhood. Resale activity here is thin, so this profile stays with what is grounded — the street pattern, the surroundings, and the handful of homes currently on or recently off the market — rather than a price the data cannot support.',
      ],
    },
    {
      id: 'market',
      heading: 'The market',
      paragraphs: [
        'Fewer than five homes have closed on Marigold Court in the trailing year, so a typical price cannot be published without effectively naming a specific sale. The record pages below show what is registered; for a grounded read, a private valuation is the right path.',
      ],
    },
  ],

  sidebar: {
    facts: [
      { label: 'Neighbourhood', value: 'Coates' },
      // NO typical price / price band facts — suppressed upstream (below k)
      { label: 'Transactions tracked', value: '3' },
    ],
    nearby: [
      { category: 'Grocery', name: 'FreshCo Coates', distance: '5 min drive', icon: '🛒' },
      { category: 'GO Station', name: 'Milton GO', distance: '9 min drive', icon: '🚆' },
      { category: 'School', name: 'Boyne PS', distance: '6 min walk', icon: '🏫' },
    ],
    cta: {
      eyebrow: 'For Marigold owners',
      headline: 'What is yours worth today?',
      body: 'A short conversation grounded in every sale we have tracked near Marigold Court.',
      actionLabel: 'Request a valuation',
      actionHref: '#valuation',
      trustLine: 'Complimentary · Response within one hour',
    },
  },

  productTypes: [
    {
      type: 'detached',
      displayName: 'Detached',
      intro: 'Detached inventory on Marigold Court has thin recent sale history.',
      salesCount: 3,
      typicalPrice: null, // silent
      priceBand: null, // silent
      dom: null, // silent
      soldToAsk: null, // silent
      activeCount: 1,
      activeAvgList: 1_020_000,
      chart: null, // suppressed (k<5)
      contactTeamPrompt: true, // 0 < 3 < 5
    },
  ],

  glance: [
    { label: 'Transactions tracked', value: '3', detail: 'recent activity' },
    { label: 'Typical sold', value: null, silentNote: 'under publish threshold' },
    { label: 'Typical DOM', value: null, silentNote: '—' },
    { label: 'Sold to ask', value: null, silentNote: '—' },
    { label: 'Detached sold', value: '3', detail: '3 transactions' },
    { label: 'Sale range', value: null, silentNote: 'under publish threshold' },
    { label: 'Active right now', value: '1', detail: 'live listings' },
    { label: 'Trend', value: null, silentNote: '—' },
    { label: 'Market state', value: 'Balanced', detail: 'per current activity' },
    { label: 'Activity', value: '1', detail: 'recent window' },
    { label: 'Leases (12m)', value: '0', detail: 'closed' },
    { label: 'Lowest sold', value: null, silentNote: 'under publish threshold' },
  ],

  market: {
    sales: {
      title: 'Sales',
      body: 'No publishable typical for Marigold Court in the recent period — too few closed sales to show a figure without identifying a home.',
      stats: [
        { label: 'Recent sales', value: '3' },
        { label: 'Typical sold', value: null }, // silent
        { label: 'Days on market', value: null }, // silent
      ],
    },
    leases: null, // no lease activity
    priceChart: null, // suppressed
    rentByBeds: null, // suppressed
  },

  soldRecords: {
    caption: 'Recent closed sales, Marigold Court',
    canSee: false,
    signinHref: '/signin?redirect=/streets/marigold-court-milton&intent=sold&street=marigold-court-milton',
    records: [
      // present but blurred behind the gate; addresses still PII-safe street-level
      { mlsNumber: 'M1', date: '2025-01-10', address: '14 Marigold Court', beds: 4, soldPrice: 1_010_000, soldToAsk: 0.99, dom: 18, brokerage: 'Royal LePage Meadowtowne' },
      { mlsNumber: 'M2', date: '2024-11-22', address: '9 Marigold Court', beds: 3, soldPrice: 965_000, soldToAsk: 1.0, dom: 25, brokerage: 'RE/MAX Aboutowne' },
    ],
  },

  commute: [
    {
      id: 'transit',
      title: 'Transit & highways',
      subtitle: 'Milton GO, 401, and major routes',
      icon: 'transit',
      destinations: [
        { name: 'Milton GO Station', primaryTime: '9 min drive' },
        { name: 'Highway 401 on-ramp', primaryTime: '6 min drive' },
      ],
    },
    {
      id: 'schools',
      title: 'Schools',
      subtitle: 'Public and Catholic boards',
      icon: 'schools',
      destinations: [{ name: 'Boyne PS', primaryTime: '6 min walk' }],
    },
  ],

  activeListings: [
    {
      mlsNumber: 'W5052001',
      address: '11 Marigold Court',
      price: 1_019_000,
      bedrooms: 4,
      bathrooms: 3,
      parking: 2,
      propertyType: 'Detached',
      daysOnMarket: 14,
      href: '/listings/W5052001',
    },
  ],

  context: {
    similarStreets: [{ slug: 'coxe-boulevard-milton', name: 'Coxe Boulevard', avgPrice: 1_040_000, count: 2 }],
    neighbourhoods: [{ slug: 'coates', name: 'Coates', summary: 'Newer-growth Milton — family stock, schools, parks.' }],
    schools: [{ slug: 'boyne-ps', name: 'Boyne PS', board: 'HDSB', level: 'Elementary' }],
  },

  faqs: [
    {
      question: 'What is the typical price on Marigold Court?',
      answer: 'Sale activity on Marigold Court has been limited recently, so a typical price cannot be stated with confidence. Contact our team for a private read.',
    },
  ],

  finalCtas: {
    seller: {
      eyebrow: 'For owners',
      headline: 'Selling on Marigold',
      body: 'A thoughtful conversation grounded in every sale we have tracked near Marigold Court.',
      actionLabel: 'Request a valuation',
      actionHref: '#valuation',
    },
    buyer: {
      eyebrow: 'For buyers',
      headline: 'Buying on Marigold',
      body: 'Private access to new and upcoming listings before they go public.',
      actionLabel: 'Set an alert',
      actionHref: '#alerts',
      secondary: true,
    },
  },

  lastUpdated: '2026-06-09T00:00:00.000Z',
};

export const mockStreets: Record<string, StreetV2Data> = {
  'main-street-east-milton': mockStreetRich,
  'marigold-court-milton': mockStreetThin,
};

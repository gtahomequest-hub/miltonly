// src/components/street/v2/mockData.ts
// Two fixtures to exercise the shell standalone (/streets-v2-preview, noindex). `rich` is a
// street with generated prose and active listings; `thin` is one with a single listing and a
// short profile. MC-046 Stage 1: the fixtures carry no sold or leased figure, count or claim,
// because the shell no longer has anywhere to render one and the preview is a public URL.
import type { StreetV2Data } from './types';

export const mockStreetRich: StreetV2Data = {
  slug: 'main-street-east-milton',
  name: 'Main Street East',
  shortName: 'Main St E',
  eyebrow: 'Street Profile · Old Milton · Milton, ON',
  subtitle:
    'A central spine of Old Milton where detached century homes meet walk-to-downtown convenience.',
  neighbourhoods: ['Old Milton'],

  hero: {
    stats: [
      { label: 'Active right now', value: 5, kind: 'count', sub: 'live listings · today' },
      { label: 'Housing mix', value: null, kind: 'text', textValue: 'Detached', sub: 'detached · town' },
    ],
  },

  placeholder: false,
  sections: [
    {
      id: 'about',
      heading: 'About Main Street East',
      paragraphs: [
        'Main Street East runs through the heart of Old Milton, where the town began. The housing stock is a deliberate blend — century-old detached homes on deep lots sit alongside infill townhomes, and the walk to the downtown core is measured in minutes rather than kilometres.',
      ],
    },
    {
      id: 'homes',
      heading: 'The homes',
      paragraphs: [
        'Detached homes make up most of the street, with a band of townhomes beside them. Lot depth is the quiet differentiator; the east side carries the largest parcels.',
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
    ],
    nearby: [
      { category: 'Grocery', name: 'Sobeys Milton', distance: '4 min drive', icon: '🛒' },
      { category: 'GO Station', name: 'Milton GO', distance: '6 min drive', icon: '🚆' },
      { category: 'School', name: 'Martin Street PS', distance: '8 min walk', icon: '🏫' },
      { category: 'Mosque', name: 'Milton Islamic Centre', distance: '7 min drive', icon: '🕌' },
    ],
    geometry: {
      identity: 'main||street',
      facts: [
        { key: 'length', label: 'Length', value: '1.2 km' },
        { key: 'category', label: 'Road class', value: 'Collector road' },
        { key: 'speed', label: 'Posted limit', value: '50 km/h' },
      ],
      attribution: 'Contains information licensed under the Open Government Licence – Milton.',
    },
    cta: {
      eyebrow: 'For Main St E owners',
      headline: 'What is yours worth today?',
      body: 'A short, private conversation about your home on Main Street East.',
      actionLabel: 'Request a valuation',
      actionHref: '/sell',
      trustLine: 'Complimentary. No obligation.',
    },
  },

  productTypes: [
    {
      type: 'detached',
      displayName: 'Detached',
      intro: '3 detached homes are listed for sale on Main Street East now.',
      active: '3',
      activeDetail: 'avg asking $1.24M',
    },
    {
      type: 'townhouse',
      displayName: 'Townhouse',
      intro: '2 townhouse homes are listed for sale on Main Street East now.',
      active: '2',
      activeDetail: 'avg asking $915K',
    },
  ],

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

  // The address ladder is sourced from the Town projection at request time, not mocked: a
  // fabricated civic address is a fabricated municipal fact. null renders no section.
  addresses: null,
  activeListings: [
    {
      mlsNumber: 'W5051001',
      address: '156 Main Street East',
      price: 1_249_000,
      bedrooms: 4,
      bathrooms: 3,
      parking: 4,
      propertyType: 'Detached',
      listOfficeName: 'RE/MAX REALTY SPECIALISTS INC.',
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
      listOfficeName: 'RE/MAX REALTY SPECIALISTS INC.',
      href: '/listings/W5051002',
    },
  ],

  context: {
    similarStreets: [
      { slug: 'commercial-street-milton', name: 'Commercial Street', avgPrice: 1_210_000, count: 4 },
      { slug: 'mary-street-milton', name: 'Mary Street', avgPrice: 1_060_000, count: 3 },
      { slug: 'bronte-street-south-milton', name: 'Bronte Street South', avgPrice: 1_080_000, count: 5 },
    ],
    connectedStreets: [
      { slug: 'commercial-street-milton', name: 'Commercial Street' },
      { slug: 'martin-street-milton', name: 'Martin Street' },
    ],
    neighbourhoods: [{ slug: 'old-milton', name: 'Old Milton', summary: 'The historic core — mature lots, walkability, century stock.' }],
    schools: [
      { slug: 'martin-street-ps', name: 'Martin Street PS', board: 'HDSB', level: 'Elementary' },
      { slug: 'bishop-reding-css', name: 'Bishop Reding CSS', board: 'HCDSB', level: 'Secondary' },
    ],
  },

  faqs: [
    {
      question: 'How walkable is Main Street East?',
      answer: 'The downtown core, the library and the GO station are all within a short walk.',
    },
  ],

  finalCtas: {
    seller: {
      eyebrow: 'For owners',
      headline: 'Selling on Main St E',
      body: 'A private conversation about your home on Main Street East and what is listed around it, before you decide anything.',
      actionLabel: 'Request a valuation',
      actionHref: '/sell',
    },
    buyer: {
      eyebrow: 'For buyers',
      headline: 'Buying on Main St E',
      body: 'An email when a home on the street is listed for sale. Nothing else, and no account.',
      actionLabel: 'Set an alert',
      actionHref: '/listings',
      secondary: true,
    },
  },

  areaContext: null,
  video: null,
  lastUpdated: '2026-06-09T00:00:00.000Z',
};

// ── THIN street: one listing, a short profile ──────────────────────────────────
export const mockStreetThin: StreetV2Data = {
  slug: 'marigold-court-milton',
  name: 'Marigold Court',
  shortName: 'Marigold',
  eyebrow: 'Street Profile · Coates · Milton, ON',
  subtitle: 'A quiet residential court in Coates.',
  neighbourhoods: ['Coates'],

  hero: {
    stats: [
      { label: 'Active right now', value: 1, kind: 'count', sub: 'live listings · today' },
      { label: 'Housing mix', value: null, kind: 'text', textValue: 'Detached', sub: 'detached' },
    ],
  },

  placeholder: false,
  sections: [
    {
      id: 'about',
      heading: 'About Marigold Court',
      paragraphs: [
        'Marigold Court is a short detached court in the Coates neighbourhood, a few minutes from its schools and parks.',
      ],
    },
  ],

  sidebar: {
    facts: [
      { label: 'Neighbourhood', value: 'Coates' },
    ],
    nearby: [
      { category: 'Grocery', name: 'FreshCo Coates', distance: '5 min drive', icon: '🛒' },
      { category: 'GO Station', name: 'Milton GO', distance: '9 min drive', icon: '🚆' },
      { category: 'School', name: 'Boyne PS', distance: '6 min walk', icon: '🏫' },
    ],
    geometry: null,
    cta: {
      eyebrow: 'For Marigold owners',
      headline: 'What is yours worth today?',
      body: 'A short, private conversation about your home on Marigold Court.',
      actionLabel: 'Request a valuation',
      actionHref: '/sell',
      trustLine: 'Complimentary. No obligation.',
    },
  },

  productTypes: [
    {
      type: 'detached',
      displayName: 'Detached',
      intro: 'One detached home is listed for sale on Marigold Court now.',
      active: '1',
      activeDetail: 'avg asking $1.02M',
    },
  ],

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

  // The address ladder is sourced from the Town projection at request time, not mocked: a
  // fabricated civic address is a fabricated municipal fact. null renders no section.
  addresses: null,
  activeListings: [
    {
      mlsNumber: 'W5052001',
      address: '11 Marigold Court',
      price: 1_019_000,
      bedrooms: 4,
      bathrooms: 3,
      parking: 2,
      propertyType: 'Detached',
      listOfficeName: 'RE/MAX REALTY SPECIALISTS INC.',
      href: '/listings/W5052001',
    },
  ],

  context: {
    similarStreets: [{ slug: 'coxe-boulevard-milton', name: 'Coxe Boulevard', avgPrice: 1_040_000, count: 2 }],
    connectedStreets: [{ slug: 'coxe-boulevard-milton', name: 'Coxe Boulevard' }],
    neighbourhoods: [{ slug: 'coates', name: 'Coates', summary: 'Newer-growth Milton — family stock, schools, parks.' }],
    schools: [{ slug: 'boyne-ps', name: 'Boyne PS', board: 'HDSB', level: 'Elementary' }],
  },

  faqs: [],

  finalCtas: {
    seller: {
      eyebrow: 'For owners',
      headline: 'Selling on Marigold',
      body: 'A private conversation about your home on Marigold Court and what is listed around it, before you decide anything.',
      actionLabel: 'Request a valuation',
      actionHref: '/sell',
    },
    buyer: {
      eyebrow: 'For buyers',
      headline: 'Buying on Marigold',
      body: 'An email when a home on the street is listed for sale. Nothing else, and no account.',
      actionLabel: 'Set an alert',
      actionHref: '/listings',
      secondary: true,
    },
  },

  areaContext: null,
  video: null,
  lastUpdated: '2026-06-09T00:00:00.000Z',
};

export const mockStreets: Record<string, StreetV2Data> = {
  'main-street-east-milton': mockStreetRich,
  'marigold-court-milton': mockStreetThin,
};

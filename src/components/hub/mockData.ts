// src/components/hub/mockData.ts
// Mirrors HubData so the hub page renders with zero backend.
// Data window replaces with getHubData(slug): Promise<HubData | null>.
import type { HubData } from './types';

export const mockHubUrban: HubData = {
  slug: 'dempsey',
  name: 'Dempsey',
  profile: 'urban',
  character:
    'An established central pocket — detached-led, mature trees, and a walkable line straight into downtown Milton. One of the most consistently traded neighbourhoods in the city.',
  intents: [
    { key: 'buy', label: "I'm buying", sub: 'See streets & listings here', href: '/neighbourhoods/dempsey/streets' },
    { key: 'sell', label: "I'm selling", sub: 'What my Dempsey home is worth', href: '/sell' },
    { key: 'rent', label: "I'm renting", sub: 'Lease listings in Dempsey', href: '/rentals' },
    { key: 'invest', label: "I'm investing", sub: 'Yield & investor read', href: '/build-wealth' },
  ],
  stats: { typicalPrice: 1_150_000, sold12mo: 96, onMarket: 14, dom: 21 },
  atAGlance: {
    priceRange: '$845K – $1.45M',
    dominantType: 'Detached & semis',
    suits: ['Families', 'Move-up buyers'],
    commute: '6 min to Milton GO · ~50 min to Union',
    schools: 'Strong public + Catholic options',
  },
  overview: [
    'Dempsey sits just east of downtown, close enough to walk to Main Street yet quiet enough to feel residential. The housing stock leans detached and semi-detached, much of it from the neighbourhood\u2019s established build-out, with mature lots that command a premium over Milton\u2019s newer-growth areas.',
    'Demand here is steady rather than speculative: buyers are typically move-up families drawn by lot size, the school catchment, and the short hop to the GO station. Inventory rarely sits long, and pricing has held firmer than the Milton average through softer stretches.',
  ],
  marketCompare: [
    { metricLabel: 'Typical price', neighbourhoodValue: '$1.15M', miltonValue: '$1.09M', delta: '+6% vs Milton' },
    { metricLabel: 'Median days on market', neighbourhoodValue: '21', miltonValue: '24', delta: '3 days faster' },
    { metricLabel: 'Sold · 12 months', neighbourhoodValue: '96', miltonValue: '\u2014', delta: 'high turnover' },
  ],
  commentary: {
    paragraphs: [
      'Over the trailing year Dempsey has traded around $1,150,000 \u2014 a premium to the Milton-wide $1,090,000, reflecting its detached-heavy stock and central position. Activity stays brisk, with homes moving a few days faster than the city median.',
      'The pattern points to a neighbourhood where established demand outpaces a constrained supply of larger lots.',
    ],
    source: 'Grounded in trailing-12-month TREB sold data \u00b7 updated continuously',
  },
  streets: [
    { name: 'Bronte Street South', slug: 'bronte-street-south', soldCount: 18, typicalPriceRounded: 1_080_000, signal: 'Most active' },
    { name: 'Commercial Street', slug: 'commercial-street', soldCount: 11, typicalPriceRounded: 1_210_000 },
    { name: 'Fulton Street', slug: 'fulton-street', soldCount: 9, typicalPriceRounded: 1_140_000 },
    { name: 'Mary Street', slug: 'mary-street', soldCount: 7, typicalPriceRounded: 1_060_000 },
    { name: 'Wilson Drive', slug: 'wilson-drive', soldCount: 6, typicalPriceRounded: 985_000 },
    { name: 'Pearl Street', slug: 'pearl-street', soldCount: 5, typicalPriceRounded: 1_300_000, signal: 'Top sold' },
  ],
  streetCount: 28,
  vipStreets: [
    { name: 'Bronte Street South', slug: 'bronte-street-south', soldCount: 18 },
    { name: 'Commercial Street', slug: 'commercial-street', soldCount: 11 },
    { name: 'Fulton Street', slug: 'fulton-street', soldCount: 9 },
    { name: 'Pearl Street', slug: 'pearl-street', soldCount: 5 },
  ],
  condos: [
    { name: 'Bronte Mill Lofts', slug: 'bronte-mill-lofts', meta: '32 units · est. ~$640K' },
    { name: 'Main & Martin', slug: 'main-and-martin', meta: '48 units · est. ~$580K' },
  ],
  faqs: [
    {
      question: 'How much are homes in Dempsey?',
      answer:
        'The typical Dempsey home has traded around $1,150,000 over the past year, with most sales falling between roughly $845K and $1.45M depending on lot size and whether the home is detached or semi-detached.',
    },
    {
      question: 'Is Dempsey a good place to live?',
      answer:
        'Dempsey is popular with families for its mature lots, walkability to downtown Milton, and proximity to the GO station. It is an established, residential-feeling area rather than a newer-growth subdivision.',
    },
    {
      question: 'What is the commute like from Dempsey?',
      answer:
        'Milton GO is about a 6-minute drive, putting Union Station roughly 50 minutes away by train. Highway 401 access is a short drive north.',
    },
  ],
  siblings: [
    { name: 'Timberlea', slug: 'timberlea', character: 'Mature, mixed stock, generous tree cover.', typicalPriceRounded: 1_010_000 },
    { name: 'Bronte Meadows', slug: 'bronte-meadows', character: 'Quiet established crescents near the creek.', typicalPriceRounded: 1_050_000 },
    { name: 'Clarke', slug: 'clarke', character: 'Townhome-rich and well-connected to transit.', typicalPriceRounded: 845_000 },
  ],
  ctaBuyer: {
    heading: `Looking in ${'Dempsey'}?`,
    body: 'Start with the streets above for the deepest local read, then see what is active right now.',
    buttonLabel: 'See Dempsey streets',
    href: '/neighbourhoods/dempsey/streets',
  },
  ctaSeller: {
    heading: 'Own in Dempsey?',
    body: 'Get a grounded valuation built on real Dempsey comparables, not a generic estimate.',
    buttonLabel: 'Value my home',
    href: '/sell',
  },
};

// Rural example — swap to preview the character-led mode (no VIP, silent stats).
export const mockHubRural: HubData = {
  slug: 'moffat',
  name: 'Moffat',
  profile: 'rural',
  character:
    'Open countryside on Milton\u2019s western edge \u2014 acreage, hamlet quiet, and a pace measured in seasons rather than days on market.',
  intents: [
    { key: 'buy', label: "I'm buying", sub: 'Browse Moffat road pages', href: '/neighbourhoods/moffat/streets' },
    { key: 'sell', label: "I'm selling", sub: 'Rural valuation, human-read', href: '/sell' },
    { key: 'rent', label: "I'm renting", sub: 'Rural lease listings', href: '/rentals' },
    { key: 'invest', label: "I'm investing", sub: 'Land & acreage read', href: '/build-wealth' },
  ],
  stats: { typicalPrice: null, sold12mo: null, onMarket: 3, dom: null },
  atAGlance: {
    priceRange: null,
    dominantType: 'Rural & acreage',
    suits: ['Acreage buyers', 'Hobby farms'],
    commute: 'Car-dependent · ~15 min to Milton core',
    schools: 'Rural catchment · bus service',
  },
  overview: [
    'Moffat is countryside first and neighbourhood second. Properties trade infrequently and vary enormously \u2014 from working acreage to country estates \u2014 so a single \u201ctypical price\u201d would mislead more than it informs. The read here is about character and land, not comparables.',
    'For specifics, the individual road pages carry what the aggregate cannot.',
  ],
  marketCompare: [],
  commentary: {
    paragraphs: [
      'Activity in Moffat is too thin to state a meaningful typical price \u2014 a handful of varied rural transactions a year rather than a liquid market. Where numbers would mislead, we stay silent and point to the road-level detail instead.',
    ],
    source: 'Grounded in trailing-12-month TREB sold data \u00b7 thin-activity rural area',
  },
  streets: [
    { name: 'Fourth Line', slug: 'fourth-line', soldCount: 2, typicalPriceRounded: null },
    { name: 'Guelph Line', slug: 'guelph-line', soldCount: null, typicalPriceRounded: null },
    { name: 'Moffat Road', slug: 'moffat-road', soldCount: 1, typicalPriceRounded: null },
  ],
  streetCount: 9,
  vipStreets: [],
  condos: [],
  faqs: [
    {
      question: 'What is Moffat like?',
      answer:
        'Moffat is a rural hamlet area on the western edge of Milton, characterised by acreage, country properties, and very low transaction volume. It suits buyers seeking land and quiet over walkability or amenities.',
    },
  ],
  siblings: [
    { name: 'Campbellville', slug: 'campbellville', character: 'Hamlet character, escarpment-edge.', typicalPriceRounded: 1_460_000 },
    { name: 'Nassagaweya', slug: 'nassagaweya', character: 'Agricultural, large lots, established.', typicalPriceRounded: 1_720_000 },
  ],
  ctaBuyer: {
    heading: 'Looking in rural Milton?',
    body: 'Rural properties reward patience. Browse the road pages for the detail the aggregate can\u2019t show.',
    buttonLabel: 'See Moffat roads',
    href: '/neighbourhoods/moffat/streets',
  },
  ctaSeller: {
    heading: 'Own land in Moffat?',
    body: 'Rural valuations need a human read, not an algorithm. Let\u2019s talk specifics.',
    buttonLabel: 'Request a valuation',
    href: '/sell',
  },
};

export const mockHubData = mockHubUrban;
export default mockHubData;

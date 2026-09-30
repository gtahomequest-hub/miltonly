// src/components/hub/mockData.ts
// Mirrors HubData so the hub page renders with zero backend (the /hub-preview route).
// MC-046 Stage 1: the fixture carries no sold-shaped value either (no typical, no sale count,
// no days on market, no market commentary), so the preview renders what a real hub renders.
import type { HubData } from './types';

export const mockHubUrban: HubData = {
  slug: 'dempsey',
  name: 'Dempsey',
  profile: 'urban',
  character:
    'An established central pocket: detached-led, mature trees, and a walkable line straight into downtown Milton.',
  intents: [
    { key: 'buy', label: "I'm buying", sub: '14 homes for sale here today', href: '/listings' },
    { key: 'sell', label: "I'm selling", sub: 'What a Dempsey home is worth', href: '/value/dempsey' },
    { key: 'rent', label: "I'm renting", sub: 'Leases in Dempsey', href: '/rentals' },
    { key: 'invest', label: "I'm investing", sub: 'The sold record for Dempsey', href: '/sold?nbhd=dempsey' },
  ],
  stats: { onMarket: 14 },
  atAGlance: {
    // Shape only. On a real hub every one of these is derived and carries its own basis;
    // the fixture cannot compute one, so these are illustrative and the preview route is
    // the only thing that ever reads them.
    facts: [
      { key: 'pages', value: '23', label: 'streets with a page', basis: 'published street guides in this neighbourhood', href: '#streets' },
      { key: 'video', value: '4', label: 'streets filmed', basis: 'driven end to end, day or overnight' },
      { key: 'schools', value: '2', label: 'schools inside the boundary', basis: 'Town of Milton neighbourhood boundary', href: '/schools' },
      { key: 'active', value: '14', label: 'homes for sale today', basis: 'advertised active listings in this neighbourhood', href: '/listings' },
    ],
  },
  overview: [
    'Dempsey sits just east of downtown, close enough to walk to Main Street yet quiet enough to feel residential. The housing stock leans detached and semi-detached, much of it from the neighbourhood’s established build-out, on mature lots.',
  ],
  marketCompare: [],
  commentary: { paragraphs: [], source: '' },
  streets: [
    { name: 'Bronte Street South', slug: 'bronte-street-south', activeCount: 3, signal: 'VIP street', hasVideo: false },
    { name: 'Commercial Street', slug: 'commercial-street', activeCount: 2, hasVideo: false },
    { name: 'Fulton Street', slug: 'fulton-street', activeCount: 2, hasVideo: false },
    { name: 'Mary Street', slug: 'mary-street', activeCount: 1, hasVideo: false },
    { name: 'Pearl Street', slug: 'pearl-street', activeCount: 0, hasVideo: false },
    { name: 'Wilson Drive', slug: 'wilson-drive', activeCount: 0, hasVideo: false },
  ],
  streetCount: 28,
  videoStreets: [],
  schools: [],
  vipStreets: [
    { name: 'Bronte Street South', slug: 'bronte-street-south' },
  ],
  condos: [
    { name: 'Bronte Mill Lofts', slug: 'bronte-mill-lofts' },
    { name: 'Main & Martin', slug: 'main-and-martin' },
  ],
  faqs: [
    {
      question: 'Is Dempsey a good place to live?',
      answer:
        'Dempsey is popular with families for its mature lots, walkability to downtown Milton, and proximity to the GO station. It is an established, residential-feeling area rather than a newer-growth subdivision.',
    },
  ],
  siblings: [
    { name: 'Timberlea', slug: 'timberlea', streetPages: 22, distanceKm: 1.4 },
    { name: 'Bronte Meadows', slug: 'bronte-meadows', streetPages: 8, distanceKm: 2.1 },
    { name: 'Clarke', slug: 'clarke', streetPages: 46, distanceKm: 2.6 },
  ],
  nearbyByDistance: true,
  ctaBuyer: {
    heading: 'Thinking of buying in Dempsey?',
    body: 'The street-by-street read above, and every live listing in Dempsey on one page.',
    buttonLabel: 'Listings in Dempsey',
    href: '/listings',
  },
  ctaSeller: {
    heading: 'Own a home in Dempsey?',
    body: 'A grounded valuation built on real Dempsey comparables: the number, then the strategy.',
    buttonLabel: 'Value my home',
    href: '/value/dempsey',
  },
};

// Rural example: swap to preview the character-led mode (no VIP).
export const mockHubRural: HubData = {
  slug: 'moffat',
  name: 'Moffat',
  profile: 'rural',
  character: 'Open countryside on Milton’s western edge: acreage and hamlet quiet.',
  intents: [
    { key: 'buy', label: "I'm buying", sub: 'Homes for sale in Moffat', href: '/listings' },
    { key: 'sell', label: "I'm selling", sub: 'What a Moffat home is worth', href: '/value/moffat' },
    { key: 'rent', label: "I'm renting", sub: 'Leases in Moffat', href: '/rentals' },
    { key: 'invest', label: "I'm investing", sub: 'The sold record for Moffat', href: '/sold?nbhd=moffat' },
  ],
  stats: { onMarket: 3 },
  atAGlance: {
    facts: [
      { key: 'pages', value: '11', label: 'streets with a page', basis: 'published street guides in this neighbourhood', href: '#streets' },
    ],
  },
  overview: [
    'Moffat is countryside first and neighbourhood second, from working acreage to country estates. The individual road pages carry the detail.',
  ],
  marketCompare: [],
  commentary: { paragraphs: [], source: '' },
  streets: [
    { name: 'Fourth Line', slug: 'fourth-line', activeCount: 1, hasVideo: false },
    { name: 'Guelph Line', slug: 'guelph-line', activeCount: 0, hasVideo: false },
    { name: 'Moffat Road', slug: 'moffat-road', activeCount: 0, hasVideo: false },
  ],
  streetCount: 9,
  videoStreets: [],
  schools: [],
  vipStreets: [],
  condos: [],
  faqs: [
    {
      question: 'What is Moffat like?',
      answer:
        'Moffat is a rural hamlet area on the western edge of Milton, characterised by acreage and country properties. It suits buyers seeking land and quiet over walkability or amenities.',
    },
  ],
  siblings: [
    { name: 'Campbellville', slug: 'campbellville', streetPages: 7, distanceKm: null },
    { name: 'Nassagaweya', slug: 'nassagaweya', streetPages: 11, distanceKm: null },
  ],
  nearbyByDistance: false,
  ctaBuyer: {
    heading: 'Looking in rural Milton?',
    body: 'Browse the road pages for the detail a neighbourhood page cannot show.',
    buttonLabel: 'Listings in Moffat',
    href: '/listings',
  },
  ctaSeller: {
    heading: 'Own land in Moffat?',
    body: 'Rural valuations need a human read, not an algorithm. Let’s talk specifics.',
    buttonLabel: 'Request a valuation',
    href: '/value/moffat',
  },
};

export const mockHubData = mockHubUrban;
export default mockHubData;

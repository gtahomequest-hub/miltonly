// src/components/condo/mockData.ts
// Mirrors CondoData. Data window replaces with getCondoData(slug): Promise<CondoData | null>.
// Two examples: a rich building (full data) and a thin one (graceful degradation).
// MC-046 Stage 1: no sold-shaped value in either fixture (no typical, no range, no bedroom
// table, no resale-history claims), so the preview renders what a real condo page renders.
import type { CondoData } from './types';

const intents = (slug: string): CondoData['intents'] => [
  { key: 'buy', label: "I'm buying", sub: 'See units for sale here', href: `/condos/${slug}#listings` },
  { key: 'sell', label: "I'm selling", sub: 'What my unit is worth', href: '/sell' },
  { key: 'rent', label: "I'm renting", sub: 'Lease listings in the building', href: `/condos/${slug}#listings` },
  { key: 'invest', label: "I'm investing", sub: 'Yield & rental rules', href: '/listings' },
];

export const mockCondoRich: CondoData = {
  slug: 'bronte-mill-lofts',
  name: 'Bronte Mill Lofts',
  address: '180 Mill Street, Milton, ON',
  character:
    'A boutique loft conversion on the edge of downtown: exposed brick, high ceilings, and Main Street close by.',
  neighbourhood: { name: 'Dempsey', slug: 'dempsey' },
  intents: intents('bronte-mill-lofts'),
  facts: { units: 32, storeys: 5, yearBuilt: 2008, developer: 'Heritage Mill Developments', propertyType: 'Condo apartment (loft)' },
  ownership: {
    monthlyFee: '~$0.64 / sq ft',
    feeIncludes: ['Heat', 'Water', 'Building insurance', '1 parking'],
  },
  overview: [
    'Bronte Mill Lofts occupies a converted mill: exposed brick, timber beams, and oversized windows.',
    'The location is the draw: a few minutes\u2019 walk to Main Street\u2019s restaurants and the Milton GO line, with the Mill Pond trails at the doorstep. It suits downsizers and professionals over investors, given the limited unit count.',
  ],
  listings: [
    { title: 'Unit 304 · 1 bed + den', meta: '1 bed · 1 bath · 740 sqft', price: '$619,000', listOfficeName: 'RE/MAX REALTY SPECIALISTS INC.', tenure: 'sale', href: '/listings/304-bronte-mill' },
    { title: 'Unit 210 · 2 bed', meta: '2 bed · 2 bath · 980 sqft', price: '$2,750/mo', listOfficeName: 'RE/MAX REALTY SPECIALISTS INC.', tenure: 'lease', href: '/listings/210-bronte-mill' },
  ],
  amenities: ['Concierge (part-time)', 'Visitor parking', 'Rooftop terrace', 'Bike storage', 'Party room'],
  rules: {
    pets: 'Permitted with size restrictions',
    rentals: 'Allowed, no minimum term',
    parking: '1 owned + visitor',
    locker: '1 included',
  },
  faqs: [
    { question: 'Is Bronte Mill Lofts pet-friendly?', answer: 'Yes, pets are permitted with reasonable size restrictions. Confirm specifics with building management before purchase.' },
  ],
  nearbyCondos: [
    { name: 'Main & Martin', slug: 'main-and-martin' },
    { name: 'Mill Pond Residences', slug: 'mill-pond-residences' },
  ],
  ctaBuyer: { heading: 'Interested in Bronte Mill Lofts?', body: 'Register to be alerted the moment a unit is listed.', buttonLabel: 'Get listing alerts', href: '/listings' },
  ctaSeller: { heading: 'Own a unit here?', body: 'Get a grounded valuation built on real Bronte Mill comparables.', buttonLabel: 'Value my unit', href: '/sell' },
};

// Thin building — most fields unknown. Shows the page holding together honestly.
export const mockCondoThin: CondoData = {
  slug: 'derry-green-tower-a',
  name: 'Derry Green Tower A',
  address: 'Derry Green Corporate Park, Milton, ON',
  character: 'A newer tower in Milton\u2019s southern growth corridor.',
  neighbourhood: { name: 'Derry Green', slug: 'derry-green' },
  intents: intents('derry-green-tower-a'),
  facts: { units: 210, storeys: 22, yearBuilt: null, developer: null, propertyType: 'Condo apartment' },
  ownership: {
    monthlyFee: null,
    feeIncludes: [],
    feeNote: 'Varies by suite. Confirm with the listing or management.',
  },
  overview: [
    'Derry Green Tower A is a recent addition to Milton\u2019s southern corridor, near the Derry Green corporate park and major highway access.',
  ],
  listings: [],
  amenities: [],
  rules: { pets: null, rentals: null, parking: null, locker: null },
  faqs: [],
  nearbyCondos: [],
  ctaBuyer: { heading: 'Watching Derry Green Tower A?', body: 'Register for alerts as units come up.', buttonLabel: 'Get alerts', href: '/listings' },
  ctaSeller: { heading: 'Own a unit here?', body: 'Early in a building\u2019s life, valuation needs a human read. Let\u2019s talk.', buttonLabel: 'Request a valuation', href: '/sell' },
};

export const mockCondoData = mockCondoRich;
export default mockCondoData;

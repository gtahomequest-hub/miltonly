// src/components/condo/mockData.ts
// Mirrors CondoData. Data window replaces with getCondoData(slug): Promise<CondoData | null>.
// Two examples: a rich building (full data) and a thin one (graceful degradation).
import type { CondoData } from './types';

const intents = (slug: string): CondoData['intents'] => [
  { key: 'buy', label: "I'm buying", sub: 'See units for sale here', href: `/condos/${slug}#listings` },
  { key: 'sell', label: "I'm selling", sub: 'What my unit is worth', href: '/sell' },
  { key: 'rent', label: "I'm renting", sub: 'Lease listings in the building', href: `/condos/${slug}#listings` },
  { key: 'invest', label: "I'm investing", sub: 'Yield & rental rules', href: '/build-wealth' },
];

export const mockCondoRich: CondoData = {
  slug: 'bronte-mill-lofts',
  name: 'Bronte Mill Lofts',
  address: '180 Mill Street, Milton, ON',
  character:
    'A boutique loft conversion on the edge of downtown — exposed brick, high ceilings, and a short walk to Main Street. Small building, tightly held.',
  neighbourhood: { name: 'Dempsey', slug: 'dempsey' },
  intents: intents('bronte-mill-lofts'),
  facts: { units: 32, storeys: 5, yearBuilt: 2008, developer: 'Heritage Mill Developments', propertyType: 'Condo apartment (loft)' },
  ownership: {
    typicalPrice: 640_000,
    priceRange: '$520K – $740K',
    maintenanceFee: '~$0.64 / sq ft',
    feeIncludes: ['Heat', 'Water', 'Building insurance', '1 parking'],
  },
  bedrooms: [
    { label: 'Studio', typicalPrice: 470_000, soldCount: 2 },
    { label: '1 bedroom', typicalPrice: 560_000, soldCount: 5 },
    { label: '1 bed + den', typicalPrice: 620_000, soldCount: 3 },
    { label: '2 bedroom', typicalPrice: 720_000, soldCount: 4 },
  ],
  overview: [
    'Bronte Mill Lofts occupies a converted 19th-century mill, giving it a character most Milton condos can\u2019t match — exposed brick, timber beams, and oversized windows. At 32 units across five storeys it stays intimate, and turnover is low.',
    'The location is the draw: a few minutes\u2019 walk to Main Street\u2019s restaurants and the Milton GO line, with the Mill Pond trails at the doorstep. It suits downsizers and professionals over investors, given the limited unit count.',
  ],
  listings: [
    { title: 'Unit 304 · 1 bed + den', meta: '1 bed · 1 bath · 740 sqft', price: '$619,000', tenure: 'sale', href: '/listings/304-bronte-mill' },
    { title: 'Unit 210 · 2 bed', meta: '2 bed · 2 bath · 980 sqft', price: '$2,750/mo', tenure: 'lease', href: '/listings/210-bronte-mill' },
  ],
  amenities: ['Concierge (part-time)', 'Visitor parking', 'Rooftop terrace', 'Bike storage', 'Party room'],
  rules: {
    pets: 'Permitted with size restrictions',
    rentals: 'Allowed — no minimum term',
    parking: '1 owned + visitor',
    locker: '1 included',
  },
  faqs: [
    { question: 'What are the maintenance fees at Bronte Mill Lofts?', answer: 'Fees run about $0.64 per square foot, covering heat, water, building insurance, and one parking spot. A 740 sqft unit lands near $475/month.' },
    { question: 'Is Bronte Mill Lofts pet-friendly?', answer: 'Yes — pets are permitted with reasonable size restrictions. Confirm specifics with building management before purchase.' },
    { question: 'Can you rent out a unit at Bronte Mill Lofts?', answer: 'Yes, rentals are permitted with no minimum lease term, which makes it workable for investors despite the small building size.' },
  ],
  nearbyCondos: [
    { name: 'Main & Martin', slug: 'main-and-martin', meta: '48 units · est. ~$580K' },
    { name: 'Mill Pond Residences', slug: 'mill-pond-residences', meta: '120 units · est. ~$610K' },
  ],
  ctaBuyer: { heading: 'Interested in Bronte Mill Lofts?', body: 'Units here move quietly. Register to be alerted the moment one is listed.', buttonLabel: 'Get listing alerts', href: '/buy' },
  ctaSeller: { heading: 'Own a unit here?', body: 'Get a grounded valuation built on real Bronte Mill comparables.', buttonLabel: 'Value my unit', href: '/sell' },
};

// Thin building — most fields unknown. Shows the page holding together honestly.
export const mockCondoThin: CondoData = {
  slug: 'derry-green-tower-a',
  name: 'Derry Green Tower A',
  address: 'Derry Green Corporate Park, Milton, ON',
  character: 'A newer tower in Milton\u2019s southern growth corridor. Limited resale history so far.',
  neighbourhood: { name: 'Derry Green', slug: 'derry-green' },
  intents: intents('derry-green-tower-a'),
  facts: { units: 210, storeys: 22, yearBuilt: null, developer: null, propertyType: 'Condo apartment' },
  ownership: {
    typicalPrice: null,
    priceRange: null,
    maintenanceFee: null,
    feeIncludes: [],
    feeNote: 'Too few resales to state — confirm with the listing or management.',
  },
  bedrooms: [],
  overview: [
    'Derry Green Tower A is a recent addition to Milton\u2019s southern corridor, near the Derry Green corporate park and major highway access. Because it\u2019s new, resale history is thin and reliable pricing isn\u2019t yet established.',
    'Where the data isn\u2019t there, we don\u2019t invent it — check active listings for current asking prices.',
  ],
  listings: [],
  amenities: [],
  rules: { pets: null, rentals: null, parking: null, locker: null },
  faqs: [
    { question: 'How much are units at Derry Green Tower A?', answer: 'There isn\u2019t enough resale history yet to state a reliable typical price. Active listings are the best current guide.' },
  ],
  nearbyCondos: [],
  ctaBuyer: { heading: 'Watching Derry Green Tower A?', body: 'Register for alerts as units and pricing data come available.', buttonLabel: 'Get alerts', href: '/buy' },
  ctaSeller: { heading: 'Own a unit here?', body: 'Early in a building\u2019s life, valuation needs a human read. Let\u2019s talk.', buttonLabel: 'Request a valuation', href: '/sell' },
};

export const mockCondoData = mockCondoRich;
export default mockCondoData;

// src/components/home/mockData.ts
// Mirrors the real HomepageData shape so the homepage renders with zero backend.
// The data window replaces this with getHomepageData(): Promise<HomepageData>.
import type { HomepageData } from './types';

export const mockHomepageData: HomepageData = {
  stats: { typicalPrice: 1_090_000, sold12mo: 412, onMarket: 87, dom: 24 },

  hero: {
    eyebrow: 'The definitive read on Milton real estate',
    headline: 'Milton,',
    headlineAccent: 'read closely.',
    lede: "Ask anything about the Milton market — or tell us what you're here to do.",
    askPlaceholder: 'I want to know what my home is worth…',
    askExamples: [
      'I need to sell in under 30 days…',
      'I need to sell and buy at the same time…',
      'I want a house close to a top school…',
      'Where in Milton can I build rental income…',
      "What's my home actually worth right now…",
    ],
    pills: [
      { key: 'wealth', label: 'Build wealth', mostAsked: true },
      { key: 'sell', label: "What's my home worth?" },
      { key: 'buy', label: 'Homes for sale' },
      { key: 'rent', label: 'Renting' },
    ],
  },

  trust: {
    rating: 4.9,
    reviewCount: 235,
    credentials: ['RE/MAX Hall of Fame', 'MLS-grounded data', 'Updated daily'],
    idx: '1809031',
    vow: '1848370',
  },

  commentary: {
    paragraphs: [
      'The typical Milton home has settled near $1,090,000 over the past year, with the pace easing from the spring’s tighter conditions. Detached stock holds firmest in the established central pockets, while newer-growth areas carry the bulk of current supply.',
      'Days on market sit around 24 — a measured rhythm, not an urgent one. The read below moves by neighbourhood, where the real differences live.',
    ],
    source: 'Grounded in trailing-12-month TREB sold data · updated continuously',
  },

  neighbourhoods: [
    {
      name: 'Dempsey',
      character: 'Established central pocket, detached-led, walkable to the core.',
      typicalPriceRounded: 1_150_000,
      slug: 'dempsey',
      group: 'urban',
    },
    {
      name: 'Willmott',
      character: 'Newer-growth, family-oriented, strong townhome supply.',
      typicalPriceRounded: 1_040_000,
      slug: 'willmott',
      group: 'urban',
    },
    {
      name: 'Clarke',
      character: 'Townhome-rich and well-connected to transit.',
      typicalPriceRounded: 845_000,
      slug: 'clarke',
      group: 'urban',
    },
    {
      name: 'Timberlea',
      character: 'Mature, mixed stock, generous tree cover.',
      typicalPriceRounded: 1_010_000,
      slug: 'timberlea',
      group: 'urban',
    },
    {
      name: 'Beaty',
      character: 'Family enclave near schools and parks.',
      typicalPriceRounded: 1_120_000,
      slug: 'beaty',
      group: 'urban',
    },
    {
      name: 'Scott',
      character: 'Newer detached on quiet crescents.',
      typicalPriceRounded: 1_180_000,
      slug: 'scott',
      group: 'urban',
    },
    {
      name: 'Moffat',
      character: 'Open countryside, acreage, quiet.',
      typicalPriceRounded: null,
      silentNote: 'typical price not stated — thin activity; see road pages',
      slug: 'moffat',
      group: 'rural',
    },
    {
      name: 'Campbellville',
      character: 'Hamlet character, escarpment-edge.',
      typicalPriceRounded: 1_460_000,
      slug: 'campbellville',
      group: 'rural',
    },
    {
      name: 'Nassagaweya',
      character: 'Agricultural, large lots, established.',
      typicalPriceRounded: 1_720_000,
      slug: 'nassagaweya',
      group: 'rural',
    },
  ],
  neighbourhoodCount: 24,

  vipStreets: [
    { name: 'Farmstead Drive', soldCount: 40, slug: 'farmstead-drive' },
    { name: 'Main Street East', soldCount: 68, slug: 'main-street-east' },
    { name: 'Savoline Boulevard', soldCount: 12, slug: 'savoline-boulevard' },
    { name: 'Asleton Boulevard', soldCount: 15, slug: 'asleton-boulevard' },
  ],
  streetCount: 900,

  mls: {
    defaultTab: 'wealth',
    lenses: [
      {
        key: 'wealth',
        tabLabel: 'Build wealth',
        badgeLabel: 'Active lens',
        badgePill: 'the tab nobody else has',
        headline: 'Where Milton capital compounds',
        description:
          "Not a listings grid — an investor's read on Milton: yield potential, multi-unit, pre-construction, and the neighbourhoods where the trend line points up.",
        chips: [
          { label: 'Highest est. yield' },
          { label: 'Multi-unit' },
          { label: 'Pre-construction' },
          { label: 'Appreciation trend' },
          { label: 'Compare yields', compare: true },
        ],
        listings: [
          { title: 'Triplex · Clarke', meta: '3 units · ~$1.2M', signal: '▲ est. gross yield ~5.1%' },
          { title: 'Pre-con · Derry Green', meta: '2027 occupancy', signal: '▲ growth corridor' },
          {
            title: 'Legal duplex · Timberlea',
            meta: '2 units · ~$1.05M',
            signal: '▲ est. gross yield ~4.7%',
          },
        ],
        vow: {
          text: 'Want the full investor pipeline?',
          sub: 'Register for VOW access — off-market and yield data.',
          buttonLabel: 'Unlock the pipeline',
        },
        compareRow:
          'lives here as a mode — stack two properties or neighbourhoods side by side on yield and trend.',
        vowNote:
          'The VOW register wall is the lead capture · yield figures grounded and rounded, framed as estimates, never per-listing precise.',
      },
      {
        key: 'buy',
        tabLabel: 'Buying',
        badgeLabel: 'Active lens',
        headline: 'Find the right street first',
        description:
          'Street-matched live listings, paired with the editorial read for that street. Authority first, then inventory — the listings everyone has, on the street guides only we have.',
        chips: [
          { label: 'By neighbourhood' },
          { label: 'By price band' },
          { label: 'Detached' },
          { label: 'Townhome' },
          { label: 'Compare streets', compare: true },
        ],
        listings: [
          { title: 'Farmstead Drive', meta: '3 active · full street guide', signal: 'read the street →' },
          { title: 'Main Street East', meta: '5 active · full street guide', signal: 'read the street →' },
          { title: 'Clarke area', meta: 'townhomes ~$845,000', signal: 'browse listings →' },
        ],
        vow: {
          text: 'See every active listing in Milton.',
          sub: 'Register for full MLS access.',
          buttonLabel: 'Browse all listings',
        },
      },
      {
        key: 'sell',
        tabLabel: 'Selling',
        badgeLabel: 'Active lens',
        headline: 'What your Milton home is worth',
        description:
          "A grounded valuation built on real comparable sales on your street and neighbourhood — not an algorithm's guess. The number, then the strategy.",
        chips: [
          { label: 'Enter your address' },
          { label: 'Recent comparables' },
          { label: 'Time-to-sell read' },
        ],
        vow: {
          text: "Get your home's grounded value.",
          sub: 'Built on real Milton sales, not a generic estimate.',
          buttonLabel: 'Value my home',
        },
      },
      {
        key: 'rent',
        tabLabel: 'Renting',
        badgeLabel: 'Active lens',
        headline: 'Milton lease, read straight',
        description:
          "Live lease stock drawn from 6,270 records — and the quiet bridge: today's renter is tomorrow's Build-Wealth lead, so the path upward is always one tab away.",
        chips: [{ label: 'By bedrooms' }, { label: 'By neighbourhood' }, { label: 'Lease range' }],
        vow: {
          text: 'See current lease listings.',
          sub: 'Register for the full lease feed.',
          buttonLabel: 'Browse rentals',
        },
      },
    ],
  },

  footer: {
    topNeighbourhoods: [
      { name: 'Dempsey', slug: 'dempsey' },
      { name: 'Willmott', slug: 'willmott' },
      { name: 'Clarke', slug: 'clarke' },
    ],
    topStreets: [
      { name: 'Farmstead Drive', slug: 'farmstead-drive' },
      { name: 'Main Street East', slug: 'main-street-east' },
    ],
    neighbourhoodCount: 24,
    streetCount: 900,
  },
};

export default mockHomepageData;

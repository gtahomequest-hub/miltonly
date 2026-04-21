# Street Page Master Template — Data Specification

**Purpose:** This document maps every piece of dynamic content on the Whitlock Avenue mockup to the data variable the production template consumes. It is the build spec for Claude Code when implementing `/src/app/streets/[slug]/page.tsx`.

**Architecture:** One template. Unbounded street coverage. Every Milton street that appears on MLS gets a generated page using this template automatically, with no manual intervention.

---

## 1. Route structure

**Next.js dynamic route:** `/src/app/streets/[slug]/page.tsx`

The `[slug]` parameter is a URL-safe street identifier:
- `whitlock-avenue` → Whitlock Avenue
- `lemieux-court` → Lemieux Court
- `main-street-east` → Main Street East
- `4th-line` → 4th Line

Slug generation rule (deterministic):
```typescript
function slugify(streetName: string): string {
  return streetName
    .toLowerCase()
    .replace(/\bst\b/g, 'street')
    .replace(/\bave\b/g, 'avenue')
    .replace(/\bdr\b/g, 'drive')
    .replace(/\brd\b/g, 'road')
    .replace(/\bct\b/g, 'court')
    .replace(/\bcres\b/g, 'crescent')
    .replace(/\bblvd\b/g, 'boulevard')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}
```

**Collision handling:** If two streets slugify to the same value (rare), append neighbourhood: `maple-street-cobban` vs `maple-street-old-milton`.

---

## 2. Data bundle the page consumes

Each street page fetches one complete data object from the database:

```typescript
interface StreetPageData {
  // Core identity
  street: {
    id: string;
    name: string;              // "Whitlock Avenue"
    slug: string;              // "whitlock-avenue"
    shortName: string;         // "Whitlock" — used in widget
    neighbourhoods: string[];  // ["Cobban", "Ford"] — 1+
    primaryBuilder?: string;   // "Mattamy Homes" — optional, only if high confidence
    characterSummary: string;  // 1-sentence synopsis for hero subtitle
    coordinates: { lat: number; lng: number };  // centroid
  };

  // Hero-level stats
  heroStats: {
    totalTransactions: number;         // 244
    typicalPrice: number;              // 986000
    priceRange: { low: number; high: number };  // 748000 / 1470000
    primaryHousingType: string;        // "Mixed" / "Townhouse" / "Condo" / etc.
    housingMixDescription: string;     // "condo · town · detached"
  };

  // Product type breakdown — drives pill matrix AND deep-link sections
  productTypes: ProductTypeData[];     // see interface below

  // Editorial description — AI-generated, cached in Neon
  description: {
    about: string;               // paragraph — "About {street.name}"
    homes: string;               // paragraph — "The homes on {street.shortName}"
    amenities: string;           // paragraph — "Living here: amenities and lifestyle"
    market: string;              // paragraph — "Market behaviour"
    gettingAround: string;       // paragraph — "Getting around"
    schools: string;             // paragraph — "Schools and families"
    bestFitFor: BestFitItem[];   // 3-5 bullets
    differentPriorities: DifferentPriorityItem[]; // 3-5 bullets
  };

  // Pattern detection — optional, only if auto-detected
  detectedPattern?: {
    headline: string;    // "Townhouse pricing has recalibrated..."
    body: string;        // supporting paragraph
  };

  // Sidebar data
  streetFacts: Record<string, string>;  // k/v pairs: "Composition": "Condo · Town · Detached"
  nearbyPlaces: NearbyPlace[];          // parks, schools, mosques, grocery, etc.

  // Chart series (quarterly)
  quarterlySeries: {
    [productType: string]: {
      sold: QuarterlyDataPoint[] | null;     // null if no sale data
      leased: QuarterlyDataPoint[] | null;   // null if no lease data
    };
  };

  // Aggregate overall series (for big market activity chart)
  overallSoldSeries: QuarterlyDataPoint[] | null;

  // At-a-glance data panel tiles (12 tiles)
  glanceTiles: GlanceTile[];

  // Commute data
  commuteDestinations: CommuteCategory[];  // 6 categories × 5-7 destinations each

  // Active inventory
  activeListings: Listing[];

  // Context cards
  similarStreets: StreetCard[];
  relatedSchools: School[];

  // FAQ (street-specific)
  faqs: FAQItem[];
}

interface ProductTypeData {
  type: 'detached' | 'semi' | 'townhouse' | 'condo' | 'link' | 'freehold-townhouse';
  displayName: string;          // "Detached" / "Semi" / "Townhouse" / "Condo"
  hasData: boolean;             // false hides the type entirely

  // Pill data (shown on hero pills)
  soldPill?: { count: number; typicalPrice: number };
  leasedPill?: { count: number; typicalRent: number };

  // Deep-link section data (shown if hasData === true)
  section?: {
    intro: string;                          // AI-generated
    statsSold: StatCell[];                  // 4-6 cells
    statsLeased?: StatCell[];               // 4-6 cells — omit if no lease data
    chartSold?: { headline: string; note: string; trendLabel: string };
    chartLeased?: { headline: string; note: string; trendLabel: string };
    noDataMessage?: string;                 // shown when that slice is empty
    inlineCtaCopy: { strong: string; body: string };
  };
}
```

**Conditional rendering rules:**
- If `productTypes[x].hasData === false` → hide the pill AND the deep-link section AND skip the schema AggregateOffer
- If the sold-series has `< 3` quarters of data → show the stats but skip the chart
- If there are zero transactions of any kind → show the "No recent activity" card with alert signup
- If `heroStats.totalTransactions === 0` → hero stat tile shows "New street" instead of number

---

## 3. Per-section data mapping

### Hero

| Mockup reference | Variable |
|---|---|
| "Whitlock Avenue" (H1) | `{street.name}` split to italic last word |
| "Street Profile · Cobban · Ford · Milton, ON" | `Street Profile · {street.neighbourhoods.join(" · ")} · Milton, ON` |
| Subtitle paragraph | `{street.characterSummary}` |
| "Mixed" housing type stat | `{heroStats.primaryHousingType}` |
| "condo · town · detached" sub | `{heroStats.housingMixDescription}` |
| "$986K" typical price stat | `formatCAD({heroStats.typicalPrice})` |
| "range $748K to $1.47M" sub | `range formatCADShort({heroStats.priceRange.low}) to formatCADShort({heroStats.priceRange.high})` |
| "244 transactions tracked" | `{heroStats.totalTransactions} transactions tracked` |
| "Primary builder: Mattamy" | `{street.primaryBuilder}` — whole tile conditionally rendered |

### Pill matrix

Loop over `productTypes` filtered where `hasData === true`. Render pills grouped by transaction type (sold vs leased). Hide empty rows entirely.

```tsx
{productTypes.filter(p => p.soldPill).length > 0 && (
  <div className="type-pills-row">
    <div className="type-pills-row-label">
      <span className="dot" />Recent sales
    </div>
    <div className="type-pills">
      {productTypes.filter(p => p.soldPill).map(p => (
        <TypePill
          key={p.type}
          type={p.type}
          name={p.displayName}
          count={p.soldPill.count}
          price={p.soldPill.typicalPrice}
          priceLabel="typical"
          anchor={`#type-${p.type}`}
        />
      ))}
    </div>
  </div>
)}
```

Same pattern for `leasedPill`.

### Description sidebar

- `streetFacts` → rendered as `<dl>` key/value pairs
- `nearbyPlaces` → rendered as list, each with category/name/distance
- Sidebar CTA → static template text with `{street.shortName}` injected

### Description body

Loop over description sections in fixed order:
1. About → `{description.about}`
2. Homes → `{description.homes}`
3. Inline CTA (fixed template, `{street.shortName}` injected)
4. Amenities → `{description.amenities}`
5. Market → `{description.market}`
6. Getting around → `{description.gettingAround}`
7. Schools → `{description.schools}`
8. Best fit for → `{description.bestFitFor}` list
9. For different priorities → `{description.differentPriorities}` list

**Conditional:** if any section's text is empty or below 80 characters, skip the heading AND the paragraph entirely. Template should never render orphan headings.

### Deep-link type sections

Loop over `productTypes` filtered by `hasData === true`. Render one section per active type.

```tsx
{productTypes.filter(p => p.hasData).map(p => (
  <TypeSection key={p.type} type={p} streetName={street.name} streetShort={street.shortName} />
))}
```

### Pattern block

Render only if `detectedPattern` exists. Otherwise skip entirely.

### Market activity

- Full-width sold chart → `{overallSoldSeries}`. Skip if `null`.
- Condo rent by beds chart → only if condo product type has `hasData`.
- Sold table → `{recentSales}`, gated by auth.

### Commute grid

Loop over `commuteDestinations`:
```tsx
{commuteDestinations.map(cat => (
  <details className="commute-category" open key={cat.id}>
    <summary>{cat.icon}<h3>{cat.title}</h3><div>{cat.subtitle}</div></summary>
    <div className="commute-cat-body">
      {cat.destinations.map(dest => (
        <CommuteRow key={dest.name} {...dest} />
      ))}
    </div>
  </details>
))}
```

### Active inventory

- If `activeListings.length > 0` → render cards
- If `activeListings.length === 0` → render empty state with alert signup

### Context cards

Loop over `similarStreets`, `relatedSchools`.

### FAQ

Loop over `faqs`. Each item becomes a `<details>` with the question and AI-generated answer.

### Corner widget

- `streetContext.street` → `{street.name}`
- `streetContext.streetShort` → `{street.shortName}`
- Widget summarizer headline → `formatCAD({heroStats.typicalPrice}) typical · {heroStats.totalTransactions} transactions`
- `sectionInsights` array → generated from the description + stats data

---

## 4. Data pipeline (three layers)

### Layer 1 — SQL aggregations (runs nightly)

Computes structured facts per street:
- Transaction counts per product type, per 6-month and 24-month windows
- Typical (median) prices per product type
- Quarterly series arrays
- Building age distribution
- Average days on market
- Typical lot dimensions (where derivable)

Output stored in: `analytics.street_profile` (one row per street).

### Layer 2 — Keyword scanning (runs nightly)

Scans listing remarks for qualitative signals:
- Builder names mentioned (with confidence thresholds)
- Feature mentions ("pool", "finished basement", "walk-out", "backs on park")
- Condition signals ("renovated", "needs work", "estate sale")
- Market positioning ("investor opportunity", "first-time buyer", "downsizer")

Output stored as tag arrays in: `analytics.street_signals`.

### Layer 3 — AI description generation (runs weekly)

For each street:
1. Fetch Layer 1 + Layer 2 outputs
2. Construct the prompt using the voice rules locked in Whitlock mockup
3. Call Claude API
4. Parse the response into the 8 description sections
5. Validate output (no em dashes, no competitor mentions, no methodology leaks, under 1400 words)
6. Store in: `analytics.street_descriptions`

**Fallback:** If AI generation fails or produces invalid output, the page still renders with a minimal template using only Layer 1 + Layer 2 data. Never ships a broken page.

---

## 5. Schema generator

File: `/src/lib/schema.ts`

```typescript
export function buildStreetPageSchema(data: StreetPageData): object {
  const graph: any[] = [
    buildLocalBusinessSchema(),           // always
    buildPlaceSchema(data.street),        // always
    buildBreadcrumbSchema(data.street),   // always
    buildFAQPageSchema(data.faqs),        // if faqs.length > 0
  ];

  // Conditional AggregateOffer per product type
  for (const pt of data.productTypes) {
    if (pt.hasData && pt.soldPill) {
      graph.push(buildAggregateOfferSchema(pt, data.street, 'sale'));
    }
    if (pt.hasData && pt.leasedPill) {
      graph.push(buildAggregateOfferSchema(pt, data.street, 'lease'));
    }
  }

  // ItemList for alternatives
  if (data.description.differentPriorities.length > 0) {
    graph.push(buildAlternativesItemListSchema(data.description.differentPriorities, data.street));
  }

  // ItemList for nearby places
  if (data.nearbyPlaces.length > 0) {
    graph.push(buildNearbyPlacesItemListSchema(data.nearbyPlaces, data.street));
  }

  return { "@context": "https://schema.org", "@graph": graph };
}
```

**Validation layer:** Every schema generation runs through Google's Rich Results Test API before shipping. If validation fails, build breaks.

---

## 6. Graceful degradation rules

The template must handle every street gracefully, including edge cases:

| Scenario | Behavior |
|---|---|
| New street with 0-3 listings | Hero shows "New street", pill matrix omitted, description shows minimal "About" + nearby places + commute grid only |
| Single product type street | Only that pill shows, only that deep-link section renders, chart may still render if quarterly data sufficient |
| Lease-only street (rentals, no sales) | Only the "Leased" pill row shows, deep-link section skips "Recent sales" header |
| Active-construction street | "Coming soon" mode triggered by proximity to known new developments, placeholder description |
| Renamed street | Redirect from old slug to new slug permanent |
| Streets with name collisions | Unique slug via neighbourhood suffix |

---

## 7. Monthly regeneration cadence

- **SQL aggregations** — nightly at 11:00 UTC via Vercel cron (already built)
- **Keyword scanning** — nightly, same run as SQL
- **AI descriptions** — weekly by default, triggered on significant data changes (>5% price shift, new product type emerges, sample size crosses a threshold)
- **Schema regeneration** — on every page render (computed, cached in Vercel)
- **Sitemap regeneration** — on every Vercel deploy

---

## 8. Voice rules (locked from Whitlock iteration)

All AI-generated prose must:
- Use "we" / "our team" — never "I"
- Zero em dashes in prose (use period, comma, or parentheses)
- No superlatives that can be challenged ("nothing else comes close", "the best", "unbeatable")
- No disparagement of other realtors, neighbourhoods, or buildings
- No exact window references ("last 24 months", "last 6 months", "18 months")
- Replace "median"/"average" with "typical" in customer-facing copy (backend computes median)
- Factual builder mentions allowed; builder-based cross-recommendations prohibited
- Present-tense, advisory tone — boutique firm, not aggressive sales
- Sentence variety — mix short and long; not every sentence in parallel structure
- No hedge openers ("it's worth noting", "it bears mentioning")
- No intensifier adverbs in prose ("remarkably", "notably", "meaningfully")
- No formal transitions ("moreover", "furthermore", "additionally")

---

## 9. Competitor hardening rules

At the DOM/source level, the template must not reveal:
- Aggregation window lengths (no "24 months" ever in visible copy)
- Pipeline architecture (no "Computed locally", no "TREB VOW Feed #X")
- Statistical methodology (no `n = X`, no "median" as label)
- Page taxonomy (generic IDs like `#s1`, `#s5` rather than `data-section="description"`)
- Refresh cadence (no "updated monthly" tags)

Legal attribution stays as "Toronto Regional Real Estate Board" — satisfies TREB compliance without broadcasting feed ID.

---

## 10. Deliverables for Sprint 1 build

1. `/src/app/streets/[slug]/page.tsx` — the master template
2. `/src/components/street/` — individual section components (Hero, PillMatrix, DescriptionBody, TypeSection, CommuteGrid, FAQ, CornerWidget, ExitIntent, etc.)
3. `/src/lib/schema.ts` — schema generator library
4. `/src/lib/street-data.ts` — data fetching & shaping from Neon
5. `/src/lib/ai-description.ts` — AI generation pipeline
6. `/src/lib/validators.ts` — voice rule + schema validators
7. `/src/app/api/leads/route.ts` — lead submission handler
8. `/src/app/api/sitemap/route.ts` — dynamic sitemap generator
9. Database migrations for `analytics.street_profile`, `analytics.street_signals`, `analytics.street_descriptions`

---

## 11. Success criteria

Before Sprint 1 can ship:
- 10 test streets render correctly using the template
- Schema validates through Google Rich Results Test API
- AI descriptions for all 10 streets pass voice-rule validation
- Mobile responsive across all sections
- Page load time under 2.5 seconds on Vercel
- No methodology leaks in view-source
- Lead form submissions routing to the correct workflow (buyer vs seller vs browser)

When all 10 pass, scale to the full Milton street catalog. When new streets appear in the MLS feed, they auto-generate the next night.

---

## Companion file

The visual/copy specification is: `whitlock-avenue-mockup.html`. This document is the data/behavior specification. Together they are the complete build spec for the street page master template.

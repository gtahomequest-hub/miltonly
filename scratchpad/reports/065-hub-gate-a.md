HOME · D:\miltonly-home · feat/homepage

# 065 — The on-market count, and Gate A recon for the 22 hub pages

Recon and a decision request. No code. Measured against production and the live DBs
2026-09-10, main at `a9546a7` (code).

---

# PART 1 — What the homepage on-market count actually includes

## First, a correction

I told you this figure "would include leases and non-Milton rows". **That was wrong**, and it
matters because it points at the opposite defect from the real one. In this schema a lease can
never carry `status='active'`. The mismatch runs the other way: the count is narrower than its
label, not broader.

## The query

`src/lib/ai/buildHubInput.ts`, `computeMiltonWideContext()`:

```ts
prisma.listing.count({ where: { permAdvertise: true, status: "active" } })
```

No city filter, no transaction-type filter, no property-type filter, no price floor. It reaches
the hero as `stats.onMarket` and the Buy mega-menu panel as `activeCount`.

## What is in it, measured

**448 rows.** Every one of them:

| dimension | value |
|---|---|
| transaction type | **For Sale, 448 of 448.** Not one lease |
| city | **Milton, 448 of 448.** The table holds only Milton rows (3,346 total), so the missing city filter is a no-op today |
| advertised | `permAdvertise = true`, 448. There are zero active rows with `permAdvertise = false` |
| property type | detached 223 · townhouse 120 · condo 73 · semi 32 |
| tenure | Residential Freehold 338 · Residential Condo & Other 110 |
| price | one row below $100,000; no floor is applied (`getHeroStats`, a different and unused figure, applies `price > 100000`) |
| photos | none missing |

## Why no lease can appear

The lease lifecycle does not use `status='active'`. It uses `status='rented'` with a separate
`leaseStatus`, exactly as the schema comment says. Measured:

| | rows |
|---|---|
| `For Lease` + `status='active'` | **0** |
| `status='rented'` + `leaseStatus='active'` — **available to rent right now** | **1,114** |
| `status='rented'` + `leaseStatus='leased'` | 224 |

All statuses present: `active` 448, `rented` 1,338, `sold` 570, `expired` 990.

## So the mismatch is

The label says **"on the market today"**. The count is **advertised Milton homes for sale**. It
omits **1,114 rentals that are on the market today**. A reader who wants to rent is told there
are 448 things available when there are 1,562.

## The two options

**A. Change the label to describe the count: "homes for sale today".**

- No query change, no gate change (the check asserts value and format, not wording).
- Keeps the hero row coherent: all four figures stay sale-side. "New in the last 7 days" is
  sale-side, "sold so far this month" is sale-side, "typical Milton home" is sale-side. Making
  one tile of four a blended sale-plus-lease number would make the row mean nothing as a set.
- No blast radius. Nothing else moves.

**B. Change the filter to match the label: 448 + 1,114 = 1,562.**

- `computeMiltonWideContext` would need a union of sale-side `status='active'` and lease-side
  `leaseStatus='active'`, and `loadHomeRecord()` in the battery must change in the same commit
  or the gate goes red.
- Blast radius is larger than it looks. `activeListingsCount` is not homepage-only, and hub
  pages compute their own per-hood equivalent the same sale-side way. Change one and the
  homepage and the 22 hubs would define "on the market" differently, which is the two-figures-
  one-word defect this codebase keeps paying for.
- It buys a bigger number and a literally true label.

**I recommend A**, and it is the cheaper of the two by a wide margin. **If you want the rental
inventory visible** — and 1,114 units is a real asset that no figure on the site currently shows
— the better version of B is: keep 448 as "homes for sale today" and add a **fifth tile,
"1,114 available to rent"**, each figure naming its own market. That gets the reach of B without
blending two markets inside one number. Say which and I will build it.

---

# PART 2 — Gate A: the 22 neighbourhood hub pages

## 1. What is live now

### Files

| File | Lines | Role |
|---|---|---|
| `src/app/neighbourhoods/[slug]/page.tsx` | 88 | `force-dynamic`. Metadata from `getHubMetaLive`, body from `getHubData`, 5 JSON-LD blocks |
| `src/app/neighbourhoods/[slug]/streets/page.tsx` | — | The street overflow index, live only above the ladder cap; below it, redirects to the hub and declares itself noindex |
| `src/components/hub/HubPage.tsx` | 36 | Composition: `SiteNav` + 10 sections |
| `src/components/hub/sections.tsx` | 365 | All 10 sections |
| `src/components/hub/hub-theme.css` | 669 | The hub cascade, separate from the homepage's |
| `src/components/hub/types.ts` / `format.ts` / `icons.tsx` / `mockData.ts` | — | Seam, helpers, fixture |
| `src/lib/hubData.ts` | 254 | The read seam |
| `src/lib/hubLive.ts` | 110 | Request-cached live input + the one meta formula |
| `src/lib/ai/hub/*` | — | `generateUrbanHub`, `generateRuralHub`, `hubMeta`, `projectHubEntities`, fail-closed guards |
| `src/lib/neighbourhoodStreets.ts` | 72 | Overflow index data, gated on `getHubData` |

### Sections in order, and the data each reads

| # | Section | Data | Source |
|---|---|---|---|
| 1 | `HubHero` | `character`, `intents`, `name`, `profile`, and the 4 stat tiles | character = first sentence of generated overview, falling back to the LIVE meta description. Stats: `typicalPrice` (k-gated, `round5k`), `sold12mo`, `onMarket`, `dom` |
| 2 | `HubGlance` | `atAGlance` | `priceRange` k10 from DB2; `dominantType` from `byType`; **`suits`, `commute`, `schools` are STATIC strings**, identical on every hub of a profile |
| 3 | `HubOverview` | `overview[]` | Generated paragraphs: `openingIdentity`, `amenities`, `bestFitFor`, `inventorySnapshot` |
| 4 | `HubMarket` | `commentary`, `marketCompare` | Generated `liveMarket` + `comparedToMilton`; compare row is hub typical vs Milton typical, both `round5k` before the delta |
| 5 | `HubStreets` | `streets[]`, `hasStreetOverflow` | Published-only, capped at **12**, sorted VIP first then 12-month sales. `typicalPriceRounded` is **hardcoded null** — cards show a sold count and nothing else |
| 6 | `HubVip` | `vipStreets[]` | Urban only, max 6, VIP subset of the same set |
| 7 | `HubCondos` | `condos[]` | `CondoBuilding` by `neighbourhoodId` |
| 8 | `HubFaqs` | `faqs[]` | Stored `HubContent.faqJson` |
| 9 | `HubSiblings` | `siblings[]` | Same profile, each with a k-gated typical |
| 10 | `HubDualCta` | `ctaBuyer`, `ctaSeller` | Templated strings around the hub name |

Then `FooterSection` — **the old footer, not the homepage's live link graph.**

### What the battery checks

**One check, `hub-meta.mjs`, and it is about one figure.** Its 11 assertions compare, per hub:
the meta description price and sale count, the hero tile, and the JSON-LD `aggregatePrice`,
each against a DB2-recomputed record, plus that k-suppression holds on all three surfaces
rather than some. The `homepage` check reads each hub's typical from the homepage ladder and
asserts it against the same record.

**Nothing checks the body.** Not the overview prose, not the ladder, not the FAQs, not the
condo list, not the siblings, not one internal link, not the glance panel's static claims, and
not the overflow page at all. A hub could render an empty ladder, a dead link or a fabricated
amenity and every check would pass.

### 2. How the 22 differ

**All 22 are generated and all 22 succeeded** (`HubGeneration.status = 'succeeded'`). There is
no ungenerated hub. The variation is in tier, depth and inventory.

| tier | count | sections | FAQs |
|---|---|---|---|
| `urban_hub` | 14 | **7** | 6 |
| `rural_hub` | 8 | **4** | 4 to 5 |

Two of the eight rural-tier hubs are `kind = urban`: **`bronte-meadows`** and **`milton-north`**,
the thin-urban pair the codebase already flags. Profile, not kind, drives everything.

Published street ladders vary by a factor of 45:

| hub | published streets | with video | condos |
|---|---|---|---|
| beaty | 45 | 0 | 4 |
| clarke | 43 | 4 | 6 |
| ford | 40 | **19** | 2 |
| harrison | 35 | 1 | 0 |
| willmott | 33 | **11** | 5 |
| coates | 31 | 0 | 3 |
| old-milton | 29 | 0 | 11 |
| scott | 29 | 0 | 1 |
| dempsey | 23 | 0 | **17** |
| timberlea | 21 | 2 | 3 |
| cobban | 19 | 1 | 9 |
| bowes | 16 | 0 | 0 |
| walker | 15 | 0 | 4 |
| dorset-park | 13 | 0 | 0 |
| rural-milton-west | 11 | 1 | 0 |
| nassagaweya | 11 | 0 | 0 |
| bronte-meadows | 8 | 0 | 0 |
| campbellville | 7 | 0 | 0 |
| brookville-haltonville | 6 | 0 | 0 |
| rural-trafalgar | 5 | 1 | 0 |
| milton-north | 2 | 0 | 0 |
| moffat | 1 | 0 | 0 |

Consequences the rebuild has to hold: **14 hubs are over the ladder cap** and carry an overflow
page; **two hubs have a ladder of 1 and 2**, where a "ladder" is a formatting lie; **14 of 22
have no video at all**; **11 of 22 have no condo building**; and **`milton-north` and `moffat`
are sub-k**, so they publish no price on any surface and must keep not doing so.

### 3. Defects found during recon

- **`/#mls` is a dead link on all 22 hubs.** The "I'm investing" intent square points at a
  homepage anchor that was deleted with the MLS section. Confirmed live on `/neighbourhoods/ford`.
- **`#streets` is also dead.** The "I'm buying" square points at `/neighbourhoods/<slug>#streets`
  and no section carries that id. Two of four intent squares land nowhere.
- **The ladder shows no price.** `typicalPriceRounded` is hardcoded `null` on every street card.
- **No video signal anywhere on a hub**, though `ford` alone has 19 filmed streets.
- **The glance panel's `suits` / `commute` / `schools` are static strings**, identical across
  every hub of a profile, presented beside live figures. That is the shape of a fabricated fact
  even though each string is individually true of Milton.
- **Hubs still render the old `FooterSection`**, so they do not carry the link graph the
  homepage now has.

---

## 4. Proposed hub page

In the homepage's design language: the encyclopedia device (monospace index number in the left
margin, full-width hairline, heading hard left with its standfirst beside it), cream and forest
grounds alternating, `data-fig` on every figure so the battery can read it.

| # | Section | One line |
|---|---|---|
| — | **Header** | `SiteNav variant="page"`, already the three-menu version |
| — | **Hero** | Name, the generated character sentence, and four live figures with the homepage's `data-fig` discipline: typical, sold 12mo, on market, days to sell. The four intent squares are replaced by real links or dropped |
| 01 | **Streets on film** | The hood's own filmed streets, poster frames first, because it is the one thing no competitor has. Renders nothing on the 14 hubs with no clips |
| 02 | **The street ladder** | Every published street in the hood, ranked by sales, homepage ladder treatment: measure bar, sold count, k-gated typical, a mark on streets carrying a clip. Overflow link above the cap; below 3 streets it becomes a sentence, not a ladder |
| 03 | **What it is like** | The generated overview prose, unchanged in substance |
| 04 | **The market here** | Typical vs Milton with the delta, price band, days to sell, sold-to-ask, each stating its own window and suppression |
| 05 | **Condo buildings** | The hood's buildings, rendered only where they exist |
| 06 | **Questions** | The stored FAQs, unchanged |
| 07 | **Nearby neighbourhoods** | Siblings with their k-gated typicals |
| 08 | **Valuation** | The homepage's `HomeValuationCard` band, source tag `hub-valuation`, with three proof points scoped to this hood |
| 09 | **Guides** | Links up to the guides that cover this neighbourhood. **Blocked on Content** |
| — | **Footer** | The homepage's live link graph, replacing `FooterSection` |

### Data: what exists, what needs building

| Need | Status |
|---|---|
| Hub aggregates, k-gated, request-cached | **Exists** — `getHubInputCached`, one computation per request |
| Generated prose + FAQs | **Exists** — all 22 succeeded |
| Published-only street ladder, capped | **Exists** — `getHubData.streets` |
| Sibling hubs with k-gated typicals | **Exists** |
| Condo buildings per hood | **Exists** |
| Overflow street index | **Exists** — `getNeighbourhoodStreetIndex` |
| Valuation form | **Exists** — reuse whole |
| **Filmed streets for one hood** | **Needs building.** `getStreetsWithVideo()` is corpus-wide; it needs a neighbourhood filter. Small |
| **Per-street typical on the ladder** | **Needs building.** The card field exists and is hardcoded null. Must be k-gated per street, and most streets will suppress |
| **Sold-to-ask and price band per hood** | **Partly exists.** `priceRange` is there at k10; sold-to-ask is computed Milton-wide in `soldAggregates` and would need a per-hood equivalent using the hub's own raw-string pool |
| **A real destination for the four intents** | **Needs a decision**, not a build. Two of four are dead today |
| **Guide links** | **Blocked.** No guide model exists; `/blog` is a noindex placeholder and `guide-preview` / `guides-preview` are previews. Content owns it |

### How the hub links down to its streets

Three rungs, video first:

1. **Section 01** puts the hood's filmed streets at the top, each poster linking to the street
   page. On `ford` that is 19 links above the fold of the ladder; on 14 hubs the section does
   not render.
2. **Section 02** is the ladder: every published street, ranked, with a video mark on the ones
   carrying a clip so the two sections agree about which streets are filmed.
3. **The overflow page** stays for the 14 hubs above the cap and keeps its current
   noindex-and-canonical behaviour below it.

The published-only gate stays exactly as it is. A hub must not link a street with no published
page, which is the defect the current gate was written to fix.

### How the hub links up to the guides

**Not buildable yet, but the contract can be fixed now so Content builds against it:**

- A guide declares the neighbourhood slugs it covers; the hub queries by its own slug. Neither
  side hardcodes a list, so a new guide appears on its hubs without a hub edit.
- The link is reciprocal: guide to hub, hub to guide, and both are real anchors in server HTML.
- A hub with no guide renders no section, the same rule as the video strip and the condo list.
- Section 09 sits below the FAQs, so the guide is an onward path rather than a competitor to
  the hub's own answer.

**I need one thing from Content before building it: the field that carries the neighbourhood
association on a guide.** Everything else on this page can be built without them.

---

## Open questions for approval

1. **The on-market label**: A (relabel to "homes for sale today"), B (blend to 1,562), or the
   variant I recommend (relabel and add a separate "available to rent" figure)?
2. **The four intent squares**: give them real destinations, or drop them? Two are dead now.
3. **The static glance claims** (`suits` / `commute` / `schools`): drop them, or replace with
   derived facts? They read as per-hood facts and are per-profile constants.
4. **Ladder price**: publish a per-street k-gated typical, accepting that most streets will
   suppress, or leave the ladder as sold counts only?
5. **Hub gate**: extend the battery the way the homepage was extended, in the same build?
   Hub pages have 11 assertions and all of them are about one figure.

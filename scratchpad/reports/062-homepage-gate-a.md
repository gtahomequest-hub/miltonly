HOME · D:\miltonly-home · feat/homepage

# 062 — Homepage, header, footer: Gate A recon

Recon only, no code. Measured against production (`https://miltonly.com`, deployment
`dpl_4ghB9g23VSfrwNQFrXLiSeKkKCxP`) and the live DBs on 2026-09-10.

---

## 1. What is live now

### Files

| File | Lines | Role |
|---|---|---|
| `src/app/page.tsx` | 34 | `force-dynamic` server page. Awaits `getHomepageData()` + `getBoardData()`, emits 4 JSON-LD blocks, renders `<HomePage>` |
| `src/components/home/HomePage.tsx` | 31 | `'use client'`, imports `home-theme.css` (39 KB), composes the 5 sections |
| `src/components/home/HomeNav.tsx` | 14 | Wrapper over `<SiteNav variant="home">` |
| `src/components/nav/SiteNav.tsx` | 291 | The header. Both variants, mega panels, mobile panel, scroll-reveal search |
| `src/components/home/Hero.tsx` | 91 | Headline, lede, 3 stat tiles, ask card, 4 pills, trust bar |
| `src/components/home/AskBar.tsx` | 258 | The one search input. Rotating examples, `resolveHeroHref` |
| `src/components/home/HeroMap.tsx` | 200 | Decorative background map |
| `src/components/board/TheBoard.tsx` + `ThinSegmentCard.tsx` | — | THE BOARD. 5 tabs, 4 metrics, price band, chart, suppression note |
| `src/components/home/TrustBand.tsx` | 15 | One static sentence |
| `src/components/home/HomeFooter.tsx` | 83 | Brand, search well, 4-column link graph, compliance line |
| `src/components/home/FooterSearch.tsx` | 36 | Second search input, same resolver |
| `src/lib/homepageData.ts` | 120 | The read seam |
| `src/components/home/mockData.ts` | — | Static hero editorial (headline, lede, pills, ask examples) |
| `src/components/home/home-theme.css` | 39 KB | The whole homepage cascade |
| `src/app/layout.tsx` | 151 | Root metadata, fonts, `ChromeGate` suppression of the global `Navbar` on `/` |

In-repo but **not rendered** since Board V1: `SearchBand`, `NeighbourhoodIndex`, `VipStrip`,
`MarketCommentary`, `MlsExplore`, `DualCTA`, `TrustBar`.
`src/components/sections/FooterSection.tsx` and `PreFooterCTA.tsx` are the *other* pages' footer,
not the homepage's.

### Sections in order, and what each reads

1. **HomeNav** (`SiteNav variant="home"`). Reads nothing. 4 hard-coded labels, 4 hard-coded
   `MEGA_PANELS` arrays of 3 to 5 static links each, one CTA to `/sell`, a scroll-reveal search
   that appears once `#m-hero-askbar` clears 70 px.
2. **Hero**. `data.hero` (static, from `mockData`), `data.stats` (3 live figures),
   `data.trust` (hardcoded business facts). One `<h1>`: "Milton / Real Estate Encyclopedia".
3. **THE BOARD**. `getBoardData()`, a single read of the precomputed `analytics.board_stats`
   (DB3), 5 rows. Returns `null` on any failure and the section then does not render.
4. **TrustBand**. Static, 27 words.
5. **HomeFooter**. `data.footer`: top-3 published neighbourhoods, top-2 VIP streets,
   neighbourhood count, surfaced street count. Plus 20 hard-coded links.

### Word count

**302 words** of visible body copy on the live page, tags, scripts and SVG stripped.
Roughly 120 of those are THE BOARD's labels and figures, 27 the TrustBand sentence, 39 the
compliance line, about 60 the footer link labels. Editorial prose a search engine could read as
being *about Milton*: the lede ("Every street. Every sale. Every answer.") and the Board's one
interpretive line ("Milton is not one market: the middle half spans a wide range, and it moves
by neighbourhood"). That is the whole of it.

### Crawlable link graph

**24 unique internal `href`s in the served HTML.** The nav contributes **zero**: all four nav
items are `<button>` elements whose panels mount only on click, and the mobile panel mounts only
when open. Every crawlable link comes from the footer, the 4 hero pills, and the Board CTA.
`/neighbourhoods` and `/streets` are each linked once, from the footer.

### SEO state

- Title and canonical are **inherited from the root layout**, not set by `page.tsx`. The title is
  101 characters: "Milton Real Estate Encyclopedia — Milton Ontario Real Estate, Homes For Sale &
  Street Data | Miltonly". The layout's own comment records that this length was measured as
  harmful on street pages. The homepage never got the same treatment.
- `alternates.canonical = SITE_URL` is a **layout-level default**, so it is right for `/` by
  inheritance rather than by declaration.
- JSON-LD is good: `RealEstateAgent`, `WebSite` with `SearchAction`, `FAQPage` (5 Q/A),
  `BreadcrumbList`.
- The `<h1>` is a brand phrase, not a query.
- `force-dynamic`: no ISR, no static HTML. TTFB carries `buildMiltonWideContext()`, a percentile
  query, and 5 Prisma queries on every request.

### What the battery checks on them

**Nothing.** `scripts/verify/run.mjs` is the street-corpus battery: 9 checks (`denials`,
`schema-parity`, `claims`, `tiles`, `consistency`, `composition`, `coordinates`, `hub-meta`,
`geometry-control`) over the 444 published street pages and the 22 hubs, derived from the
sitemap. It never fetches `/`. The 19 prebuild tests touch no homepage, header or footer file.
**The homepage has zero automated coverage of any kind.** A homepage change cannot be caught by
the existing gate; it can only be caught by looking at it.

---

## 2. Data sources: what exists, what needs building

Counts measured on the live DBs, 2026-09-10.

| # | Source | Status | Where it is, or what is missing |
|---|---|---|---|
| 1 | **Active listing count** | **Exists** | `buildMiltonWideContext().activeListingsCount`, already on the homepage as `stats.onMarket`. **448** today. A second, differently filtered copy sits in `stats.ts getHeroStats` (`price > 100000`) which nothing consumes |
| 2 | **New this week** | **Needs building** (small) | No live function. `stats.ts getFeaturedListings` computes `listedAt >= now-7d` but is **dead code, zero consumers**. `Listing.listedAt` is reliable. **45** actives listed in the last 7 days |
| 3 | **Price drops this week** | **Needs building, and needs a decision** | The only signal is `Listing.lastPriceChangeAt`, set by ingest when MlsStatus = 'Price Change'. **No previous price is stored**, so a drop cannot be distinguished from an increase. `listingsV2Data` already ships a `priceReduced` flag built on a 14-day window of that same column, which is therefore mislabelled. **16** actives had a price change in the last 7 days. Options: (a) call the section "price changed this week" and state exactly that, (b) capture the prior price at ingest, a schema change and outside this worktree. **(a) is the honest one and the one I propose** |
| 4 | **Sold this month, k-gated** | **Needs building** (small) | `soldAggregates.ts` has 12-month and quarterly rollups, both k-gated, but no monthly. Query shape, `K_ANON_PRICE` and `round5k` conventions are all in place. Month to date: **23 sales, typical $970,000**, above the k5 floor. Reporting lag is real, so the label has to say "so far this month" |
| 5 | **22 hub cards, active count + typical price** | **Exists, in the wrong place** | `src/app/neighbourhoods/page.tsx` builds exactly this: canonical-first from published `HubContent`, active count per raw string, active for-sale price, null-degraded. It is **inline in the page component**, not a lib function. **22 published hubs** confirmed live. Needs extracting to a shared lib; the logic is done and proven. Caution: that page uses an active-listing *average*, while the Board and hero use a k-gated *typical*. Two kinds of figure under one word would break the Voice rule |
| 6 | **Streets with video** | **Needs building** (trivial) | `StreetContent.videoUrl` / `nightVideoUrl` exist; `src/lib/streetVideo.ts` already derives poster, caption and upload date by URL convention. No index-level query anywhere. **40 published streets carry a clip: 37 day, 3 night.** A poster strip is one `findMany` plus the existing resolver |
| 7 | **Newest listings** | **Exists** | `listingsV2Data.ts` defaults to `orderBy: { listedAt: 'desc' }` with `CARD_SELECT` and, importantly, server-side address redaction through `applyDisplayGate`. Reusable with a small `take`. Do **not** hand-roll a second listing query: the redaction gate is the reason |
| 8 | **Address to anchor search** | **Needs building** | `resolveHeroSearch` is entity-only. It tokenises digits but never uses them: "410 Farmstead Drive" builds the key `410farmsteaddrive`, matches nothing, falls through to `/listings?q=`. The destination data already ships: `src/lib/town/addresses.ts` (`townAddressesForSlug`), 40,826 civic addresses over 901 identities, and the anchors are live at `/streets/<slug>#<number>` from QUEUE item 3. What is missing is a **number-aware branch**: split a leading house number, resolve the remainder as a street, confirm the number exists in the Town projection, return the anchor. `parseAddress` and `identityFromSlug` in `src/lib/town/identity.ts` already do the parsing half |
| 9 | **Valuation form** | **Exists** | `src/components/landing/HomeValuationCard.tsx`: 4 themes including `forest`, CASL consent text snapshotted at submit, honeypot, phone auto-format, GA4 `generate_lead`, posts to `/api/leads` which handles rate limiting, SMS, kvCore and the realtor notification. Drop-in with a new `source` tag |
| 10 | **Daily brief signup** | **Needs building** | No newsletter, subscription or digest model exists. `/api/seo/digest` is an internal SEO report, unrelated. `SavedSearch` is account-bound and the wrong shape. Nearest precedent is `StreetAlertCTA` posting to `/api/leads`. **Proposal: reuse `Lead` with a `source` tag and the existing consent snapshot rather than add a table.** Sending the brief is a separate job and outside this worktree |

---

## 3. Proposed homepage

Order as briefed. The data does not argue for a different order, with one exception at 6.

1. **Hero: one search box, Milton right now.** One input, the `AskBar`, widened to accept a civic
   address (source 8). Under it a live figure row: on the market today, new this week, sold so
   far this month, typical price. Sources 1, 2, 4, and the existing hero query.
2. **Streets with video.** A horizontal strip of poster frames, 40 available, each linking to its
   street page. Source 6.
3. **Newest listings.** 6 to 8 cards through `listingsV2Data`'s redaction gate. Source 7.
4. **Neighbourhoods grid.** All 22 published hubs, each with active count and a typical price,
   one figure kind only. Source 5.
5. **Valuation form with three proof points.** `HomeValuationCard` in `forest`, flanked by three
   claims that trace to real figures: sales in the corpus, streets with a page, the sold-to-ask
   figure the Board already computes. Source 9.
6. **Price changed this week.** Source 3, under the honest label. **This should sit below the
   valuation form, or come out of V1**: 16 rows is a thin strip, it cannot say "drop" truthfully,
   and it is the one section here at risk of reading as filler.
7. **Daily brief signup.** Email plus consent, posting to `/api/leads` with a new source tag.
   Source 10.
8. **Footer link graph.** Rebuilt from live data rather than 20 hard-coded links: all 22 hubs,
   top streets by rank, tenure hubs, tools.

### Against THE THREE RULES

| Section | SEO | Conversion | Layout |
|---|---|---|---|
| 1 Hero | Needs work. The `<h1>` is a brand phrase, the title is inherited at 101 chars | Passes. One input, one resolver, four intents | Needs work. Card over map is the category default |
| 2 Video strip | **Passes, and is the strongest asset on the page.** 40 street clips is something no competitor has, and it feeds internal links to 40 pages | Needs work. No stated next step today | **Passes.** Nothing in Milton real estate looks like this |
| 3 Newest listings | Needs work. Listing cards read as duplicate-thin unless each also links its street and its neighbourhood | Passes | Needs work. The most conventional block on the page, and the one most likely to read as a template |
| 4 Neighbourhoods grid | **Passes.** 22 crawlable links to the strongest pages on the site, each carrying a figure | Passes | Needs work. A card grid is the norm. The differentiator would be ruling it by a real dimension rather than listing alphabetically |
| 5 Valuation form | Needs work. A form is not indexable content; the prose around it has to earn the space | **Passes.** The one proven converting component in the repo | Passes if it is not a right-rail card |
| 6 Price changed | Fails today on the label. Passes once relabelled | Needs work. 16 rows | Needs work |
| 7 Daily brief | Needs work. Nothing to index | Passes, low friction | Passes if it is a full-width rule rather than a modal |
| 8 Footer graph | **Passes.** The single largest SEO gain available here: 24 internal links today, roughly 60 after, all to real pages | n/a | Passes |

**Two structural failures no section fixes on its own**, which I would treat as part of this
build rather than as follow-ups:

- **The header emits no crawlable links.** Four `<button>`s and a click-mounted panel. Whatever
  the mega menu becomes, its links must be in the served HTML.
- **The homepage has no automated check.** Every other surface here is gated. I would add a
  homepage check to the battery, or a prebuild test asserting the structural invariants: one
  `<h1>`, a declared canonical, a link-count floor, no figure rendered without its k-gate.

---

## 4. Proposed mega menu

Three menus, replacing the current four. Each is a left rail of **intents**, a right panel of
**live content**, and a shared bottom strip of **in-demand streets**. Every panel link is a real
`<a href>` present in the served HTML whether or not the panel is open, so the menu adds to the
link graph instead of hiding from it. Below 380 px the whole thing collapses to an accordion:
rails become headings, panels become disclosure bodies, the bottom strip becomes the last group.

**Buy.** Left rail: homes for sale, for rent, recently sold, condo buildings, freehold, POTL,
compare, exclusive listings. The right panel reads the same seam the listings grid reads,
`listingsV2Data` with a small `take`: 4 newest active listings, each already through
`applyDisplayGate` so a withheld address never leaves the server, plus the live active count from
`buildMiltonWideContext().activeListingsCount` and the new-this-week count from `Listing.listedAt`.
One line of market context under the cards comes from the Board's `overall` tab, which the page
has already fetched.

**Streets.** Left rail: all streets, street map, streets with video, sold on my street, address
lookup. The right panel is the differentiator and reads two sources: `StreetContent` rows with a
non-null `videoUrl` or `nightVideoUrl`, resolved through `src/lib/streetVideo.ts` for poster and
caption, showing 3 or 4 poster frames of the 40 available; and a type-ahead over
`/api/autocomplete?type=street`, which is entity-gated against `ResidentialStreet` and already
returns names through `resolveStreetName`. Once the number-aware branch of `resolveHeroSearch`
lands, the same box takes "410 Farmstead Drive" and lands on the anchor.

**Sell.** Left rail: what is my home worth, sold data and trends, market by property type, book a
call, about Aamir. The right panel reads THE BOARD's `analytics.board_stats` row for `overall`,
already loaded by the page: the typical figure with its month and year deltas, days to sell,
sold-to-ask, and the window label the Board publishes, so the menu cannot state a figure the page
below it contradicts. Under it, one valuation entry point pointing at `/sell`, not an inline
form, because a form inside a menu cannot carry the consent text the CASL snapshot requires.

**Bottom strip, shared by all three menus: in-demand streets.** Reads `ResidentialStreet` where
`isVip` is true, ordered by `recencyWeightedSold`, filtered through `surfacedStreetWhere()` so a
dormant entity can never appear, names through `resolveStreetName`, 6 to 8 of them. Same
predicate the footer's top-2 already uses, widened.

---

## Open questions for approval

1. **Price drops.** Relabel to "price changed this week" and ship the honest version, or drop the
   section from V1? I propose relabel, placed low.
2. **Neighbourhood card price.** `/neighbourhoods` uses an active-listing average; the Board and
   hero use a k-gated typical. Which goes on the homepage grid? I propose the k-gated typical, so
   one word means one thing sitewide.
3. **Daily brief.** Confirm reusing `Lead` with a source tag rather than a new table, and confirm
   that sending the brief is outside this worktree.
4. **Title and `<h1>`.** The homepage inherits a 101-character title and leads with a brand
   phrase. Both are in scope here. Confirm I may change them.
5. **A homepage gate.** Battery check, or prebuild structural test? The homepage is the only
   significant surface with no automated coverage.

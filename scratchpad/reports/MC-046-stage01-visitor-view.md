# MC-046
CORE · D:\miltonly · feat/visitor-gate

## MC-046 Stage 0: the VOW inventory. Stopped at Gate A; Stage 1 waits for the Architect's ruling.

**Stage 0 changed no code.** The branch carries only this report and three count scripts in `scratchpad/mc046/`. No VOW row entered the session: every query and crawl printed counts only.

**The headline:** a signed-out visitor sees VOW-derived figures on every one of the 1,355 sitemap URLs and on the 404 page. The mega menu alone does that: sold typicals, days to sell, sold-to-ask, and rents taken from closed leases are serialized into `SiteNav` on every page. Beyond the menu, 695 of 719 street pages, all 22 hubs, all 59 condo pages, the homepage, `/sold`, Market Watch, 4 of 9 guides, `/compare`, `/value` and four public API routes carry page-level VOW figures.

**The street head is clean.** Title, meta description, canonical, robots and H1 carry no figure, so Stage 1 can keep them byte-identical. The hub meta description does carry one (ruling R4).

### Method
- **Code:** six read-only code sweeps (readers, street, hubs and condos, home/menu/listings, non-HTML, email/SMS), with file:line spot-checked.
- **Pages:** an anonymous crawl of production `916f473`'s 1,355 sitemap URLs plus a 404, and each street's `/api/streets/[slug]/card` (`scratchpad/mc046/stage0-count.mjs`, log `stage0-count.log`).
- **Stored content:** DB1 counts of stored generated content (`stage0-db-counts.mjs`, `stage0-market-sections.mjs`).

### 1. Code paths that read VOW records

**DB2 `sold.sold_records`, raw sold and leased records:**
- `src/lib/sold-data.ts`: `getStreetSoldList:254`, `getNeighbourhoodSoldList:283`, `getRecentSoldList:309`, `getMiltonSoldTotals:347`, `getSoldNeighbourhoodOptions:391`.
- `src/lib/soldAggregates.ts`: `:68` overall 12 mo (median, mean, band, DOM, sold-to-ask), `:124` by type, `:162` by hub, `:204` quarterly, `:241` bundle.
- `src/lib/ai/buildHubInput.ts`: `saleAggQuery:174`, `leaseCountQuery:193`, `quarterlyQuery:208`, `byTypeQuery:231` (the shared aggregate queries), plus `buildHubInput:248`, `buildRuralHubInput:414` and `computeMiltonWideContext:371`.
- `src/lib/street-data.ts:284` `getStreetPageData`: queries 311-409 across DB2 and DB3. It returns sales by type, lease median and DOM, and lease median by beds.
- `src/lib/streetEnrichment.ts:66,85,116`: full-window count and median, and "any sale on record".
- `src/lib/hubStreetLadder.ts:116,161`: per-street count and median.
- `src/lib/tenureHubData.ts:102,154`: freehold/condo count, median, range, DOM.
- `src/lib/homepageData.ts:73`: 12 mo median.
- `src/lib/homeSignals.ts:76`: month-to-date count and median.
- `src/lib/rentSignals.ts:108` `getLeaseMarket`: lease count, days to lease, leased-to-ask, typical rent by type and unit class.
- `src/lib/heroIndex.ts:35`: distinct sold addresses per street.
- `src/lib/marketWatch/windows.ts:123,215,263,295`: weekly sold stats, by form, by hub and by street.
- `src/lib/brief/compose.ts:138`: brief sold count and typical.
- `src/lib/ai/buildBuildingAttributes.ts:223-291`: condo sale and lease medians by bed.
- `src/lib/ai/buildGeneratorInput.ts:129-300,1116` and `buildCondoBuildingInput.ts:82-228`: generator inputs.
- `src/lib/ai/neighbourhoodLookup.ts:130`: fallback.
- `src/lib/streetDecision.ts:186`: a count.
- `src/app/api/sync/vip-hubs/route.ts:57`: count by hub.
- Writers: `vow-sync.ts:1047` (sold sync), `sold-stats.ts:39-470` and `board/computeBoard.ts:97-279` (DB2 → DB3), `geni/neighbourhoodMatchStats.ts:30-86`.

**DB3 `analytics.*`, aggregates of DB2:**
- `sold-data.ts:158` `getNeighbourhoodSaleStats`: callers `streetMinimal.ts:95` and `market-pulse.ts:88`.
- `street-data.ts` (`street_sold_stats`, `street_monthly_stats`).
- `board/boardData.ts:9` (`board_stats`).
- `geni/neighbourhoodMatchRead.ts:26` (`neighbourhood_match_stats`), which reaches the condo pilots.
- `ai/neighbourhoodLookup.ts:97`.
- `streetDecision.ts:236`.
- **`src/app/api/sold-stats/route.ts:32-33` builds its own `neon(ANALYTICS_DATABASE_URL)` client, outside `db.ts`.** It is session-gated, but it shows that an accessor-only rule would miss a raw client.
- Dead: `sold-data.ts:88,111,132,181`, `components/vow/VowGate.tsx:44` (only `NeighbourhoodSoldBlock`, which nothing imports), `lib/stats.ts`, `geni/matchNeighbourhoods.ts`.

**DB1 `Listing` rows that are VOW records, or VOW columns:**
- `api/content/v1/market/daily-summary/route.ts:151-205`: yesterday's sold counts and average `soldPrice`, plus expired, leased and terminated counts by hub. It is gated by a `CONTENT_ENGINE_API_TOKEN` bearer token only.
- `rentals/page.tsx:106-122` and `rent/page.tsx:58-75`: the average rent by category averages every For Lease row **with no `leaseStatus` filter**, so leased rows are included while the tile reads "Live data from N active listings".
- Counts with no status filter, so sold, rented and expired rows are included:
  - `/streets` "N listings" and its sort (`streets/page.tsx:46-50`)
  - `/neighbourhoods` counts and its ≥5 threshold (`neighbourhoods/page.tsx:50-55`)
  - schools and mosques "Total listings" (`schools/[slug]/page.tsx:69-76`, `mosques/[slug]/page.tsx:69-76`)
- Average `daysOnMarket` of active rows: `listingsV2Data.ts:288-291` (the `/listings` "Avg days on market"), `api/street-stats/route.ts:37,51`.
- `megaLive.ts:642-680`: price-change counts (`lastPriceChangeAt`, which is price history).
- `streetDecision.ts:33,207-218`: sold count, the generator gate and SMS.

**VOW-derived values stored in DB1 and read back to pages:**

| Stored value | What is in it | Read back by |
|---|---|---|
| `ResidentialStreet.soldCount12mo` | 592 of 963 rows positive; written from `scripts/` | nav strips, hub ladder, hero search order, `streetMinimal` |
| `CondoContent.statsJson` | 59 of 59; typical price and range | `condoData.ts:72-79` |
| `MarketEdition.sectionsJson` | 4 editions | Market Watch, `hubFooter.ts:39`, `megaLive.ts:666` |
| `StreetContent.statsJson` | 719 | not rendered |
| `StreetGeneration.inputJson` | n/a | not rendered |
| `HubContent.statsJson` | n/a | not rendered |

**Caches:**
- **Next data cache:** every DB2 and DB3 fetch, tags `db2`/`db3`, 1 h (`db.ts:43-57`).
- **Upstash, sold-data keys:** `street-sale-stats:`, `street-lease-stats:`, `street-monthly-sales:`, `nbhd-sale-stats:`, `nbhd-lease-stats:`, `sold-list:street|nbhd|all:`, `milton-sold-totals`, `milton-sold-nbhds` (`sold-data.ts:90-417`).
- **Upstash, aggregate keys:** `sold-agg:overall-12mo-v3|by-type-12mo|by-nbhd-12mo-typical|quarterly` (`soldAggregates.ts:72-207`), `home:sold-mtd:*` (`homeSignals.ts:80`), `home:lease-market:v3:*` (`rentSignals.ts:114`).
- **Upstash, other:** `street-aggregate:` and `neighbourhood-aggregate:` (dead `VowGate.tsx:58`, and not in the purge list); `rentals:<scope>:v4` (`rentals/page.tsx:75`, holding the leased-row average).
- **In-process:** `_miltonWideCache` (`buildHubInput.ts:348`, 5 min) and `megaLive` `_cache` (`megaLive.ts:708`, 5 min).
- **Route caches:** `/api/streets/[slug]/card` and `/streets/[slug]/og.png` (24 h public), `/api/hero-index` (1 h public).
- **Which renders read them:** every one is read by an anonymous render except `sold-list:*` and the `sold-stats` path, which sit behind VOW gates today.

### 2. Anonymous surfaces carrying a VOW-derived value (production, 2026-09-30)

| Page type | Pages | What a signed-out visitor gets | Where |
|---|---|---|---|
| **Every page with the nav** | 1,355 of 1,355 + the 404 | **Sell panel:** typical, days to sell and sold-to-ask with samples (Board, DB3); **Sold this month:** count and typical; **Market Watch:** weekly sold count and edition summary; **Rent:** typical rent by type and basement, from leased records, with lease counts; **Landlords:** leased count, days to lease, leased-to-ask; **Streets/Sell strips:** "N sold", "Busiest streets"; **Buy:** price-change counts. These are serialized into the client `SiteNav` (RSC) and server-rendered in `hidden` panels | `megaLive.ts:196-202,286-341,383-445,467-484,600`; `megaContext.ts:29-81`; `SiteNav.tsx:210-376,790-875` |
| **Street** | 719 | **Hero:** typical price with range and basis (218 pages), "Transactions tracked", sale and lease pills with counts and typicals, "N closed sales in the last 12 months" gate line, "needs 5 sales, has N" silent note. **Glance tiles** (695 pages): sales tracked, typical sold, DOM, sold-to-ask, lowest/highest, 90-day activity (no k floor), market state, busiest month, leases. **Sidebar** facts. **Owner CTA** "Typical is $X". **Type cards:** typical, band, DOM, sold-to-ask, quarterly charts. **Sales/Leases cards**, **rent by beds**, **YoY sentence**. **Area context:** neighbourhood typical and "across N sales" (DB3). **resaleClaim** "No resales recorded" / "Too few recent sales". "Updated {latest sold date}". **Minimal shell:** neighbourhood sold count and typical. **Market prose:** see R1 | `components/street/v2/sections.tsx:40-58,122-161,232-242,264-270,356-362,432-539,775-835`; `StreetMinimalPage.tsx:35,111-135`; data `street-data.ts:671,819-1476`, `streetV2Data.ts:59-371` |
| Street JSON-LD | 63 | `Place.additionalProperty`: typical sale price per type and "across N sales"; `WebPage.dateModified` = latest sold date (all) | `lib/schema/street-schema.ts:162,217-233,374-378` |
| Street `og:image` | 632 point at `og.png`; 218 images draw a typical price, all 719 a sale/lease count | `streets/[slug]/og.png/route.tsx:59-60` ← `api/streets/[slug]/card/route.ts:18-28` |
| Street `og:modifiedTime` | 719 | latest sold date | `streets/[slug]/page.tsx:60` ← `street-data.ts:671` |
| `/streets` index | 1 | "N listings" counts sold/rented/expired rows and orders the list by them | `streets/page.tsx:46-50,121,152` |
| **Hub** `/neighbourhoods/[slug]` | 22 | **Meta description** (21): "typically $X, N sales in the last 12 months". **Hero lede**, "N sales here in 12 months" (22), **glance** typical and type share, **ladder** per-street count and typical (with `data-value`), **Milton compare**, **market commentary** (generated or fallback), **nearby** typicals and counts, **overview and FAQ prose** with raw figures (not stripped: 17 of 22 overviews and 15 of 22 FAQs hold `$` figures). **JSON-LD** `aggregatePrice` (21) and FAQPage | `lib/ai/hub/hubMeta.ts:57-65`; `components/hub/sections.tsx:98-148,203-237,258-303,372-402`; `hubData.ts:97-449`; `projectHubEntities.ts:111-118` |
| `/neighbourhoods` index | 1 | "Typical sold · 12mo" per card (RSC via `DirectoryGrid`); counts include sold rows | `neighbourhoods/page.tsx:50-127`; `neighbourhoodCards.ts:65,100` |
| `/freehold`, `/condos-guide` | 2 | hero "typical sold · 12 mo", "sold · last 12 months"; commentary "N sold … typical … about D days" | `tenure-sections.tsx:81-82,173`; `tenureHubData.ts:102-131,285-322` |
| **Condo** `/condos/[slug]` | 59 | "Typical price" and "Range" from `statsJson` (59); overview prose (43 of 59 hold `$` figures) and FAQ (38 of 59) with FAQPage JSON-LD. **Pilot pages** (4, all client RSC): sale median, lease median, yields, sale/lease mix, velocity, area typical (DB3), narrative | `components/condo/sections.tsx:69-72,146,250-259`; `condos/[slug]/page.tsx:149`; `BuildingAttributesPage.tsx:59-313`; `condoBrief.ts:30-48` |
| **Homepage** | 1 | Hero "typical Milton home" and "sold so far this month"; ValuationBand 12 mo count and sold-to-ask; hub ladder typicals and counts; **The Board** (headline, change chips, monthly series, price band, volume, days, sold-to-ask, supply; all 5 tabs in RSC); RSC-only `soldMonthTypical`, `dom`; AskBar "· N homes" (sold addresses) | `home/Hero.tsx:59-69`; `ValuationBand.tsx:51-63`; `NeighbourhoodLadder.tsx:29-58`; `TheBoard.tsx:40-207`; `page.tsx:52` |
| `/sold` | 1 | **Title and description** with typical, count, DOM, sold-to-ask; 30/90-day counts; the whole aggregate layer (median, band, by type, quarterly, by hub). The records table itself is gated | `sold/page.tsx:69-87,145-146,211-232`; `SoldAggregates.tsx:40-137` |
| Market Watch | 5 (index + 4 editions) | **Title, description and Article JSON-LD** carry the weekly sold count and typical; the whole page is sold stats plus a generated interpretation | `marketWatch/edition.ts:253-257`; `MarketWatchPage.tsx:67-230` |
| Guides | 4 of 9, plus the index | Neighbourhood costs, how to read a sold price, good time to sell, first home: medians, means, bands, DOM, sold-to-ask, quarterly, FAQ JSON-LD; index "sales behind the figures" | `lib/guides/guides.ts:175-681`; `guides/index.ts:94`; `guides/[slug]/page.tsx:81` |
| `/compare/freehold-vs-condo` | 1 | typical sold, sold count, DOM per side; full `compareFacts` in RSC | `ComparePage.tsx:122-124,229-231` |
| `/value/[neighbourhood]` | not in the sitemap | "N homes sold … typical sold … median days" (really a mean) | `ValueLanding.tsx:45-47` |
| `/listings` | 1 | "Avg days on market" (DOM) | `listingsV2Data.ts:288-291` → `sections.tsx:80` |
| `/listings/[mls]` | 488 | "Typical rent" from leased records, lease counts and through date (sale listings) | `listings/[mlsNumber]/page.tsx:192-211` → `ListingExtras.tsx:443-462` |
| `/rentals`, `/rent` | 2 | per-category average rent and count including leased rows | `rentals/page.tsx:106-122`; `rent/page.tsx:58-86` |
| Schools, mosques | 29 + 7 | "Total listings" counts sold/rented/expired rows | as §1 |
| 404 | every `notFound()` | the mega menu | `not-found.tsx:4,15` via `SiteChrome` |
| Geni area-finder | 0 | nothing renders (`matchNeighbourhoods` has no caller) | n/a |

Clean: listing detail per-row VOW facts (gated since MC-029), the address ladder, `/saved`, ads and thank-you pages, the footer's values (it only sorts by `recencyWeightedSold`), the listing head (the 488 `$` in meta descriptions are asking prices).

### 3. Non-HTML surfaces

- **Signed-out API routes with VOW values** (all 61 `/api` routes and 4 other route handlers enumerated; the rest are session-, VOW-, admin- or cron-gated or carry nothing):
  - `/api/streets/[slug]/card`: typical sale price (218 of 719) and sale/lease counts (719).
  - `/streets/[slug]/og.png`: draws the card.
  - `/api/hero-index`: sold addresses per street.
  - `/api/street-stats`: average DOM.
- **Other callers:**
  - `/api/leads/create` returns market-pulse stats (DB3 neighbourhood aggregates) to an anonymous form submitter (`lead/ingest.ts:363-376,450,462`).
  - `/api/content/v1/market/daily-summary` sends sold and leased aggregates to the ContentEngine token holder.
- **JSON-LD:** street `additionalProperty` and `dateModified`, hub `aggregatePrice` and FAQPage, condo FAQPage, guide FAQPage, Market Watch `Article.description`.
- **RSC:** the nav on every page, the homepage `data` and Board, the condo pilots, `/compare`, `/neighbourhoods` cards, `/rentals`, `/rent`, and `ListingExtras` rent. The flight payload also repeats every visible server-rendered value.
- **OG:** only the street `og.png`. The root `opengraph-image.tsx` is static.
- **Sitemaps, feeds, robots, manifest:** clean. The video sitemap description is the Town coverage sentence. There are no feeds.
- **Caches:** see §1. Every anonymous-read cache listed there holds VOW-derived values.
- **Middleware:** does no gating (canonical redirects only).

### 4. Email and SMS (report only; Leads fixes)

- **Daily brief** (`brief/compose.ts:138-351`, sent by `api/brief/send/route.ts:93-178`, cron weekdays 13:15 UTC). It carries:
  - "N homes sold, at a typical $X"
  - "On {street}: a home sold" / "Nearby, a home on {street} sold"
  - the subject line "{n} sold, {m} new"

  It goes to `SavedSearch kind="brief"` email-only signups, who are **not registered VOW users**. This is the §6.2(a) finding.
- **Internal SMS to Aamir** (`generateStreet.ts:692-697`): the 12-month sold count. Brokerage-internal; flagged, not a consumer surface.
- **Clean:** deal alerts (active only), sign-in, reviewer mails, lead confirmation and ops alert, kvCORE, the leads digest, the SEO digest.
- **Dead:** `email.ts` `notifyNewLead` has no callers; it would print a sold row's list price.
- **Outside VOW, raised by the sweep:** `vercel.json:22-66` hardcodes the cron secret in six cron paths, and 23 routes accept `?secret=`. `middleware.ts:31` hardcodes a dormant preview secret.

### 5. IDX-only equivalents (report only, nothing built)

| VOW figure | IDX-only equivalent | Exists today? |
|---|---|---|
| Street hero typical price, sidebar typical and band | typical **asking** of the street's active listings | No. `streetDecision.ts:270` computes `medianListPrice` for generation only. It would need a render-path field and the label "asking" |
| Street type cards | "Active listings" cell and "avg list $X" | **Yes** (`street-data.ts:1050`), labelled "avg list", not "asking" |
| Street glance and hero counts | "Active right now" | **Yes** (`street-data.ts:889-893,1339`) |
| Similar streets | "N active · avg $X" | **Yes** (active only), labelled "avg", not "asking" |
| Hub typical, ladder, nearby | active count per hub/street; asking range | Counts **yes** (`hubData.ts:186-189,265-272`); asking typical no |
| Tenure hubs, compare | `medianList` (active asking median) | **Yes** (`tenureHubData.ts:232`, `comparisonData.ts:244-245`); compare already labels it |
| Condo typical and range | active asking in the building | Fetched (`condoData.ts:96-126`), not summarised |
| Rent menu, listing "Typical rent" | typical **asking** rent of `PUBLIC_LEASE_WHERE` rows by type | No. The cards already say "Asking rents" in places |
| `/rentals`, `/rent` averages | the same average over active leases only | Yes, one filter away |
| Homepage hero typical, Board, ladder | typical asking, active counts | Active counts **yes**; asking typical no |
| Days on market, sold-to-ask, sold counts, price changes, market state, busiest month, days to lease, leased-to-ask | none | n/a |
| `/sold` aggregates, Market Watch, sold-price guides | none; they are sold statistics by nature | n/a |

### 6. Rulings owed before Stage 1

Each has a recommendation. Stage 1 builds nothing new, so every recommendation below is either a removal or the neutral line.

- **R1. Street prose.** 702 of 704 published generations carry a `market` section, and 684 a `neighbourhoodComparable` section, written from VOW aggregates. The render strips numeric sentences, but qualitative claims derived from sold data survive ("prices have firmed", "the range has compressed", buyer/seller context from DOM). Regeneration is barred.
  - **Recommend:** drop the `market` and `neighbourhoodComparable` sections from the anonymous render, and extend the FAQ filter to drop answers on price, sales or time-to-sell topics.
  - **Question:** do FAQ answers from the evaluative half need the same cut?
- **R2. Hub and condo prose.** It renders unstripped, with raw figures in 17 of 22 hub overviews, 15 of 22 hub FAQs, 43 of 59 condo overviews and 38 of 59 condo FAQs.
  - **Recommend:** drop the hub `liveMarket` and `comparedToMilton` paragraphs and the fallback line.
  - Apply `stripNumericSentences` plus the R1 topic filter to hub and condo overview and FAQ.
  - FAQPage JSON-LD follows the filtered set.
- **R3. Condo pilot pages (4).** Almost every value on them is VOW-derived.
  - **Recommend:** serve the standard condo template for these four until Stage 2.
- **R4. Heads outside the street freeze.**
  - **Hub meta descriptions** carry the typical and the sale count (21 pages).
  - **`/sold`, Market Watch (5) and the guide titles and descriptions** carry figures.
  - **Recommend:** figure-free descriptions using Town and active-listing wording. Hub titles and H1 stay. **This changes 21+ hub heads inside the MC-048 window**, which the freeze does not cover, but it is a ranking change the Architect should own.
- **R5. Street `og:modifiedTime` and `WebPage.dateModified`.** Both are set from the latest sold date. They are head fields but not on the frozen list (title, description, canonical, robots, H1).
  - **Recommend:** `generatedAt` only.
  - The `og:image` URL stays; the image drops the figure and count.
- **R6. Whole pages that are sold statistics:** `/sold` aggregates, Market Watch (5 URLs), the four sold-price guides, `/compare`'s sold rows, `/value/[neighbourhood]`.
  - **Recommend:**
    - `/sold` keeps its gated table, and the aggregate layer goes (the neutral line in its place).
    - Market Watch and the four guides: remove the figure blocks and keep the pages where the remaining text stands on its own. If it does not, noindex them and drop them from the sitemap until Stage 2.
  - **Architect call:** how many of those pages survive as pages.
- **R7. Homepage.** The Board, the hero typical, "sold this month", the ValuationBand and the ladder's typical all go.
  - **Recommend:** the hero keeps its active and new counts, and the ladder ranks by active count.
  - The Board goes whole, with the neutral line in its place. This is the largest visual change in Stage 1.
- **R8. Mega menu.** Remove:
  - the Sell panel figures and Sold this month
  - the Market Watch sold count and summary
  - Rent "Typical rent" and Landlords
  - the "N sold" and "Busiest" strips
  - Buy price-change counts (price history)

  **Recommend:** each panel keeps its links and active counts. Asking rents are an IDX replacement and are left for Stage 2.
- **R9. Ordering by sold volume with no figure shown:** autocomplete, hero search, footer top streets, hub ladder order, nav "Busiest streets".
  - **Recommend:** anything labelled as sold-derived goes, and unlabelled orderings switch to active count or alphabetical. The rank itself discloses relative sold volume.
- **R10. Existence and count claims.**
  - Remove "No resales recorded" / "Too few recent sales", "needs 5 sales, has N", and the gate line's "N closed sales".
  - Per the brief, the neutral line carries no count or status.
- **R11. Leaks through status-blind DB1 counts:** `/streets`, `/neighbourhoods`, schools, mosques, `/rentals`, `/rent`.
  - **Recommend:** add the public-row filter (`status: "active"` / `PUBLIC_LEASE_WHERE`). This keeps the same label and makes it true. It is a correction, not new UI.
- **R12. Average DOM of active listings** (`/listings`, `/api/street-stats`).
  - **Recommend:** remove; DOM is on the VOW list.
- **R13. "New this week" / "new in 24h"** (from `listedAt` on active rows).
  - **Recommend:** keep. It is a count of active IDX listings and discloses no DOM for any listing.
  - The Architect may rule it out; the leak test would then add it.
- **R14. `/api/content/v1/market/daily-summary`** (bearer token, to ContentEngine).
  - **Recommend:** drop the sold, leased, expired and terminated fields.
  - Is ContentEngine a brokerage service under item 40? If its output publishes, it is not.
- **R15. `/api/leads/create` market-pulse response** to anonymous submitters.
  - **Recommend:** remove the stats from the response.
- **R16. The one door and system readers.** Cron jobs (sold sync, compute-sold-stats, compute-board, compute-geni, the generators) have no user session.
  - **Recommend:** one server-only module (`src/lib/vow/door.ts`) with two entry points:
    - `withVowReader(session)`: a verified, acknowledged session via `canSeeVowRecords`, else refuse.
    - `withVowSystem(cronAuth)`: accepts only a verified cron credential, and only on routes under `src/app/api/{sync,jobs,admin}`.
  - Everything that reads DB2/DB3 moves behind it. A prebuild test fails any other import of `getSoldDb`/`getAnalyticsDb`/`requireSoldDb`/`requireAnalyticsDb`, any `neon(` of `SOLD_`/`ANALYTICS_DATABASE_URL`, any `sold.`/`analytics.` SQL string, any Prisma `Listing` read of a non-public status or VOW column, and any read of `soldCount12mo`/`statsJson`/`MarketEdition` outside the door.
  - **Question for the Architect:** the generators' VOW inputs. They are cron-only and off (`STREET_REGEN_ENABLED` unset), and rule 3 forbids prompt changes. So in Stage 1 they sit behind `withVowSystem`, and their public use waits for Stage 2's ruling.
- **R17. Brief email** (§6.2(a)): Leads' fix. Until then, does Core pause `/api/brief/send`?
  - **Recommend:** yes. Hold the cron; a paused send is a one-line change in `vercel.json`.
- **R18. Stale caches after deploy.**
  - **Recommend:** Stage 1 deletes the `sold-agg:*`, `home:sold-mtd:*`, `home:lease-market:*`, `nbhd-*`, `street-*`, `street-aggregate:*`, `neighbourhood-aggregate:*` and `rentals:*` Upstash keys on deploy.
  - Door-side reads get user-scoped keys (or none), and the 24 h card and OG caches are purged by path.

### 7. What registered readers lose at Stage 1 (preview of the Stage 1 report)

Every street, hub, condo, homepage, menu and Market Watch aggregate above goes for **everyone**, signed in or not, because Stage 1 builds no gated UI. What they still have:
- the per-row sold records on each street (the island)
- `/sold`'s record table
- listing-level DOM, price history and sold price through `ListingVowFacts`
- `/api/sold-stats`

### Files
- `scratchpad/mc046/stage0-count.mjs` and its log `stage0-count.log`
- `scratchpad/mc046/stage0-db-counts.mjs`
- `scratchpad/mc046/stage0-market-sections.mjs`
- this report

No file outside Core's lane was touched.

**STOPPED AT GATE A.** Stage 1 starts on the Architect's rulings R1 to R18.

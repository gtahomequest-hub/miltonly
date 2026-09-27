# MA-005
AUDIT · D:\miltonly-audit · feat/audit

## MA-005: the neighbourhood hub page on production, five hubs, two widths

Read-only. Nothing on a page was edited. Production at `1b2d7d8`, 2026-09-16 late evening (Toronto), a few
hours after the MC-025 merges. Tooling under `scripts/audit/` (`hubs.json`, `hub-sweep.mjs`, `hub-page.mjs`,
`hub-intents.mjs`, `hub-lighthouse.mjs`, `hub-inbound.mjs`, `hub-bench.mjs`); raw output under
`scratchpad/audit/MA-005/` (per-hub JSON at 1440 and 390, full-page, fold and ladder screenshots, crops,
Lighthouse JSON, the 22-hub sweep, the intent-destination probe, the inbound crawl of 1,198 sitemap URLs,
benchmark captures), untracked. `origin/main` was merged into `feat/audit` first (one conflict in `QUEUE.md`,
both sides kept).

### The five hubs

Chosen from the 22-hub sweep, not from memory: the named large urban hub, the smallest urban ladder, a rural
hub with no film, the only sub-k hub, and the hub with the most filmed streets.

| hub | shape | Lighthouse perf m / d | LCP m / d | TBT m | weight | screens d / m | price fact (m, px) | first seller CTA (m, screens) | closing CTAs (m) | first email field (m) | ladder rows / screens (m) | body links in |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| timberlea | large urban, 24 street pages, 2 filmed, 3 condos, 3 schools | 69 / 98 | 5.1s / 1.1s | 313 | 1.0 MB | 10.7 / 16.9 | 573 to 746 | 0.39 | 13.6 | 14.6 | 24 / 2.9 | 41 |
| bronte-meadows | small urban, 8 street pages, registered `rural_hub` | 79 / 95 | 3.7s / 1.4s | 396 | 0.9 MB | 6.9 / 11.6 | 546 to 719 | 0.36 | 8.2 | 9.2 | 8 / 1.0 | 25 |
| nassagaweya | rural, 12 road pages, no film, no school, no condo | 61 / 98 | 5.2s / 1.0s | 518 | 0.9 MB | 6.5 / 10.6 | 573 to 746 | 0.39 | 7.2 | 8.2 | 12 / 1.6 | 14 |
| moffat | sub-k, 3 sales in 12 months, no price, 2 road pages | 61 / 95 | 5.2s / 1.4s | 497 | 0.9 MB | 5.4 / 8.6 | 525 to 698 | 0.36 | 5.3 | 6.3 | 2 / 0.3 | 6 |
| ford | video, 49 street pages, 19 filmed, 2 condos, 2 schools | 85 / 91 | 3.6s / 1.9s | 247 | 1.5 MB | 11.9 / 18.4 | 546 to 719 | 0.36 | 15.1 | 16.0 | 49 / 5.9 | 64 |

m = 390×844 mobile emulation, Lighthouse slow-4G Moto G class; d = 1440×900. "screens" is document height over
viewport height. "price fact" is the document position of the first glance tile, so the typical price is inside
the first phone screen on every priced hub. "first seller CTA" excludes the site nav (whose "What's my home
worth?" sits at 0.02 on every page); the 0.36 to 0.39 figure is the "I'm selling" intent square. "body links
in" counts sitemap pages linking to the hub outside the header, menu and footer (the footer names all 22 hubs on
all 1,197 other pages, so the raw count is 1,197 for every hub). Lighthouse SEO 100 and accessibility 100 on
all ten runs; best practices 78 or 79 on every run for the same two third-party-cookie reasons as MA-001. CLS
was 0.000 everywhere. LCP element was the lede paragraph on nine of ten runs.

### What holds up

Before the defects: the head is right on every hub (title in searcher word order with no figure in it, the
live k-gated hook first in the description, a self-canonical, `index, follow`, one H1, breadcrumb schema, five
valid JSON-LD blocks, zero 4xx requests, zero layout shift). The four intent squares all resolve and all carry
the hub: the buy square lands on a listings page filtered to the hub with the promised count, the rent square on
a page headed "Find your next home in Timberlea", the sell square on `/value/timberlea`. The glance panel is
derived and every tile prints its basis; sub-k Moffat states "3 sales in 12 months, below the publication
floor of five" instead of a price, and its market standfirst says the same. The ladder is every published
street, ranked, each with the street page's own figure and its sample, and it agrees with the JSON-LD ItemList
row for row. Nearest neighbourhoods carry a distance with a stated method. Sibling prices are suppressed below
five sales. The footer brief signup records the hub on the lead row (`BriefSignup.tsx:56`), so that MA-004
defect is closed. Once warm, every hub answers in 100 to 145 ms.

## Defects, ranked

Severity: **S1** loses clicks or leads on every hub today or breaks a repo rule; **S2** loses them on a class of
hubs or costs ranking signal; **S3** quality; **S4** polish. "all" means observed on all five, and where the
22-hub sweep confirms it, on all 22.

### S1

**1. Every paragraph of prose and every FAQ answer is a June snapshot, and the figures inside them contradict
the live tiles on the same screen.** All 22 hubs were generated 2026-05-30 to 06-03 and last touched 07-19
(`HubContent.updatedAt`); the live figures moved and the prose did not. Timberlea: the market section says
"102 sales and 45 leases" under a standfirst that says 95; the overview says "roughly 25 active listings" beside
a tile that says 17; the prose says "the Milton-wide typical of $1,025,000" beside a compare row that says
$1.01M; the FAQ says "generally in line with Milton's overall average" beside "-7% vs Milton". Ford: "186 sales"
against 156, "40 active listings" against 32, "Milton-wide typical of about $1,029,000" against $1.01M.
Nassagaweya: the market paragraph says "the small number of sales makes a typical price difficult to state
with confidence" directly under a row that states $1.83M and "+82% vs Milton"; the FAQ says "12 sales over the
past year and 12 active listings" against 17 and 16, and a detached typical of "$1,625,000" against a page
where 100% of sales were detached at $1.83M. Bronte Meadows: "16 sales", "$990,000" and "$987,000" against 17
and $955K. The same answers are pushed to Google as `FAQPage` JSON-LD (`page.tsx:96`), so the SERP carries
the stale number too. The stored meta description was retired for exactly this drift (`hubLive.ts:14-19`);
the body was not. `hubData.ts:325` (sections), `hubData.ts:357` (FAQs), `sections.tsx:260`, `:301`, `:381`.
All, both widths.

**2. The hub's Milton typical and the sold page's Milton typical are different statistics with the same
label, and the "I'm investing" square joins them.** The hub's typical is `AVG(sold_price)`
(`buildHubInput.ts:232`, `hubStreetLadder.ts:15`); `/sold` titles itself on `overall.medianPrice`
(`src/app/sold/page.tsx:68`). Same 1,717 sales, "Milton $1.01M" on the hub, "Typically $930,000 Across 1,717
Sales" one click later. The "I'm investing" square promises "95 sales here in 12 months" and lands on a page
headed "Milton sold homes" whose gate says "See every Milton sold price", whose neighbourhood chip row shows
ten hubs so Timberlea (and 11 others) has no active chip, and whose sign-in link is `/signin?redirect=%2Fsold`,
dropping `nbhd` (`src/app/sold/page.tsx:223-231`). The reader has no sign the page is Timberlea's, and if
they sign in, it is not. All.

**3. There is no lead capture on the hub body.** Zero forms between the hero and the footer on all five hubs
at both widths. The seller path is a click to `/value/<slug>`; the buyer path is a click to a `noindex`
listings grid; the only email field on the page is the footer brief at 14.6 screens (Timberlea) and 16.0
screens (Ford) on a phone, labelled "Send me the brief" with no mention of the hub on the label or the fine
print (the row records it; the reader cannot tell). The two closing CTA cards are at 13.6 and 15.1 screens.
Zolo puts "Alerts" and "How Much is My Home Worth?" in the first phone screen of its Timberlea page;
Rightmove puts "Create Alert" and "Save Search" in the first screen of Beeston. `HubPage.tsx:62-73`,
`sections.tsx:435-452`. All.

**4. Bronte Meadows is registered `rural_hub`, and the registry leaks to the SERP and to two rural hubs.**
`Neighbourhood.profile = rural_hub` for `bronte-meadows`, so its title is "Bronte Meadows, Milton: Homes,
Prices and Road Guide" and its description says "Road-by-road guide" (`hubMeta.ts:49-51`, `hubLive.ts:95`)
over a page whose own lede calls it "a settled residential pocket on Milton's eastern edge" and whose ladder
is headed "Every street in Bronte Meadows". The same flag makes it a "rural neighbourhood": Moffat and
Nassagaweya, which have no Town polygon, take the first four `rural_hub` rows alphabetically
(`hubData.ts:80-82`, `hubNearby.ts:50`), so both list Bronte Meadows ($955K, 8 street pages) under "Other
rural neighbourhoods", and Nassagaweya, Rural Milton West and Rural Trafalgar are never a sibling of any
polygon-less rural hub (Nassagaweya has 0 inbound hub links; Bronte Meadows has 10).

### S2

**5. Every hub renders synchronously for its first visitor after a deploy or a tag drop, 2.4 to 4.0 s.** At
03:24Z, 21 of 22 hubs answered `MISS` or `REVALIDATED` at p50 2.9 s (the `1b2d7d8` deploy had emptied the
cache); 27 minutes later all 22 answered `HIT` at p50 120 ms. `generateStaticParams` returns nothing by design
(`page.tsx:28-30`) and the sold sync and analytics jobs drop the `db2`/`db3` tags every hub reads, so the
render-on-visit recurs on every job and every deploy, and Googlebot is often that visitor. Google's TTFB
target is 800 ms. All 22.

**6. Mobile LCP is 3.6 to 5.2 s on every hub, and 4.4 s of Timberlea's 5.1 s is render delay.** The LCP
element is the lede paragraph, blocked on 321 KB of fonts across seven files (two of them `.woff`, not
`.woff2`) and 383 KB of Facebook (193 KB, 290 ms blocking) and GTM (190 KB, 158 ms) scripts, plus 300 to
450 ms of render-blocking CSS. Total blocking time 247 to 518 ms. Identical in shape to MA-001 defect 3 and
fixed by the same change. All, mobile.

**7. The seller landing the hub sends every seller to says "median", uses em-dashes throughout, and tags
every hub lead as a door-hanger.** `/value/<slug>`: "median days on market 90" (`ValueLanding.tsx:45`), six
em-dashes in the three hero sentences (`:47-51`), and `source="doorhanger-valuation"` on the form
(`ValueLanding.tsx:75`), so a Timberlea hub seller and a door-hanger seller are the same row and the same GA4
source. The form itself is five fields plus a consent box; the hub context reaches the row only as the typed
address. Not the hub file, but it is the hub's only seller path. All.

**8. The street pages and the ladder disagree about who belongs to the hub.** The ladder is the registry
(`ResidentialStreet.neighbourhoodId`, `hubData.ts:303-318`); a street page's "Explore the X area" up-link is
the sold records' neighbourhood strings on that street (`street-data.ts:1520-1551`). Result on the five:
`dawson-crescent`, `heslop-road` and `laurier-avenue` link up to Bronte Meadows and are not in its ladder
(Laurier Avenue is in Timberlea's); `whitlock-avenue` and `farmstead-drive` link up to Ford and are not in
its ladder; `first-line` links up to Moffat and is not in its ladder; `sixth-line` (rank 1 in Nassagaweya)
and `cedar-trail` (rank 1 in Moffat) do not link up to their hub at all. Seven streets on five hubs; the
22-hub figure is larger.

**9. The ladder prints a price beside "1 sale" or "0 sales".** A street below five 12-month sales falls back
to its full-window typical (`hubStreetLadder.ts:15-16`), so the row reads "Roseheath Drive · 1 sale · $925K",
"Harvest Drive · 0 sales · $975K", "Jean Landing · 1 sale · $925K", with "across 9 sales in the last ~2 years"
in 12 px grey underneath. The number is k-safe; the row's hierarchy says a single sale's price. 5 of 8 rows on
Bronte Meadows, 18 of 49 on Ford, rank 1 on Nassagaweya ("3 sales · $3.9M"). The standfirst says "ranked by
sales in the last 12 months" while a 0-sale row shows a price and a 3-sale row shows none. `sections.tsx:203-214`.

**10. The condo section is capped at six and says so as if it were the total.** `condosFor` slices to six
(`hubData.ts:54`); Dempsey has 17 published buildings and its hub says "6 buildings with a page of its own",
Cobban and Old Milton 8 and say 6. The only overflow is "All buildings", Milton-wide. Each card is a name
with nothing under it: `meta` is never populated (`hubData.ts:54-57`, `sections.tsx:359`). 3 of 22 hubs
under-count; all 11 hubs with condos show bare names.

**11. The Open Graph and Twitter card on every hub is the site's generic card.** `generateMetadata` sets
title, description and canonical only (`page.tsx:44-48`); `og:title` is "Milton Real Estate Encyclopedia |
Miltonly", `og:description` the site blurb, `og:image` the generic `/opengraph-image`. A shared hub link
shows no neighbourhood, no price. All 22.

**12. The market section is one row and a wall.** One compare row (typical, Milton, delta) and then 450 to
700 words of generated prose that carry the year-on-year, the quarterly arc, the per-type typicals, days on
market and the lease count as sentences, none of them live (defect 1). On a phone the section is 1.5 to 2.2
screens with one figure in it. Rightmove's Beeston page states the average, the per-type averages and the
change on last year and on the peak in three sentences at the top, then lists every sale. `sections.tsx:269-307`.

### S3

**13. `hh-source` says "recomputed on every request".** The route is day-ISR with hourly tag revalidation
(`page.tsx:26`). `hubData.ts:352`, `sections.tsx:303`. All.

**14. FAQ answers name streets by raw strings and point at a section that does not exist.** "Laurier Avenue
South", "Ontario Street South" (Timberlea), "Etheridge Avenue South" (Ford) are not the registry names the
ladder prints two screens above (`resolveStreetName` is the only source of a street name on any surface).
Moffat, Nassagaweya and Bronte Meadows answer "Which roads are in X?" with "see the projected roads section on
this page"; no section is called that. Timberlea's "Which streets" answer lists Laurier, Ontario and Childs as
the most active; the ladder says Childs, Ontario, Centennial Forest.

**15. Voice-rule words in the served prose.** "median" on Timberlea (FAQ), Bronte Meadows (twice, "Quarterly
medians"), Nassagaweya and Ford; "average" three to five times per urban hub; "best" on Moffat and Ford,
"ideal" on Timberlea and Nassagaweya. Generation-time text, so only a regeneration or an edit pass clears it.

**16. Price-range endpoints are single transactions.** "individual trades spanning from roughly $475,000 at
the entry end to about $1,575,000" (Timberlea, 95 sales), "recent sales ranging from $645,000 to $1,230,000"
(Bronte Meadows, 16 sales, in the FAQ and the FAQ schema), "$775,000 to $3,600,000" (Nassagaweya, 17 sales).
This passes the repo's k10 range rule (`buildHubInput.ts:105-108`), and on a 16-sale pool the top figure is one
identifiable house. Core's call whether the range should round to $25K or be dropped below a higher floor.

**17. The ladder repeats its sample on every row and is 5.9 phone screens on Ford.** "13 sales" and then
"across 13 sales in the last 12 months" on the same row, 24 to 49 times; the bar is hidden under 900 px
(`hub-sections.css:635`) so the rank is the only visual order. Ford's reader scrolls 5.9 screens of ladder
(rows 98 to 127 px) before "What Ford is like" at 8.2 screens; the 19-poster filmstrip above it scrolls
4,732 px horizontally with one poster visible. No house-number or name input, no collapse. `sections.tsx:190-249`.

**18. Font floors and small targets.** The `FILM` badge is 9.5 px (`hub-sections.css:356`, 19 on Ford), the
frame label 10 px (`:283`), the guide category 11 px; the four `hh-headaction` links are 22 px tall
(`hub-sections.css:231`), the breadcrumb links 19 px, footer inputs 22 px. Lighthouse passes target size on
spacing; a thumb does not. All.

**19. `RealEstateAgent.logo` on every page is a 404.** `https://miltonly.com/logo.png` answers 404; the
schema (`generateLocalBusinessSchema`) cites it on every hub. Site-wide, surfaced here because the hub carries
five JSON-LD blocks and this one fails validation.

**20. Two `Place` nodes for one entity, with relative URLs.** `projectHubSchema` emits `Place` "Timberlea,
Milton" with an ItemList whose `url`s are `/streets/...` (relative); `generateNeighbourhoodSchema` emits a
second `Place` "Timberlea, Milton Ontario" with `url` and `description`. No `@id` joins them, neither has
`geo`, and there is no `dateModified` anywhere on the page. `page.tsx:71-93`.

**21. The description is 153 to 218 characters on all 22 hubs and promises "what they really sell for".**
Google cuts at about 160; the hook is first, so the cut is survivable, but every hub's snippet ends
mid-sentence. The promise is the phrase the page cannot keep unauthenticated. `hubMeta.ts:65`.

### S4

**22. The H1 is the bare name.** "Timberlea", no "Milton", no "homes" or "prices"; Zolo's is "Timberlea Real
Estate, Milton". The title carries the words, the H1 does not. `sections.tsx:119`.

**23. The desktop hero is half empty.** At 1440 the lede is a 550 px column; the right half of a 484 px hero
is bare green, and the price is a 25 px tile below it (`hub-sections.css:161`). Nothing on the first desktop
screen is larger than the H1.

**24. The breadcrumb says "Milton" where the schema says "Home", and the guide section drops the numbering
device.** `sections.tsx:77` versus `page.tsx:77`; "Read alongside Timberlea" is a 20 px H2 with no index
number between "07" and "08".

**25. `/neighbourhoods` (the breadcrumb parent) titles itself with an em-dash and an ampersand.**
`src/app/neighbourhoods/page.tsx:40`.

## The benchmark

Fetched live 2026-09-16 (`scratchpad/audit/MA-005/bench/`). HouseSigma serves a client-only shell that
renders "Page not found" to headless Chrome at both community URLs tried, so it is described from its public
design; Realtor.ca blocked the phone user agent (403) and has no neighbourhood page for Milton, so its city
page at 1440 stands in.

| | what the page does | what they do better | what Miltonly does that they cannot |
|---|---|---|---|
| **Zolo** (`/milton-real-estate/timberlea`) | "Timberlea Real Estate, Milton", 3 listings (one of them a rural Sixth Line acreage tagged "MI Rural Milton"), sold prices gated, "How much is your home worth?" as an H2 with an instant estimate, "Alerts" and "Save" in the first phone screen, a FAQPage schema, listings as `Event` schema | Alerts and the estimate in the fold; the neighbourhood name in the H1 | A typical with a basis, a street ladder, filmed streets, honest suppression; Zolo's Timberlea has three listings and a wrong one |
| **HouseSigma** (community page, public design) | Sold history and a SigmaEstimate per address behind a free account, community stats, school ratings, "Watch" per community | The watch button on the community; the per-address estimate | Everything unauthenticated; the ladder; the road facts |
| **Realtor.ca** (city page; no Milton neighbourhood pages) | 636 listings, HPI benchmark and a ten-year chart, "Save Search" in the fold, `Product` schema | The value chart with axes and a year-on-year figure | Everything below the city grain |
| **Rightmove** (`/house-prices/beeston.html`) | Meta description leads with the average; first three sentences state the average, the per-type averages, and "4% down on the previous year and 4% down on the 2022 peak"; 12,524 sales listed with "See what it's worth now" on each; "Agent Property Valuation"; filters by area, year, type, tenure | The three-sentence market read at the top with the year-on-year; a valuation on every row; sale-level depth | Ontario data Rightmove does not have; the street grain; film |

Plainly: the benchmarks win on three things. An alert or watch in the first screen (Zolo, HouseSigma,
Rightmove's "Create Alert"), a market read whose every number is live and dated (Rightmove), and a valuation
prompt on the row, not at the bottom (Rightmove, Zolo). Miltonly wins on the ladder, the film, the basis under
every figure, and on saying nothing it cannot back, except where the June prose says it for it.

## The ten changes, in order of expected effect on clicks and leads

1. **Make the prose read the live aggregate or say nothing.** Either regenerate the 22 hubs on a schedule
   that tracks the sold sync, with the same `getHubInputCached` figures the tiles use and the FAQ rewritten
   from the same input, or strip every figure from the stored sections and let the tiles and one templated
   sentence per section carry the numbers. Until then, drop `FAQPage` from the hub schema (`page.tsx:96`).
   Expected: the page stops contradicting itself on every hub, the SERP stops carrying June's number, and
   the "we say what it really sells for" claim becomes true on the page that makes it.
2. **Put a hub-scoped capture in the first two phone screens.** One email field under the glance panel with
   two intents already on the page: "Watch Timberlea" (every new listing and every closed sale, weekly) and
   "Own here? Get the written valuation" (address plus email, posted with `neighbourhood` set), through
   `postLead`. Rename the footer brief on the hub to "The Timberlea brief". Expected: a lead path that does
   not leave the page, on a surface that today has none.
3. **Cache the hub like a page, not a query.** Serve stale while revalidating after the tag drops (or
   revalidate the 22 hub paths from the sold sync itself, in the background, the way street pages are
   revalidated on write), and prerender the 22 at build. Expected: TTFB from 2.9 s to under 200 ms for the
   first visitor after every deploy and every job; the one change here that moves ranking on all 22.
4. **Cut the render-delay budget** (MA-001 change 3, unchanged): fonts to `.woff2` with only the faces the fold
   uses, Facebook and GTM after first interaction or idle, the two render-blocking stylesheets inlined for the
   fold. Target mobile LCP under 2.5 s and TBT under 200 ms on every hub.
5. **One word, one statistic.** Decide whether "typical" is the mean or the median across the site, and make
   `/sold`, the hub and the ladder agree; then make `/sold?nbhd=` say the hub in its H1, show the active chip
   for all 22, and keep `nbhd` through sign-in. Expected: the "I'm investing" square stops landing on a page
   that contradicts the one it came from.
6. **Fix the registry row and the rural sibling rule.** `bronte-meadows` to `urban_hub`, which corrects its
   title, description and siblings in one write. For polygon-less rural hubs, pick siblings by the rural
   tier's own order (sales, or a hand-set neighbour list), not alphabetically, so Nassagaweya, Rural Milton
   West and Rural Trafalgar get a sibling link.
7. **Rebuild the market section as the live read Rightmove prints.** Per-type typicals with their samples
   (the data is already in `byType`), days on market, the lease count, and a year-on-year sentence where the
   window allows, as rows with a basis, above one short paragraph. Drop the quarterly-arc prose or render it
   as bars with values. Expected: the section that answers the price question stops being a wall.
8. **Make the ladder legible as a ranking.** Full-window rows say "no 12-month sale · $925K over 9 sales
   since 2024" in one line, never "1 sale · $925K"; the sample line replaces the sales figure instead of
   repeating it; rows past twelve collapse behind "Show all 49" with a street-name filter; the `FILM` badge
   at 11 px or an icon. Expected: Ford's reader reaches "What Ford is like" in two screens, not eight.
9. **Reconcile who belongs to the hub, once.** The street page's up-link and the hub's ladder must read the
   same source (the registry, per the Names rule); a street whose sales carry a hub string but whose registry
   row points elsewhere is a data fix, not two truths. Then lift the condo cap or add the hub's own overflow,
   and give each condo card its unit count and typical.
10. **Give the hub a card and a date.** `openGraph` and `twitter` from the same `getHubMetaLive` result with a
    rendered image of the typical price; `dateModified` in the schema and an "Updated" line under the glance
    panel; one `Place` node with `@id`, absolute URLs and `geo`; fix `logo.png`; cap the description at 155
    with the hook intact.

After these, a searcher typing "timberlea milton" lands on a page that loads in under a second, states the
price with its basis in the first screen, says the same number everywhere it says a number, offers to watch
the neighbourhood or value the home without leaving, and ranks every street in a form a thumb can read. That
is the bar.

## Files

- `scripts/audit/hubs.json`, `hub-sweep.mjs`, `hub-page.mjs`, `hub-intents.mjs`, `hub-lighthouse.mjs`,
  `hub-inbound.mjs`, `hub-bench.mjs`, tracked.
- `scratchpad/audit/MA-005/` (sweep, per-hub JSON, intent probe, inbound crawl, Lighthouse, screenshots,
  crops, benchmark captures), untracked.
- `HANDOFF-audit.md` rewritten, `QUEUE.md` marked. No page, component, library file or schema was edited.

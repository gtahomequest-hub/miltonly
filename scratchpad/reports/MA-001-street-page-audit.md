# MA-001
AUDIT · D:\miltonly-audit · feat/audit

## MA-001: the street page on production, ten streets, two widths

Read-only. Nothing on a page was edited. Production at `f01a96a`, 2026-09-12 evening (Toronto).
Tooling under `scripts/audit/` (Puppeteer harness, Lighthouse runner, inbound-link crawler, wire-bytes
probe, cache sweep, section crops); raw output under `scratchpad/audit/MA-001/` (per-street JSON, full-page
and fold screenshots at 1440 and 390, Lighthouse JSON, crops, benchmark captures), untracked.

### The ten streets

| street | shape | Lighthouse perf m / d | LCP m / d | TBT m | weight | screens d / m | first seller CTA (m, screens) | first live listing (m) | sold gate (m) | first email field (m) | inbound links | served |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| woodward-avenue | full data, freehold, no clip | 50 / 87 | 5.7s / 1.8s | 1019 | 1.4 MB | 13 / 22.3 | 3.0 | 11.7 | 7.7 | 22.0 | 10 | HIT 51 ms |
| beaver-court | thin, 4 sales in 12 months | 57 / 94 | 5.1s / 1.6s | 745 | 0.9 MB | 8.6 / 15.1 | 2.1 | none | 5.1 | 14.9 | 3 | HIT 109 ms |
| harvest-drive | no 12-month sale, full-window price | 57 / 97 | 5.1s / 1.1s | 755 | 0.9 MB | 8.1 / 15.3 | 2.4 | none | 5.8 | 15.1 | 4 | REVALIDATED 2,220 ms |
| scott-boulevard | day clip, 22 sales | 60 / 95 | 5.4s / 1.3s | 772 | 1.9 MB | 14.7 / 24.5 | 3.6 | 13.9 | 9.2 | 24.2 | 631 | HIT 111 ms |
| sauve-street | condo-heavy, 16 of 18 | 60 / 96 | 6.3s / 1.3s | 487 | 5.0 MB | 11.1 / 21.2 | 2.8 | 12.1 | 7.4 | 20.9 | 635 | HIT 109 ms |
| guelph-line | rural, Rural Milton West | 56 / 96 | 6.3s / 1.2s | 640 | 7.4 MB | 13 / 24.7 | 2.8 | 11.6 | 7.6 | 24.4 | 638 | HIT 159 ms |
| richardson-way | sub-k, minimal template, 1 sale | 57 / 88 | 5.1s / 1.3s | 700 | 0.9 MB | 5.9 / 9 | 5.7 | none | none | 8.7 | 4 | MISS 3,265 ms |
| bussel-crescent | programme page, created 2026-09-11 | 56 / 97 | 5.4s / 1.1s | 739 | 0.9 MB | 10 / 17.4 | 2.4 | none | 5.6 | 17.2 | 3 | HIT 143 ms |
| main-street | Main Street, 63 sales, 52 condo | 55 / 97 | 6.4s / 1.2s | 693 | 16.3 MB | 17.3 / 33.2 | 3.0 | 13.3 | 8.7 | 33.0 | 650 | HIT 101 ms |
| frost-court | night clip, no prose | 69 / 96 | 4.5s / 1.3s | 570 | 1.0 MB | 8.6 / 12.9 | 3.8 | none | 4.0 | 12.7 | 2 | REVALIDATED 2,642 ms |

m = 390×844 mobile emulation, Lighthouse slow-4G Moto G class; d = 1440×900. "screens" is document height over
viewport height. "first seller CTA" excludes the site nav. Lighthouse SEO scored 100 on all twenty runs;
accessibility 90 to 94; best practices 78 to 79 on every run for the same two reasons. CLS was 0.000 everywhere.

### What holds up

Before the defects, what the page already does that none of the benchmarks do: a k-gated typical price with
its basis printed under it, per type, on the street itself; leases beside sales; the road facts from the Town
centreline; a filmed street; an address ladder with cross streets; every claim suppressed rather than padded
when the sample is thin. Canonical, robots, viewport, lang, one H1, valid JSON-LD, zero layout shift and
zero 4xx on every run. The SERP hook ("homes typically $975,000 across 15 sales in the last 12 months")
is a stronger snippet than any portal shows for a Milton street query, and the price is above the fold at
both widths on every priced street.

## Defects, ranked

Severity: **S1** loses clicks or leads on every page today; **S2** loses them on a class of pages or costs
ranking signal; **S3** quality; **S4** polish. "all" means observed on all ten.

### S1

**1. Most street pages are rendered synchronously on the visit, TTFB 2.5 to 3.7 s.** A sweep of all 490
published pages (one GET each, `scripts/audit/cache-sweep.mjs`): 427 `x-vercel-cache: REVALIDATED` at p50
2,555 ms / p90 3,716 ms, 47 `MISS` at p50 2,730 ms, 16 `HIT` at p50 115 ms. `revalidate = 3600`
(`src/app/streets/[slug]/page.tsx:31`) on pages that see well under one visit an hour means the cached copy
is nearly always past its window when a searcher or Googlebot arrives, and the visitor waits for the full
render. The 47 `MISS` pages (23 of the 24 minimal-template pages, plus 24 standard pages including
`chretien-street`, `heslop-road`, `elderberry-crescent`) answer with `X-Matched-Path: /streets/[slug]` and
`cache-control: private, no-cache, no-store` on every request: they are not in the prerender manifest and
are never cached at all (`richardson-way` measured 1.4 s, 1.5 s, 3.3 s, 12.2 s on four visits). Google's
TTFB target is 800 ms. All, both widths.

**2. Listing tiles load the full-resolution TRREB photo.** `ListingTile` sets `background-image` to the
raw `rs:fit:3840:3840` URL (`src/components/street/v2/sections.tsx:514`), so a phone downloads every
active listing's photo at up to 3,840 px, with no lazy loading (CSS backgrounds cannot lazy-load), no
`srcset`, no format negotiation. Measured on the wire at 390 px (`scripts/audit/bytes.mjs`): Main Street
15.4 MB of images, 16.3 MB page; Guelph Line 7.4 MB; Sauve 5.0 MB; single photos of 3.0 MB, 1.9 MB,
1.5 MB. Lighthouse: "offscreen images 1,397 KiB", "modern formats 3,384 KiB", "responsive images
1,342 KiB" on Main Street. Any street with an active listing, both widths; mobile pays for it.

**3. LCP fails on mobile on all ten, 4.5 to 6.4 s.** Element is `p.s-character` (or the H1); breakdown on
Woodward is TTFB 691 ms, render delay 5,760 ms. Contributors, in order: seven preloaded font files,
328 KB, two of them `.woff` not `.woff2` (66 KB and 68 KB); 480 KB of script; Facebook pixel 192 KB with
682 ms main-thread blocking and Google Tag Manager 188 KB with 226 ms, both loaded before interaction;
DOM 1,679 to 2,187 elements; HTML 400 KB raw (43 KB brotli) of which the RSC payload is 221 KB and the
address `ItemList` in JSON-LD 64 KB. TBT 487 to 1,019 ms against a 200 ms target; TTI 9.5 s on Woodward.
Desktop passes (1.1 to 1.8 s). All, mobile.

**4. The only on-page lead capture is the last block on the page.** The single email field
(`StreetAlertCTA`) sits at screen 12.7 to 33.0 on mobile and 8.6 to 17.3 on desktop; on Main Street a
phone user scrolls 27,800 px to reach it. Every seller CTA before it (`s-inline-cta` at screen 2 to 4,
`s-side-cta` at 5 to 6, the ladder card, the final card) is a link to `/sell`, a second page load with four
required fields (address, email, phone, consent; `src/components/landing/HomeValuationCard.tsx:249-298`).
Four of the five seller links go to bare `/sell` and drop the street; only the ladder card passes
`?street=` (`AddressLadder.tsx:256`), so the valuation form's address prefill is lost from the sidebar
(`sections.tsx:260`), the inline CTA (`sections.tsx:296`), the final card (`street-data.ts:1591`) and
the nav. Nothing on the street page captures a phone number or lets a seller state their house number.
All, both widths.

**5. The VOW sold-records gate, the action with the most intent behind it, is invisible above the fold and
carries the wrong colour.** "See every closed sale on X, free with a verified email" (the registration
that HouseSigma's whole funnel is built on) renders at screen 4.0 to 9.2 on mobile inside "Recent
activity", with no mention in the hero, the glance grid or the nav, and its button is gold
(`.s-gate-btn`), not the `#00ff80` CTA token; the table above it renders a "Loading sold records…" row on
every visit before the gate appears (`SoldRecordsIsland.tsx:60`). On `richardson-way` (minimal) there is
no gate at all. All, both widths.

### S2

**6. Title and description carry an em-dash, and the description overruns.** `baseTitle` is
`${name}, Milton — Homes, Prices & Sales History` and the description opens `${name} in Milton, Ontario —`
(`page.tsx:91-94`); the voice rule is no em-dashes, and Google rewrites titles containing them more often.
Descriptions run 167 to 294 characters on eight of ten (Guelph Line 294, Sauve 250, Harvest 246); the
SERP cuts at about 155, so the character summary is never seen. Bussel Crescent's is 101 characters with
no second sentence because programme pages have an empty `characterSummary`. No `og:image` on any page
(`page.tsx:100-106`): a shared street link renders with no card. All.

**7. Heading order is broken on every page.** The sequence is H1 → H3 (prose sections use `<h3>` with no
H2 above them, `sections.tsx:286`), sidebar cards are H4 under no H3 (`sections.tsx:208,223,235`),
context columns are H4 under an H2 (`sections.tsx:568-602`); the prose's "About X" (H3) and the FAQ's
"About X" (H2) are duplicate headings. Lighthouse `heading-order` fails on all twenty runs. All.

**8. The lease pill links to `#type-condo` whether or not that section exists.** `street-data.ts:815`
hard-codes the anchor; on Woodward, Bussel and Frost Court the only type sections are detached and
townhouse, so the hero's third pill is a dead link. 3 of 10 (any street with leases and no condo type).

**9. Two CTA promises the system cannot keep.** Buyer card: "Private access to new and upcoming listings
before they go public" (`street-data.ts:1595`); ladder card: "Be told … before it reaches the public
portals" (`AddressLadder.tsx:263`). The alert fires from the same MLS feed the portals read. Sidebar trust
line "Complimentary · Response within one hour" (`street-data.ts:1097`) is a service-level claim nothing
on the site measures. All.

**10. The address ladder on a phone is a wall of dots.** Main Street: 3,291 px tall, 365 marks failing
Lighthouse `target-size`, cross-street labels truncated to nothing at 390 px, unlabelled marks are anchors
with `font-size: 0`; Woodward 4,511 px (5.3 screens), 286 failing targets; Guelph Line 5 screens. There
is no way to type a house number. A searcher arriving from "1350 Main Street E" has no path to that mark.
`AddressLadder.tsx:196-232`, `street-theme.css:1494-1504`. All with addresses, mobile.

**11. The FAQ ships answers that answer nothing, into `FAQPage` schema.** "Which schools are close to
Bussel Crescent? Confirm current school assignment with the boards directly." (Bussel, Harvest, Sauve, and
by construction every page where the schools sentence was suppressed). "What kinds of homes are on Sauve
Street? Townhomes appear less frequently, and their pricing is less established." Suppression leaves the
disclaimer and drops the answer; the same text is served to Google as the accepted answer
(`page.tsx:154`). 3 of 10 sampled; corpus-wide by mechanism.

**12. Prose sections that are suppression residue.** "What's nearby: Secondary options like St. Francis
Xavier Catholic SS are also nearby." (Harvest); "Where this street reaches: What that means in practice is
a street where the car handles most weekday movement…" (Bussel); "Housing stock on Sauve: The street also
sees active listings…"; "Comparable homes nearby: Sold-to-ask sits just below par…" (Bussel, one sentence
under a heading promising comparables); "The homes here: … though the exact mix is not specified."
(Harvest). Each is a heading over a dangling sentence. 4 of 10.

**13. The `/streets` directory labels the active asking price "Avg sale price".** Woodward's row reads
"$1,449,000 Avg sale price" (its one active listing) beside a page that says typical $975,000;
`src/app/streets/page.tsx:114-155` derives `avgSalePrice` from active for-sale listings. It is the main
inbound link to every thin street. Voice rule aside ("typical", never an average), the searcher who clicks
sees the number fall by a third. All streets with an active listing.

**14. Thin, new and filmed streets have two to four inbound links.** Crawl of the 1,094-URL sitemap: the
five streets in the nav's "Streets" panel get 631 to 650 linking pages; every other street gets the
`/streets` ladder, its hub, and zero to two "connected streets". Frost Court, with a night clip, has two.
The 40 programme pages have three each. The address-ladder's cross-street links and the hub's filmed
section are the only structural links into them.

**15. The quarterly chart has no axis and no values.** `MiniBars` (`sections.tsx:312-324`) draws bars of
near-identical height with the figure only in a `title` attribute, which does not exist on touch. On Main
Street the eight bars read as a decorative block. All priced streets, mobile.

**16. "Market activity score 85" on the minimal template has no basis.** `StreetMinimalPage.tsx:118-123`
prints `market_score` with no unit, scale or source; the same card omits the neighbourhood typical price,
which is the one number a Richardson Way owner came for. Minimal template (24 pages).

**17. Programme and filmed pages ship placeholder copy.** Bussel Crescent and Frost Court subtitle: "A
street in Milton Ontario." (also the meta description's second sentence, absent); Frost Court body:
"Profile in preparation. We are still assembling the editorial read for Frost Court." on a street with a
night clip and a published price. The sidebar on Frost Court still promises "grounded in every sale we
have tracked on Frost Court" beside a hero saying "Townhouse 4 sample too small" (`resaleClaim` only
switches copy below k5; `sections.tsx:202-203`). 2 of 10.

### S3

**18. Hero stat order and the glance grid repeat each other.** The first hero stat is "Detached / Housing
mix" (`street-data.ts:724`), ahead of the price; on mobile each stat is a 110 px block so the price
arrives at 1,000 px. The glance grid then repeats typical price, sales count and active count within the
same screen on desktop ($975K three times, "15 sales" four times in the first 800 px of Woodward). All.

**19. Sub-12 px text is a fifth of the page.** Lighthouse legibility on Main Street mobile: 81% legible.
Eyebrows 11 px, tile labels 10.5 px, `s-basis` 10.5 px, table headers 10.5 px, `s-gate-k` 10 px, cross-
street labels 10 px (`street-theme.css:67,226,243,278,288,337,400,442,449,615,685,855,978,1018,1237,1432,
1504`). All, mobile.

**20. Contrast.** Hero eyebrow `#017848` on `#073126` is 2.56:1 (`street-theme.css:67`); sidebar trust line
`#778e88` is 4.07:1 (Lighthouse `color-contrast` fails on all twenty runs on `.s-trust`). All.

**21. Best-practices 78 on every run: the Facebook pixel sets a third-party cookie and raises a Chrome
issue on load, before any consent.** `src/components/MetaPixel.tsx`. All.

**22. The night clip carries a daylight poster.** Frost Court: caption "Overnight · Captured 25 August
2026" over a blue-sky poster frame; one shared `poster.webp` per street (QUEUE item 2). Video itself is
correct: `preload="metadata"`, the range request aborts, 0 bytes of the 6.3 MB clip on load, 26 s.

**23. Type-card intros are template lines.** "Detached inventory on Woodward Avenue has seen 10 closed
sales recently. Details below." (`street-data.ts:957`, every type card).

**24. Silent tiles print a bare dash.** "Price band —", "Days on market —", "1 bed —" with no note
(`sections.tsx:341,414,443`); the hero's silent note reads "sample too small" without saying what would be
enough. All.

### S4

**25. The ladder-card buttons wrap their arrow onto a second line at 390 px** ("See what it's worth\n→",
"Watch Woodward\nAvenue →"), 176 × 69 px (`street-theme.css` `.s-addr-cta .s-b1`).
**26. Area-context copy has a space before the comma:** `{name}{' '}\n, the neighbourhood`
(`sections.tsx:725-727`), sub-k5 standard pages.
**27. The Place node lists two of the three neighbourhoods the eyebrow names** (Woodward: Dorset Park,
Dempsey; eyebrow adds Old Milton). No `geo`, no `image`, no `dateModified` on any node; the page shows no
"updated" date anywhere.
**28. `AggregateOffer` describes last year's sold homes as in-stock offers by Team Miltonly**
(`availability: InStock`, `seller: #organization`, `offerCount: 10`), with `price` but no
`lowPrice`/`highPrice`. Not eligible for a rich result and factually a different thing from what the page
says. `src/lib/schema/street-schema.ts`.
**29. `FAQPage` earns no SERP feature** (Google restricted FAQ rich results to government and health sites
in August 2023); harmless, but it is the vehicle for defect 11.
**30. Breadcrumb and cross-street links are 12 to 20 px tall** at 390 px.

## The benchmark

Fetched live 2026-09-12 (`scratchpad/audit/MA-001/bench-*.png`). Zillow's neighbourhood and home-value
pages refused automated access (PerimeterX) and its Ontario listings carry no Zestimate, so it is described
from its public design, not a capture.

| | what the best page does | what they do better | what Miltonly does that they cannot |
|---|---|---|---|
| **Rightmove** (`/house-prices/ng9/woodward-avenue.html`) | H1 "House Prices in Woodward Avenue…", one sentence with the year's average, the change on last year and on the 2011 peak, then every property on the street with each sale date and price back to 1995, a "See what it's worth now" button on every house, filters for radius, years, type and tenure | Per-house sold history (Land Registry is public); a valuation CTA on every address; the year-on-year and versus-peak sentence; radius widening when the street is thin | Ontario sold prices cannot be shown unauthenticated, so Miltonly's gate is the legal equivalent; typical per type, leases, road facts, video, commute, schools, the ladder |
| **Zoopla** (`/house-prices/chilwell/woodward-avenue/`) | "Sold house prices in Woodward Avenue, Chilwell NG9", 37 properties, each with beds, baths, floor area, tenure and every sale, "See what it's worth today" per house, meta description leads with the average sold price | Same as Rightmove plus floor area per house and a cleaner list; `SearchResultsPage` schema | As above |
| **HouseSigma** (address page) | Sold history and price gated behind a free account, SigmaEstimate, estimated rent, rental yield, days on market, climate risk, catchment schools, community stats, "Watch" | The gate is the page: the whole layout sells the sign-in; an estimate, a rent and a yield per address; a watch button in the first screen | A street page at all (HouseSigma has none); prose; k-gated honesty; video; road facts |
| **Zolo** (address page; the street URL is a 410) | Sold price gated, tax, lot, "Woodward Avenue has 1 property currently available", neighbourhood paragraph with average list price, mortgage estimate, comparables | Mortgage estimate; comparables inline; a "How much is your home worth?" strip between listings | Zolo has no street page; its street-level sentence is one line on an address page |
| **Realtor.ca** (city page; no street or neighbourhood pages for Milton) | 618 listings, HPI benchmark chart ($1,057,100, −4.6% YoY, ten-year line) | The HPI line chart with values and a year-on-year figure | Everything below the city grain |
| **Zillow** (neighbourhood home-values page) | Typical home value, one-year change and forecast, a value chart, Zestimate per address | A forecast; a per-address estimate; a value chart with axes | Street grain; Ontario data Zillow does not have |

Plainly: the benchmarks win on four things. A number per house (Rightmove, Zoopla, HouseSigma), a
valuation button on every address, a chart with axes and a year-on-year sentence, and a page that loads in
under two seconds on a phone. Miltonly wins on everything a street page can say that an address page
cannot, and on honesty. The VOW rules forbid the first; the other three are buildable.

## The ten changes, in order of expected effect on clicks and leads

1. **Make every street page a cached page.** Raise `revalidate` on `src/app/streets/[slug]/page.tsx` to a
   day (or `false`, since every `StreetContent` write and the sold sync already revalidate on demand), and
   find why 47 published pages are outside the prerender manifest and served `no-store`. Expected: TTFB
   from 2.5 s to under 200 ms on 94% of visits; the one change on this list that moves ranking and bounce on every page.
2. **Serve listing photos as images.** `<img>` with `srcset`, `loading="lazy"`, `decoding="async"` and a
   TRREB resize parameter sized to the tile (about 700 px), in `ListingTile`. Expected: Main Street from
   16.3 MB to under 1.5 MB; mobile LCP and TBT move on every street with a listing.
3. **Cut the render-delay budget.** Load the Facebook pixel and GTM after first interaction or idle; ship
   the two `.woff` faces as `.woff2` and drop the preloads that are not used above the fold; trim the RSC
   duplication of the address list. Target mobile LCP under 2.5 s, TBT under 200 ms.
4. **Put a street-specific capture in the first two screens on the phone.** One field, email or phone,
   under the hero: "Own on Woodward Avenue? Get the written valuation" and "Watch Woodward Avenue", the
   two intents already on the page, posted through `postLead` with `property_address` set to the street.
   The seller path then never leaves the page; `/sell` stays for the long form. Pass `?street=` on every
   `/sell` link that remains.
5. **Sell the sold-records gate from the top.** A line in the hero stats ("15 closed sales · see every
   one, free"), anchored to `#sold-records`; the gate in the CTA token; no "Loading sold records…" row
   before the gate on an unauthenticated visit.
6. **Rewrite the head.** Title `Woodward Avenue, Milton: Homes, Prices and Sales History` (no dash, no
   ampersand); description capped at 155 with the hook first; an `og:image` (the poster where filmed, a
   rendered card of the typical price otherwise); `dateModified` in the graph and an "Updated" line on
   the page.
7. **Fix the heading tree and the dead anchor.** H2 for the prose block, H3 for its sections, H3 for
   sidebar cards; distinct FAQ heading; lease pill anchors to `#leases` in the market section (or is not a
   link).
8. **Give the ladder a way in.** A house-number input that scrolls to and highlights the mark, cross-street
   labels that survive 390 px, and on arterials a collapsed ladder with the input as the door. Target: no
   more than one screen of ladder before the next section on a phone.
9. **Close the copy holes at the source.** FAQ items whose answer is only the disclaimer are dropped from
   both the page and the schema; sections reduced to one dangling sentence are dropped; the two "before it
   goes public" promises and the one-hour claim are replaced with what the alert actually does; programme
   pages get a real subtitle or none; `/streets` labels the figure "typical asking" or shows the page's own
   typical.
10. **Give every number an axis and every silence a reason.** Bars with values, a year-on-year sentence
    where the sample allows it, "Market activity score" with its scale or removed, a silent tile that says
    "needs 5 sales, has 3".

After these, a Milton owner searching their street lands on a page that loads faster than the portals,
answers the price question in the first screen, offers the sold record and the valuation without leaving,
and says nothing it cannot back. That is the bar.

## Files

- `scripts/audit/streets.json`, `street-page.mjs`, `lighthouse.mjs`, `inbound-links.mjs`, `bytes.mjs`,
  `cache-sweep.mjs`, `crops.mjs`, `pick-streets.mjs`, tracked.
- `scratchpad/audit/MA-001/` (JSON, screenshots, Lighthouse reports, crops, benchmark captures),
  untracked.
- `HANDOFF-audit.md` created. No page, component or library file was edited.

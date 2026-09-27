# MA-006
AUDIT · D:\miltonly-audit · feat/audit

## MA-006 addendum: VOW-only fields rendered to an anonymous visitor, by surface

Read-only, 2026-09-18, production at `e606d8b` (`origin/main` merged into `feat/audit` first). Every line below
was read in the source and then confirmed with a plain `curl` carrying no cookie, or a headless Chrome with no
session, so "rendered" means present in the HTML an anonymous visitor or a crawler receives. DB1 was read once
for counts (`scratchpad/audit/MA-005/status.mjs`, `status2.mjs`, `one.mjs`, `r48.mjs`, untracked): 470 active
sale rows, 604 `sold`, 1,044 `expired`, 1,179 lease rows `leaseStatus = active`, 229 `leased`, all with
`permAdvertise = TRUE`. `Listing.soldPrice` and `Listing.soldDate` are null on every row (Phase 2.6);
`Listing.daysOnMarket` is null on every row (the sync never writes it); `Listing.priorPrice` is set on 22 active
sale rows, 11 active lease rows and 1 sold row.

**How days on market is derived everywhere.** No surface reads the `daysOnMarket` column. Every "Nd on
market", "N days on market", "Nd ago" and "Listed N days ago" is `today minus Listing.listedAt`, and
`listedAt` is the feed's `OriginalEntryTimestamp` (`src/app/api/sync/detect/route.ts:356`,
`src/lib/sync/treb-sync.ts:288`). So the list date is used to derive DOM on every surface below, and on the
listing detail page the ISO timestamp itself is in the payload.

### Surface 1: listing detail, `/listings/[mlsNumber]`

`index, follow` on every row that exists and has `permAdvertise = TRUE`; the page checks nothing else
(`src/app/listings/[mlsNumber]/page.tsx:78-80`, `:83`). The 470 active sale rows are on the sitemap; the 604
sold, 1,044 expired and 229 leased rows are not, and each still answers 200 with `index, follow`.

| field | where | file:line | confirmed on |
|---|---|---|---|
| Days on market | pill "Nd on market" / "Listed today" beside the status label | `ListingDetailClient.tsx:240-241`, computed `page.tsx:149` | W13715618 "22d on market" |
| Days on market | "New to market · listed Nd ago" banner when ≤ 7 days | `ListingExtras.tsx:580-592` | code path; none ≤ 7 in the sample |
| Days on market | byline "Listed N days ago · Source: TREB MLS® W…" | `ListingDetailClient.tsx:292` | "Listed 22 days ago" |
| Days on market | Quick facts row "Listed: N days ago" | `ListingDetailClient.tsx:431` | same |
| Days on market | `<meta name="description">` "… Listed N days ago. Book a showing…", so the SERP snippet carries it | `page.tsx:59-63` | W13715618 |
| List date | `listedAt` ISO timestamp in the RSC payload (the whole Prisma row is serialised and passed to the client) | `page.tsx:140`, `:235` | `"listedAt":"2026-08-27T…"` in the HTML |
| Prior price, price-change date | `priorPrice`, `priceChangedAt`, `lastPriceChangeAt` in the same serialised row; not displayed | `page.tsx:140` | W13715618: `"priorPrice":1099000` beside `price` 1,059,000; W13607844 (lease): `"priorPrice":1750` |
| Sold status on a visible listing | label "SOLD" | `ListingDetailClient.tsx:98-99` | W13065302: "SOLD" and "141d on market" |
| Expired status on a visible listing | Quick facts "Status: expired"; the label still says "FOR SALE" because only `sold` is special-cased | `ListingDetailClient.tsx:98`, `:429` | W13723006: "FOR SALE", "20d on market", Status expired |
| Leased status on a visible listing | Quick facts "Status: rented" (the umbrella value); the label says "FOR RENT" because the rental branch is tested first | `ListingDetailClient.tsx:98`, `:429` | W13575466: "FOR RENT", "62d on market" |
| Status in JSON-LD | `Offer.availability: InStock` on every row, sold and expired included | `page.tsx:194` | W13065302, W13723006 |
| Sold price | none rendered; `soldPrice` is null on every row and the two sold-count blocks are DB2-gated | `page.tsx:100-103` | |

The four "similar" cards on the page carry price, beds and type only (`ListingDetailClient.tsx:455-463`).

### Surface 2: the grid, `/listings`, `/listings?status=rent`, `/listings?status=sold`

`ResultsClient.tsx` renders `ListingCard.tsx`; 36 cards a page (`listingsV2Data.ts:41`). `/listings` is
`index, follow`; the `status=` variants are `noindex, follow`, so their cards are still crawled.

| field | where | file:line | confirmed on |
|---|---|---|---|
| Days on market | "Nd on market" on every card; "New today" / "New" when ≤ 3 days | `ListingCard.tsx:25-27`, `:48`, `:137` | `/listings`: "2d on market" ×13, "New today" ×9 |
| Sold status on visible listings | `?status=sold` lists the 604 sold rows, "Sold" badge, H1 "Recently sold in Milton", "604 homes sold in Milton" | `listingsV2Data.ts:105`, `ListingCard.tsx:24`, `:49` | 36 cards, e.g. W13767778 |
| "Sold for" over the list price | the card says "Sold for $875,000"; `soldPrice` is null so the fallback is the asking price, labelled as a sold price | `ListingCard.tsx:31`, `:83-88` | W13767778: `price` 875,000, `soldPrice` null |
| Days on market on sold rows | "Nd on market" counted to today, not to the sale | `ListingCard.tsx:133-137` | W13767778 "8d on market" |
| Sold date | would render `soldDate` where present; null everywhere today | `ListingCard.tsx:133-134` | |
| Leased status on visible listings | `?status=rent` filters `transactionType` only, so the 229 leased units sit among "1,408 homes for rent"; and because `status === 'rented'` is read as sold, every rental card, available or not, is badged "Leased" and priced "Leased for $2,450" | `listingsV2Data.ts:104`, `ListingCard.tsx:24`, `:49`, `:83` | first page: 36 active units, all "Leased for" |

### Surface 3: `/rentals` (and `/rentals?neighbourhood=`)

`index, follow`. The 48 newest `For Lease` rows, no `leaseStatus` filter (`src/app/rentals/page.tsx:52-56`);
today the newest 48 are all `active`, so no leased unit is on the page, by ordering rather than by filter.

| field | where | file:line |
|---|---|---|
| Days on market | badge "New today" / "New this week" / "Nd ago" | `RentalsClient.tsx:894`, `:906` |
| Days on market | "⏱ Nd on market" in the card meta | `RentalsClient.tsx:926` |

### Surface 4: homepage `/`

| field | where | file:line | confirmed |
|---|---|---|---|
| Days on market | "Listed today" / "N days on market" on each newest-listing card | `src/components/home/NewestListings.tsx:55`, `:76` | "18 days on market" |

### Surface 5: place pages, `/schools/[slug]`, `/mosques/[slug]`

| field | where | file:line | confirmed |
|---|---|---|---|
| Days on market | "New today" / "New this week" / "Nd on market" on each nearby listing | `src/components/places/PlaceListings.tsx:47`, `:56` | `/schools/chris-hadfield-ps`: "108d on market", "51d", "38d", "30d" |

### Surface 6: ad landing pages, `/sales/ads/[mls]`, `/rentals/ads/[mls]`, `/rentals/ads`

All three answer `index, follow` (the noindex at `sales/ads/[mlsNumber]/page.tsx:57` covers the redirect
placeholder only; `/rentals/ads` removes noindex on purpose, `rentals/ads/page.tsx:13-14`).

| field | where | file:line | confirmed |
|---|---|---|---|
| Days on market | "NEW · Nd ago" on the hero photo when ≤ 14 days | `SalesAdsClient.tsx:101`, `:244-246`; `RentalsAdsClient.tsx:97`, `:239` | `/sales/ads/W13720318` "8d ago" |
| Days on market | slider cards "NEW · Nd" / "Nd ago" | `src/components/landing/LiveListingSlider.tsx:616-617` | same page |
| Days on market | index cards "New today" / "Nd new" / "Nd ago" | `src/app/rentals/ads/AdsClient.tsx:220`, `:237` | `/rentals/ads` "1d new" |

### Surface 7: the mega menu, on every page

Server-rendered into every page's HTML by `SiteNavLive`, so it is on the hub, the street page, the condo page,
the guides and the listing page alike.

| field | where | file:line | confirmed |
|---|---|---|---|
| Prior price | Buy › Price changes: the previous list price struck through beside the current one | `src/lib/megaLive.ts:152-153`, `SiteNav.tsx:294` | every page fetched: `$6,199,000`, `$1,099,000` ×2 |
| Price change | "down $40,000" / "up $X" under the price | `megaLive.ts:154-155`, `SiteNav.tsx:296` | "down $40,000" ×6, "down $201,000" ×3, "down $12,500" ×3 |
| Days on market | a `dom` slot on every menu card, empty today because it reads the never-written column | `megaLive.ts:147`, `SiteNav.tsx:299` | not rendered |

The Rent panel's leased figures ("what leased, how fast") are DB2 aggregates, not per-listing.

### Surfaces with the slot but nothing rendered, and dead code

- Street page listing tiles: `s-listing-dom` "Nd on market" renders only when `daysOnMarket` is non-null
  (`src/components/street/v2/sections.tsx:611`, fed by `streetV2Data.ts:310` and `street-data.ts:1496`);
  the column is null everywhere, so no tile shows it today. 0 occurrences on `/streets/rose-way-milton`.
- `src/components/street/ActiveInventory.tsx:38` (`· Nd`), `src/app/listings/ListingsCardsClient.tsx:181`
  ("· Nd on market") and `:186` (raw `status` pill), `src/components/ListingsGrid.tsx:39`: not imported by any
  page.
- Condo pages, hub pages, market-watch editions, guides: no per-listing DOM, date, prior price or status
  rendered (the MLS numbers in a market-watch edition's HTML are the menu's cards).
- JSON-LD: the only per-listing schema is the listing page's (Surface 1). No `datePosted`, no DOM field, no
  price history anywhere in schema.
- `/api/content/v1/listings/recent` answers 401 anonymously. `/api/street-stats` is public but aggregate
  (below).

### Summary by field

| field | surfaces rendering it to an anonymous visitor |
|---|---|
| Days on market (derived from `listedAt`) | listing detail (five places, one of them the meta description), `/listings` and its `status=` variants, `/rentals`, homepage, school and mosque pages, the three ad surfaces and their slider |
| List date used to derive it | every surface above; the raw timestamp in the listing page payload |
| Prior price and change | mega menu on every page (displayed); listing page payload (not displayed) |
| Sold or expired status on a still-visible listing | 604 sold and 1,044 expired detail pages, `index, follow`; the `?status=sold` grid with "Sold" badges and "Sold for" over asking prices; `Offer.availability: InStock` on all of them |
| Leased status on a still-visible listing | 229 leased detail pages as "FOR RENT"; the `?status=rent` grid, which also badges every available unit "Leased" |
| Sold price | none (the column is null); the sold grid's "Sold for $…" is the asking price wearing the label |

## Aggregates, reported separately (not findings)

- Street page "Time on market" per home type, k5 (`src/components/street/v2/sections.tsx:435`,
  `streetV2Data.ts:110`), DB2.
- Hub page "days on market" inside the generated prose and FAQ (June figures, MA-005 defect 1), DB2.
- Mega menu Sell panel and homepage market-watch line: "20 homes sold in Milton in the week of 7 September
  2026 … The typical sold price was $925,000, after 88 days on market" (`src/lib/marketWatch/edition.ts`),
  DB2.
- `/listings` stat tile "Avg days on market: —" (`listingsV2Data.ts:249-250`, `:331`): an average over the
  null DB1 column, so it prints a dash on every visit.
- `/api/street-stats?street=` `avgDOM` (`src/app/api/street-stats/route.ts:33`, `:58`, `:73`): the same null
  column, so 0.
- Rent panel and `/rentals` "how fast" figures: DB2 closed-lease aggregates (`megaLive.ts:439-470`).

## Files

- `scratchpad/reports/MA-006-vow-fields-addendum.md` (this file), tracked.
- `scratchpad/audit/MA-005/status.mjs`, `status2.mjs`, `one.mjs`, `r48.mjs` (read-only DB1 counts) and the
  fetched HTML under `/tmp`, untracked.
- `HANDOFF-audit.md` rewritten, `QUEUE.md` marked. No page, component, library file or schema was edited.

HOME · D:\miltonly-home · feat/homepage

# Handoff — homepage worktree

_Last rewritten 2026-09-10, after the title and H1 shipped and two figure defects were fixed._

## Scope of this worktree

`D:\miltonly-home` on `feat/homepage` owns **the homepage, the header with its mega menu,
and the footer**. It never touches street pages, generation, or the database.

Owned files:

- `src/app/page.tsx`, `src/app/layout.tsx` (header/footer wiring only)
- `src/components/home/*` including `home-theme.css`, `home-sections.css`, `mockData.ts`
- `src/components/nav/*` — `SiteNav.tsx`, `megaTypes.ts`, `site-nav.css`
- `src/lib/homepageData.ts`, `src/lib/neighbourhoodCards.ts`, `src/lib/homeSignals.ts`
- `src/components/ChromeGate.tsx` (only the `/` line)

Out of scope unless a ruling says otherwise: `src/components/sections/FooterSection.tsx`
and `PreFooterCTA.tsx`, which are the **other** pages' footer.

## Standing rules for this worktree

- **The first line of every report is the worktree folder and branch**, e.g.
  `HOME · D:\miltonly-home · feat/homepage`.
- Keep this file updated instead of `HANDOFF.md`. Do not rewrite `HANDOFF.md` from here.
- Everything in the root `CLAUDE.md` still applies: pnpm only, exit-code gate, no
  em-dashes, "typical" not "median", reports to `scratchpad/reports/`, terminal gets 10
  lines or fewer.

## Where things stand

| | |
|---|---|
| branch | `feat/homepage` |
| code SHA | **`1f495e8`** — the last commit that changed anything under `src/` or `scripts/` |
| preview | **https://miltonly-nlr4rvlrr-gtahomequest-hubs-projects.vercel.app** (`1f495e8`) |
| battery on that preview | **`PASS · 10 checks · 444 pages · 64s`**, exit 0, served SHA == expected |
| local build | exit 0, zero `P2024`, **19/19 prebuild**, 546 static pages |
| state | **Built and corrected. Awaiting Aamir's preview review. NOT MERGED.** |
| reports | `062-homepage-gate-a.md` (recon), `063-homepage-build.md` (build), `064-homepage-figure-defects.md` (title/H1 + figure fixes) |

**Title and H1 are shipped** (Brain's pick): title `Milton Homes for Sale, Street by Street`
(39 chars), H1 `What Milton homes actually sell for, / street by street`. Both are now set on
the page with a declared canonical, not inherited from the root layout.

Measured on the built page: **24 unique internal links -> 66**, **0 nav links -> 34**,
**302 visible words -> 1,146**, 3 hubs linked -> **22**, 2 street pages linked -> **17**.

## What this build changed

- **The header is three menus** (Buy / Streets / Sell). Every trigger is an `<a href>`,
  every panel is rendered on the server and closed with `hidden`, and below 820px the same
  links are native `<details>` accordions. This is site-wide: the page variant had no mega
  menu at all before.
- **The footer is a live link graph** — every published hub, the in-demand streets, the
  tools — instead of three hubs and two streets.
- **Five sections**: 01 streets on film, 02 newest on the market, 03 the neighbourhood
  ladder, THE BOARD (unchanged), 04 valuation with three live proof points, 05 the daily
  brief. The TrustBand is retired.
- **A 10th battery check**, `scripts/verify/checks/homepage.mjs`, extended 2026-09-10 to
  assert every Milton-wide figure by VALUE and by FORMAT against `loadHomeRecord()`.

## Traps, and decisions that must not be re-litigated

- **A price *drop* is not derivable and there is no function for one.**
  `Listing.lastPriceChangeAt` marks that a price changed; no prior price is stored. The
  `priceReduced` flag, its "Price reduced" badge, and `stats.ts getFeaturedListings` (whose
  `priceDrops` returned the cheapest actives) are all deleted. Do not re-add any of them.
  A price-drop section returns when Core stores a prior price, not before.
- **One neighbourhood price, from `getNeighbourhoodCards()`.** It is the hub page's own
  k-gated 12-month typical sold price. `/neighbourhoods` reads the same function. Do not
  reintroduce an active list-price average anywhere: two statistics under one word is the
  defect `hub-meta.mjs` exists to catch.
- **Never hand-roll a listing query.** `getNewestListingCards` in `listingsV2Data.ts` runs
  `toCard`, which applies the RECO/IDX display gate server-side. A second query is a second
  chance to ship a withheld address.
- **A raw TREB neighbourhood string is not a slug.** Resolve it through
  `getRawStringHubMap()`; a raw string with no published hub gets no link.
- **The link floor in the battery does not guard the header.** 65 of the 66 links come from
  the body. The anchor assertions guard the header. The constant's own comment says this;
  do not raise the floor to "catch the nav".
- **A figure crossing a component boundary must carry its unit in its name.**
  `BoardTab.soldToAsk.value` is a RATIO that `TheBoard` multiplies at render; reading it
  elsewhere printed `0.980868783307145%`. The homepage reads `soldToAskPct` from
  `getMiltonSoldOverall()`, the same aggregate `/sold` publishes. Note the Board (urban, 13
  weeks, 98.1%) and `/sold` (all Milton, 12 months, 98.3%) are different aggregates and are
  not expected to agree.
- **Three counts, three sets, and only one of them is "pages".**
  `publishedStreetPageSlugs()` in `streetSurface.ts` is the sitemap's set (444) and is read
  by `sitemap.ts`, `/streets` and the homepage. `surfacedStreetWhere()`'s count (738) is the
  set allowed to appear in search and hub ladders; it was being published as a page count.
  A raw `StreetContent` count (445) includes `15-side-road-side-road-milton`, an address
  artifact with no entity, which the sitemap refuses. Never state a page count from anything
  but `publishedStreetPageCount()`.
- **A presence assertion is not a value assertion.** The homepage gate passed with both
  figure defects on the page because it checked that a `data-fig` existed and parsed as a
  number. `data-value` was correct in both defects; the fault was in the rendering. The
  check reads rendered TEXT now. Do not "simplify" it back to reading the attribute.
- **A fixed-width figure column is a promise about data that CSS cannot keep.** The proof
  row was `128px` and the long value sat on its label. It is `minmax(0, max-content)` now.
- **`mockData.ts` is no longer typed `HomepageData`.** It holds static hero editorial only.
  A hardcoded k-gated price would be a fabricated figure wearing a real figure's name.

## Open, and owned elsewhere

- **`on-market` counts more than its label implies.** `buildMiltonWideContext` counts
  `permAdvertise AND status='active'` with no city and no transaction-type filter, so "on
  the market today" would include leases and non-Milton rows. It is exactly right today
  (448 either way), so this is latent, not a live wrong figure. The gate asserts the query
  the app actually runs, on purpose. Needs a decision, not a silent change.
- **Daily-brief consent is sent but not persisted.** `/api/leads`' generic path does not
  store `consentText` / `consentTimestamp`, and the branch that does requires a phone
  number. Leads owns the model and this is flagged to them.
- **380px is sized for, not visually verified.** The CSS is written for it; the preview
  review is where it gets confirmed.

## Next action

Aamir reviews the preview. No merge until he approves and Brain picks a title and H1.

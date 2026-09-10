HOME · D:\miltonly-home · feat/homepage

# Handoff — homepage worktree

_Last rewritten 2026-09-10, after `feat/homepage` merged to main and production was verified._

## READ THIS FIRST

**MERGED AND LIVE.** `feat/homepage` merged to main as **`a9546a7`**, approved by Aamir after
preview review of `1f495e8` (`miltonly-nlr4rvlrr`). Production serves `a9546a7` on the apex;
battery **`PASS · 10 checks · 444 pages · 68s`**, exit 0, at the full SHA.

**The merge was made with plumbing, not `git merge`, and the shape is identical.** `main` is
checked out in another worktree (`D:\miltonly`), so it cannot be checked out here. The commit
was created as `git commit-tree feat/homepage^{tree} -p origin/main -p feat/homepage` and
pushed to `main`: a two-parent merge commit whose tree is byte-identical to the reviewed branch
(`git diff --stat a9546a7 feat/homepage` is empty). `origin/main` was merged INTO the branch
and the build gate run BEFORE that, so nothing untested reached main. **`D:\miltonly`'s local
`main` is now stale and needs a `git pull` before anyone works there.**

**Report numbering now collides across worktrees.** The leads worktree used `062` and `063` on
the same days this one did. Both sets are in the repo under different slugs
(`062-homepage-gate-a.md` / `062-leads-gate-a.md`). Quote the full filename, never the number.

## Scope of this worktree

`D:\miltonly-home` on `feat/homepage` owns **the homepage, the header with its mega menu, and
the footer**. It never touches street pages, generation, or the database.

Owned files:

- `src/app/page.tsx`, `src/app/layout.tsx` (header/footer wiring only)
- `src/components/home/*` including `home-theme.css`, `home-sections.css`, `mockData.ts`
- `src/components/nav/*` — `SiteNav.tsx`, `megaTypes.ts`, `site-nav.css`
- `src/lib/homepageData.ts`, `src/lib/neighbourhoodCards.ts`, `src/lib/homeSignals.ts`
- `src/components/ChromeGate.tsx` (only the `/` line)

Touched outside that scope, deliberately and under ruling, all now on main:
`src/lib/streetSurface.ts` (`publishedStreetPageSlugs`), `src/app/sitemap.ts` and
`src/app/streets/page.tsx` (both read it), `src/app/neighbourhoods/page.tsx` (reads
`getNeighbourhoodCards`), `src/lib/listingsV2Data.ts` + `src/lib/stats.ts` +
`src/components/listings/v2/*` (the `priceReduced` removal), `src/lib/schema.ts`
(`generateOrganizationSchema`), `src/lib/heroSearch.ts` (address anchors), and
`scripts/verify/*` (the 10th check).

## Standing rules for this worktree

- **The first line of every report is the worktree folder and branch**, e.g.
  `HOME · D:\miltonly-home · feat/homepage`.
- Keep this file updated instead of `HANDOFF.md`. Do not rewrite `HANDOFF.md` from here.
- Everything in the root `CLAUDE.md` still applies: pnpm only, exit-code gate, no em-dashes,
  "typical" not "median", reports to `scratchpad/reports/`, terminal gets 10 lines or fewer.

## Where things stand

| | |
|---|---|
| main | **`a9546a7`** |
| production | **`miltonly-1b5r8e80r`**, serving `a9546a7`, confirmed on the apex |
| battery on production | **`PASS · 10 checks · 444 pages · 68s`**, exit 0, at the full SHA |
| local build after merging main | exit 0, zero `P2024`, **19/19 prebuild**, 546 static pages |
| reviewed preview | `miltonly-nlr4rvlrr` (`1f495e8`) |
| reports | `062-homepage-gate-a.md`, `063-homepage-build.md`, `064-homepage-figure-defects.md` |
| QUEUE | marked done, out of queue, at the end of the file |

Served on `https://miltonly.com` and verified after the merge:

```
TITLE : Milton Homes for Sale, Street by Street
CANON : https://miltonly.com
H1    : What Milton homes actually sell for, street by street
proof-street-pages -> 444        FOOTER: All 444 street pages
proof-sold-to-ask  -> 98%        LINKS : 66 unique internal
```

## What shipped

- **The header is three menus** (Buy / Streets / Sell). Every trigger is an `<a href>`, every
  panel is server-rendered and closed with `hidden`, and below 820px the same links are native
  `<details>` accordions. **Site-wide**: the page variant had no mega menu at all before.
- **The footer is a live link graph** — every published hub, the in-demand streets, the tools.
- **Five sections**: 01 streets on film, 02 newest on the market, 03 the neighbourhood ladder,
  04 valuation with three live proof points, 05 the daily brief. THE BOARD unchanged, TrustBand
  retired.
- **24 unique internal links -> 66**, 302 visible words -> 1,146, hubs 3 -> 22, street pages
  2 -> 17.
- **Title and H1 set on the page** with a declared canonical, not inherited.
- **A 10th battery check**, `scripts/verify/checks/homepage.mjs`, plus `loadHomeRecord()` in
  `scripts/verify/lib/db.mjs`.

## Traps, and decisions that must not be re-litigated

- **A price *drop* is not derivable and there is no function for one.**
  `Listing.lastPriceChangeAt` marks that a price changed; no prior price is stored. The
  `priceReduced` flag, its "Price reduced" badge, and `stats.ts getFeaturedListings` (whose
  `priceDrops` returned the cheapest actives) are all deleted. Do not re-add any of them. A
  price-drop section returns when Core stores a prior price, not before.
- **Three counts, three sets, and only one of them is "pages".**
  `publishedStreetPageSlugs()` in `streetSurface.ts` is the sitemap's set (**444**) and is read
  by `sitemap.ts`, `/streets` and the homepage. `surfacedStreetWhere()`'s count (**738**) is the
  set allowed to appear in search and hub ladders; it was being published as a page count. A raw
  `StreetContent` count (**445**) includes `15-side-road-side-road-milton`, an address artifact
  with no entity, which the sitemap refuses. Never state a page count from anything but
  `publishedStreetPageCount()`.
- **One neighbourhood price, from `getNeighbourhoodCards()`.** It is the hub page's own k-gated
  12-month typical sold price. `/neighbourhoods` reads the same function. Do not reintroduce an
  active list-price average: two statistics under one word is the defect `hub-meta.mjs` exists
  to catch.
- **A figure crossing a component boundary must carry its unit in its name.**
  `BoardTab.soldToAsk.value` is a RATIO that `TheBoard` multiplies at render; reading it
  elsewhere printed `0.980868783307145%`. The homepage reads `soldToAskPct` from
  `getMiltonSoldOverall()`. The Board (urban, 13 weeks, 98.1%) and `/sold` (all Milton, 12
  months, 98.3%) are different aggregates and are not expected to agree.
- **A presence assertion is not a value assertion.** The homepage gate passed with both figure
  defects on the page because it checked that a `data-fig` existed and parsed as a number.
  `data-value` was correct in both defects; the fault was in the rendering. The check reads
  rendered TEXT now. Do not "simplify" it back to reading the attribute.
- **A fixed-width figure column is a promise about data that CSS cannot keep.** The proof row
  was `128px` and the long value sat on its label. It is `minmax(0, max-content)` now.
- **The link floor in the battery does not guard the header.** 65 of the 66 links come from the
  body. The anchor assertions guard the header. Do not raise the floor to "catch the nav".
- **Never hand-roll a listing query.** `getNewestListingCards` runs `toCard`, which applies the
  RECO/IDX display gate server-side.
- **A raw TREB neighbourhood string is not a slug.** Resolve it through `getRawStringHubMap()`.
- **`mockData.ts` is no longer typed `HomepageData`.** It holds static hero editorial only.

## Open, and owned elsewhere

- **Daily-brief consent is sent but not persisted.** `/api/leads`' generic path drops
  `consentText` / `consentTimestamp`; the branch that stores them requires a phone number.
  **Leads owns this.**
- **`on-market` counts more than its label implies.** `buildMiltonWideContext` counts
  `permAdvertise AND status='active'` with no city and no transaction-type filter, so "on the
  market today" would include leases and non-Milton rows. Exactly right today (448 either way),
  so latent rather than wrong. The gate asserts the query the app actually runs, on purpose.
  Needs a decision, not a silent change.
- **380px is sized for, not visually verified.**

## Next action

None outstanding in this worktree. The branch is merged and production is verified on it.

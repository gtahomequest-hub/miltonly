HOME · D:\miltonly-home · feat/homepage

# Handoff — homepage worktree

_Last rewritten 2026-09-10, after Gate A recon._

## Scope of this worktree

`D:\miltonly-home` on `feat/homepage` owns **the homepage, the header with its mega menu, and
the footer**, and nothing else. It never touches street pages, generation, or the database.

Owned files:

- `src/app/page.tsx`, `src/app/layout.tsx` (header/footer wiring only)
- `src/components/home/*` (the whole directory, including `home-theme.css` and `mockData.ts`)
- `src/components/nav/SiteNav.tsx` + `site-nav.css`
- `src/lib/homepageData.ts`
- `src/components/ChromeGate.tsx` (only the `/` line)

`src/components/sections/FooterSection.tsx` and `PreFooterCTA.tsx` are the **other** pages'
footer. Out of scope unless a task says so.

## Standing rules for this worktree

- **The first line of every report is the worktree folder and branch**, e.g.
  `HOME · D:\miltonly-home · feat/homepage`.
- Keep this file updated instead of `HANDOFF.md`. Do not rewrite `HANDOFF.md` from here.
- Everything in the root `CLAUDE.md` still applies: pnpm only, exit-code gate, no em-dashes,
  "typical" not "median", reports to `scratchpad/reports/`, terminal gets 10 lines or fewer.

## Where things stand

| | |
|---|---|
| branch | `feat/homepage`, forked from `794f96e` |
| state | **Gate A recon delivered. No code written. Awaiting approval.** |
| report | `scratchpad/reports/062-homepage-gate-a.md` |

## What the recon established

- The live homepage renders 5 sections: Nav, Hero, THE BOARD, TrustBand, Footer.
  **302 visible words. 24 unique internal links.**
- **The header emits zero crawlable links.** All four nav items are `<button>`s and the mega
  panels mount only on click.
- **The homepage has no automated coverage.** The 9-check battery is the street-corpus battery
  and never fetches `/`. No prebuild test touches any homepage file.
- Title and canonical are inherited from the root layout. The title is 101 characters.
- Measured 2026-09-10: 448 active, 45 new in 7 days, 16 price *changes* in 7 days, 23 sold month
  to date (typical $970,000), 40 published streets carrying a clip (37 day, 3 night), 22
  published hubs, 445 published street pages.

## Traps found, do not re-derive

- **`stats.ts getFeaturedListings` is dead code and its `priceDrops` is a lie**: it returns the
  cheapest active listings, not price drops. Zero consumers. Do not wire it to anything.
- **A price *drop* is not derivable.** `Listing.lastPriceChangeAt` marks that a price changed;
  no prior price is stored. `listingsV2Data`'s `priceReduced` flag is mislabelled for the same
  reason. Any homepage section must say "changed", not "dropped", unless ingest starts capturing
  the prior price, which is out of this worktree.
- **Never hand-roll a listing query.** `listingsV2Data` applies `applyDisplayGate` server-side,
  so a withheld address never reaches the client. A second query would not.
- **Two kinds of price figure exist.** `/neighbourhoods` cards use an active-listing average;
  the Board and hero use a k-gated typical. Putting both under the word "typical" breaks Voice.
- **`resolveHeroSearch` ignores house numbers.** It tokenises digits and then never uses them,
  so "410 Farmstead Drive" falls through to `/listings?q=`. The Town projection
  (`townAddressesForSlug`, 40,826 addresses) and the anchors themselves already exist.

## Open questions blocking the build

1. Price drops: relabel to "price changed this week", or drop the section from V1?
2. Neighbourhood card price: active-listing average or k-gated typical?
3. Daily brief: reuse `Lead` with a source tag rather than a new table?
4. May the homepage title and `<h1>` change?
5. Add a homepage gate: battery check, or prebuild structural test?

## Next action

Await approval on `scratchpad/reports/062-homepage-gate-a.md`. No code until then.

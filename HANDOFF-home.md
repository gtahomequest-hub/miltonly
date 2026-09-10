HOME · D:\miltonly-home · feat/homepage

# Handoff — homepage worktree

_Last rewritten 2026-09-10, after the header, footer and homepage sections were built._

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
| branch | `feat/homepage`, HEAD **`3a1aced`** (code `b9f0341`) |
| preview | **https://miltonly-715cxyyzc-gtahomequest-hubs-projects.vercel.app** |
| battery on the preview | **`PASS · 10 checks · 444 pages · 68s`**, exit 0, at the full SHA |
| local build | exit 0, zero `P2024`, **19/19 prebuild**, 546 static pages |
| state | **Built. Awaiting Aamir's preview review. NOT MERGED.** |
| reports | `scratchpad/reports/062-homepage-gate-a.md` (recon), `063-homepage-build.md` (this build) |

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
- **A 10th battery check**, `scripts/verify/checks/homepage.mjs`.

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
- **`mockData.ts` is no longer typed `HomepageData`.** It holds static hero editorial only.
  A hardcoded k-gated price would be a fabricated figure wearing a real figure's name.

## Open, and owned elsewhere

- **Title and H1 unchanged.** Three options each are in report 063 §4. Brain picks; nothing
  ships until then. The homepage still inherits the root layout's 101-character title.
- **Daily-brief consent is sent but not persisted.** `/api/leads`' generic path does not
  store `consentText` / `consentTimestamp`, and the branch that does requires a phone
  number. Leads owns the model and this is flagged to them.
- **380px is sized for, not visually verified.** The CSS is written for it; the preview
  review is where it gets confirmed.

## Next action

Aamir reviews the preview. No merge until he approves and Brain picks a title and H1.

HOME · D:\miltonly-home · feat/rent-menu

# Handoff, homepage worktree

_Last rewritten 2026-09-15, MH-007 addendum: typical rent by unit type, on `feat/rent-menu`, previewed, NOT merged._

## READ THIS FIRST

**TWO BRANCHES ARE PREVIEWED AND NOT MERGED. Core merges by SHA on approval.**

- **`feat/rent-menu@91f8ef0b063b4114b2bbbc42e335b9becd11a783` (MH-007 and its addendum, the Rent menu).** Preview
  `https://miltonly-hwz0nkjza-gtahomequest-hubs-projects.vercel.app`, `--only=nav,homepage,hub-meta`
  `PASS · 3 checks · 567 pages · 284s`. It branches from `feat/nav-v3@3b56020` with `origin/main@60780ca`
  merged in, so it CONTAINS the chrome: merging it merges MH-006 too. Record in
  `scratchpad/reports/MH-007-rent-menu.md`.
- **`feat/nav-v3@3b56020c524525acf666906b670d0e85397b2c06` (MH-006, the chrome).** Merged up to
  `origin/main@1900c46`; preview `miltonly-iskzekw24` (CLI deploy), `--only=nav,homepage,hub-meta`
  `PASS · 3 checks · 529 pages · 229s`; the full battery on the earlier Git preview of the same
  SHA was `PASS · 18 checks · 529 pages · 801s`. Record in `scratchpad/reports/MH-006-chrome.md`.
  The brief for MH-007 said "from origin/main after MC-022 lands"; MC-022 had not landed, so the
  rent branch sits on nav-v3 instead (report, first bullet).

**PREVIEWS COME FROM THE CLI NOW.** `vercel.json` cancels Git-triggered builds on every branch but
`main` (MC-017). `npx vercel deploy --yes --env VERCEL_GIT_COMMIT_SHA=<sha> --build-env VERCEL_GIT_COMMIT_SHA=<sha>`
from the worktree; without the env, `/api/build` says `unknown` and the battery aborts. The URL is
the last `https://miltonly-...vercel.app` line of the CLI's output.

**RENT IS THE FOURTH MENU (MH-007).** Buy · Rent · Streets · Sell, one rail-and-panel shape.
`composeRent()` in `megaLive.ts` builds it from `MegaExtras.rent` (`MegaRent`: available now,
per-hub counts folded through `getRawStringHubMap()`, the newest four, this week's, and
`getLeaseMarket()` from `src/lib/rentSignals.ts`). The closed-lease figures are DB2's
`sold.sold_records` For Lease rows over 12 months, midpoint rent, gated at `K_ANON_PRICE` on
each type's own sample; below it the value is the words "Sample too small". **A house is not one
unit type (addendum, 2026-09-15):** each lease is classed in SQL from the feed's unit field and the
opening of its remarks as whole home, basement unit or upper floors only; a house type's figure is
the WHOLE HOME (`menu-rent-<type>-whole`), a BASEMENT UNIT figure sits beside it where at least
five leased (`menu-rent-<type>-basement`), upper-only leases are in the count and in neither, and a
condo suite is one unit (`menu-rent-condo`). There is no blended Milton-wide typical rent. `MegaInputs.context`
carries the page's hub into the composer so "available now" states the hub's count and its CTA is
`/rentals?neighbourhood=<hub>` (`itemOf` in `SiteNav.tsx`). Rentals left the Buy rail; the
homepage gate reads `menu-rent-now`. The landlord panel's CTA is `LandlordSignup`
(`src/components/nav/LandlordSignup.tsx`), source `landlord`, intent `sell`.

**THE CHROME IS ONE THING ON EVERY PAGE (MH-006).** Every page serves one forest bar
(`SiteNav`, via `SiteNavLive` on a server page, or handed `live` by a client page) and one
footer (`HomeFooter`, via `SiteFooter`). `Navbar.tsx` and `FooterSection.tsx` are deleted.
Pages with no theme of their own wrap in `SiteChrome` (bar, `site-chrome.css` forest body,
footer). The street templates end in `SiteFooter` now (both of them).

**THE NAV CARRIES ITS PAGE.** `NavContext` (`megaTypes.ts`): a street page passes
`{ street, hub }`, a hub passes `{ hub }`. From it: the bar CTA, the Sell panel CTA and the
phone CTA go to `/sell?street=<name>#valuation` or `/value/<hub>`; the brief form (menu and
footer) posts `property_address` / `neighbourhood` and `consentText`; the Streets and Sell
strips become the hub's streets, or the street's neighbours and its hub's busiest
(`src/lib/megaContext.ts`); the Rent "available now" is the hub's. `getMegaLive(context)`
memoises the INPUTS and composes per page.

**THE MENU EXISTS BEFORE HYDRATION.** The burger is a `<summary>`; the served HTML carries a
compact menu (search, every destination, the CTA) inside `<details class="sn-mobile">`, and
React swaps in the accordion on hydration and adopts an already-open panel. Every search form
is `action="/search" method="get"`, and `src/app/search/route.ts` redirects through the same
resolver the client uses. `/search` is robots-disallowed.

**THE FOOTER IS THE MAP.** Eight guides, schools and mosques with counts, the current edition,
`/compare/freehold-vs-condo`, Privacy and Terms, `/sold` once, `<h2>` then `<h3>`s, the brief
field beside the search well. `FooterData` grew `FooterMap` (`getFooterMap()` in
`hubFooter.ts`, shared by `getHubFooter()` and `getHomepageData()`).

## Scope of this worktree

`D:\miltonly-home` owns **the homepage, the header with its mega menu, the footer, the
neighbourhood hub template, and the chrome wrapper for pages with no theme of their own**.
It never touches generation or the database.

Owned files (added by MH-006 in bold):

- `src/app/page.tsx`, `src/app/layout.tsx` (header/footer wiring only)
- `src/components/home/*` including `home-theme.css`, `home-sections.css`, `footer.css`, `mockData.ts`
- `src/components/nav/*` (`BriefSignup.tsx`, `SiteChrome.tsx`, `SiteFooter.tsx`, `site-chrome.css`, **`LandlordSignup.tsx`** from MH-007)
- `src/components/hub/*`
- `src/lib/homepageData.ts`, `src/lib/megaLive.ts`, `src/lib/megaContext.ts`, **`src/lib/rentSignals.ts`**, `src/lib/figureFormat.ts`,
  `src/lib/neighbourhoodCards.ts`, `src/lib/homeSignals.ts`, `src/lib/hubData.ts`,
  `src/lib/hubStreetLadder.ts`, `src/lib/hubSchools.ts`, `src/lib/hubNearby.ts`, `src/lib/hubFooter.ts`
- **`src/app/search/route.ts`**
- `src/components/ChromeGate.tsx`
- `scripts/verify/checks/homepage.mjs`, `nav.mjs`, `hub-page.mjs`, **`footer.mjs`**, and the hub rows of `scripts/verify/lib/db.mjs`
- `scripts/probe-mobile-menu.mjs`, `scripts/probe-hub-contrast.mjs`

Touched outside that scope on `feat/rent-menu` (MH-007), one line each: `src/lib/lead/sources.ts`
(source `landlord`), `src/lib/lead/notify.ts` (its confirmation and subject), `src/lib/soldCachePurge.ts`
(`home:lease-market:*` in the sold sync's purge) and `scripts/test-sold-cache-purge.ts`.

Touched outside that scope on `feat/nav-v3`, each for the chrome and nothing else: the two
street templates (`SiteFooter` under `StreetFinalCtas`, `context` on `SiteNavLive`),
`street-theme.css` (the anchor reset scoped off the nav), twenty-odd `src/app/*/page.tsx`
(`FooterSection` to `SiteFooter`, `SiteChrome` around the pages that leaned on the root
layout's Navbar), `/saved` `noIndex`, and the addendum's body recolours (rentals, exclusive,
about, saved, signin, privacy, terms).

## Standing rules for this worktree

- **Every task prompt begins with `MH-`.** The report is `scratchpad/reports/MH-NNN-slug.md`,
  first line `# MH-NNN`, second line the worktree and branch, committed with the work.
- Keep this file updated instead of `HANDOFF.md`. Do not rewrite `HANDOFF.md` from here.
- Everything in the root `CLAUDE.md` still applies: pnpm only, exit-code gate, no em-dashes,
  "typical" not "median", terminal gets 10 lines or fewer, no clipboard writes.
- **Stop the local `next start` before `pnpm build`.** A running server holds the Prisma query
  engine DLL and the build fails on `EPERM ... query_engine-windows.dll.node`. Kill the
  listener on 3000 first (`Get-NetTCPConnection -LocalPort 3000`).
- **Local battery needs `VERCEL_GIT_COMMIT_SHA=local pnpm start` and `EXPECT_SHA=local`.**
- **The Bash tool collapses `\\` to `\` inside heredocs.** A Python patch fed through a heredoc
  turned `\\b` into a backspace byte inside a regex (MH-006, caught by `node --check`). Write
  patch scripts with the Write tool into the session scratchpad and run them from there.
- **Lighthouse is not a repo dependency.** MH-006 ran the audit's `nav-lighthouse.mjs`
  (`origin/feat/audit:scripts/audit/`) from the session scratchpad against an install left in
  the audit worktree's scratchpad (`.../D--miltonly-audit/35e0f245.../scratchpad/lh/node_modules/lighthouse/cli/index.js`).

## Where things stand

| | |
|---|---|
| rent branch head | **`91f8ef0b063b4114b2bbbc42e335b9becd11a783`** (`feat/rent-menu`, app), plus the docs commit carrying this handoff and the MH-007 report |
| rent preview | `https://miltonly-hwz0nkjza-gtahomequest-hubs-projects.vercel.app`, `--only=nav,homepage,hub-meta` **`PASS · 3 checks · 567 pages · 284s`** |
| chrome branch head | `3b56020c524525acf666906b670d0e85397b2c06` (`feat/nav-v3`), contained in the rent branch |
| local build | exit 0, zero `P2024`, prebuild all green, 149/149 static (MC-017's fifty-street prerender) |
| main | `60780ca` (MC-015), has neither branch |
| production | main's tip; the old chrome around the new menu and hubs |

## What `feat/nav-v3` carries, by audit change (MA-004, `scratchpad/nav-v3/MA-004.md`)

1. The scrolled homepage keeps its bar at every width (`fa01446`).
2. Every street page ends in the map footer, both templates (this task, last, after a merge of main).
3. The panel CTA is dark on green on every page type; `street-theme.css` scopes its anchor reset off the nav (`2e3b8e3`).
4. The listing page, the guides and every navy page on the forest chrome; `Navbar` and `FooterSection` deleted (`89535dd`).
5. The bar search on every page at 1024 and up; Address search first in the Streets rail; the `<details>` menu and `/search` (`ad547f8`).
6. The CTA, the brief form and the strips carry the street or the hub (`NavContext`).
7. The Sell panel states its two bases in one sentence (`basis` on the figures block); the date in prose; the A to Z lead no longer claims every page states sold prices.
8. The Alerts CTA is the brief form's own submit; `/saved` is `noIndex` and out of the nav; the footer has the brief field.
9. The footer is the map (above); 44px links on touch; 12px at 0.66 white on the compliance line.
10. Contextual strips; rail sub-labels (`sub`) and counted CTAs (`cta`) on `MegaItemContent`; skip link and `aria-label="Site"` on the nav; "Also" links 24px, 44px with the pills on a coarse pointer.

Addendum: `/rentals` (tokens remapped in `rentals.css`, its own footer removed, Fraunces headings),
`/exclusive` and `/exclusive/<slug>` (mojibake repaired, recoloured), `/about`, `/saved`, `/signin`,
`/privacy`, `/terms` and the 404 page recoloured onto the forest tokens under `SiteChrome`. `/sold`, `/listings`,
`/condos-guide`, `/potl` and `/compare` were already on forest themes and were not touched.

## Gates

- `nav.mjs`: the served chrome contract (label, skip link, GET search, `<details>` menu with its
  compact copy, no `/saved`), the CTA and strips following the page, sub-labels on the rail, the
  Rent contract (22 scoped hub links and counts, four typical rents, the landlord form as the CTA,
  Rentals out of Buy, the scoped CTA and hub count on hub and street pages); in a browser at 380,
  390, 1024 and 1440: four menus, the bar search on the page variant at 1024 and up, the phone
  panel under the 66px bar with 10 figures across its accordions, Escape closing the `<details>`,
  and two NO-JS runs. Rail orders: Buy `new, changes, condos, freehold, alerts`; Rent
  `now, hoods, typical, new, landlord`; Streets `search, hoods, video, az`; Sell `worth, soldmtd, watch`.
- `homepage.mjs`: the same chrome contract on the homepage's own render, plus the map footer's
  legal and guide links, `/sold` once, the brief form.
- `footer.mjs` (17th check, from `89535dd`): thirty page types, one map footer under one bar,
  every hub, every map destination, `<h2>`/`<h3>`, search well and brief form, every href 200.

## Traps, and decisions that must not be re-litigated

- **The brief form's watch kind is the lead path's.** `kindForSource("daily-brief")` is `brief`
  (`src/lib/lead/savedSearch.ts`, Leads' file). The menu and footer forms now post the street
  and hub and the consent text; turning a street-page brief signup into a street watch is a
  one-line change in that file, and it is Leads' call, not made here.
- **`/sell?street=` is linked from 509 pages now** (it already was, from the address ladder).
  `/sell` carries a static canonical, so the variants self-canonicalise.
- **`#00ff80` as text on the deep ground** (eyebrows on the recoloured pages, `--cta` on
  rentals) follows the hub theme's own use of `--h-green` for figures; it is not used on a light
  ground anywhere, where the accent is `#017848`.
- **`@media (pointer: coarse)`** carries the 44px targets. Lighthouse's mobile preset emulates
  touch, so it sees them; a desktop browser narrowed to 380 does not.
- **The phone panel sits UNDER the bar** (`top: 66px`) so the burger stays reachable as the close
  control with or without React. `nav.mjs` asserts that geometry; do not restore `inset: 0`.
- **A lease figure's floor is its own sample.** `getLeaseMarket()` gates each home type's
  whole-home typical on its whole-home count, its basement typical on its basement count, and the
  three landlord figures on the pool's; do not gate one on another. Per-hub counts are counts of
  advertised listings and are not gated (rentalsAvailable.ts).
- **The unit-class markers are regexes in `rentSignals.ts` and were inspected by hand.** "legal
  basement" and "main and second floor" without "only" classed whole townhomes as units and were
  dropped; the basement phrase counts only in the first 120 characters of the remarks. Re-inspect
  the classes (the report's table) before widening a pattern.
- **Version the `cached()` key when the shape changes.** Upstash is shared across builds; a row of
  the old shape under the same key was served for an hour (`home:lease-market:v3:<day>` now).
- **The figures block keys on its menu** (`menu-${menu.key}-${f.key}`); `menu-hub-active` is
  the Streets list's key and the battery counts it per page, so the Rent list uses `menu-rent-hub`.
- **The lease-market cache key is in `SOLD_WIDE_PATTERNS`.** A new `cached()` key over
  `sold.sold_records` fails `test-sold-cache-purge.ts` until it is.
- Everything in MH-002/003/004's trap lists still holds for the menu and the hub.

## Open, and owned elsewhere

- **Merge**, on Aamir's approval. Core merges the SHA.
- **The street watch from a brief signup** (above): Leads.
- **`/sold`'s own basis sentence** reconciling the Board's figures: Core's page. The panel now
  says why the three samples differ; the destination does not yet.
- **`/rentals` takes no neighbourhood filter**, so "I'm renting" is Milton-wide (from MH-004).

## Next action

Aamir reviews the rent preview (report has the URL). Core merges `feat/rent-menu` by SHA on
approval; it carries `feat/nav-v3`.

HOME · D:\miltonly-home · feat/menu-v2

# Handoff, homepage worktree

_Last rewritten 2026-09-11, MH-003: the rail drives the panel on `feat/menu-v2`, previewed, NOT merged._

## READ THIS FIRST

**`feat/menu-v2` IS PREVIEWED AND IS NOT MERGED.** Head `3ec8b51` (MH-003) on top of
`266f0f4` (MH-002, which carries `origin/main@854ffd3`, MC-006 included). Preview alias
`https://miltonly-git-feat-menu-v2-gtahomequest-hubs-projects.vercel.app`; the SHA-stamped
deployment and the battery line are in `scratchpad/reports/MH-003-rail-drives-panel.md`.
The brief was "stop; no merge". Core merges the SHA, never the branch name.

**THE LEFT RAIL DRIVES THE RIGHT PANEL (MH-003).** Each menu's rail is a `role="tablist"` of
`<button role="tab">` items; each selects its own panel on hover with the same 120ms intent,
on focus and on click, and the first is selected by default. Buy: new today, price changes,
condos, freehold, rentals, alerts. Streets: by neighbourhood, with video, A to Z, address
search. Sell: what's it worth, sold this month, market watch. Every item's panel is in the
served HTML on every page, one visible, each with at least one live block and its CTA. On a
phone each item is a nested `<details>`, the first open; a tap opens the rest inline.

**OPEN HOUSES WERE IN THE BRIEF AND ARE NOT BUILT.** The feed carries no open-house field on
any Listing row (checked the schema and the rows), so a panel of them could only be invented.
It returns when the feed carries one. Recorded in `src/lib/megaLive.ts` too.

**THE MENU IS ALIVE ON EVERY PAGE NOW.** It used to be alive on the homepage only. Twenty-one
server pages render `<SiteNavLive>` (`src/components/nav/SiteNavLive.tsx`), which awaits
`getMegaLive()` and hands the result to `<SiteNav>`; three client pages (`HomePage`,
`ValueLanding`, `BuildingAttributesPage`) are handed `live` by their server parents. A page that
renders `<SiteNav>` with no `live` gets the rails and the search, which is still a complete,
crawlable menu. `getMegaLive()` is memoised five minutes per instance, the same TTL and the same
dropped-rejection shape as `buildMiltonWideContext`.

**MH-001 (`fix/menu-hotfix` at `339293d`) is on main.** Its report and handoff state are in
`scratchpad/reports/MH-001-menu-hotfix-merge-main.md` and this file's git history.

## Scope of this worktree

`D:\miltonly-home` owns **the homepage, the header with its mega menu, and the footer**. It
never touches street pages, generation, or the database.

Owned files:

- `src/app/page.tsx`, `src/app/layout.tsx` (header/footer wiring only)
- `src/components/home/*` including `home-theme.css`, `home-sections.css`, `mockData.ts`
- `src/components/nav/*`: `SiteNav.tsx`, `SiteNavLive.tsx`, `megaTypes.ts`, `site-nav.css`
- `src/lib/homepageData.ts`, `src/lib/megaLive.ts`, `src/lib/figureFormat.ts`,
  `src/lib/neighbourhoodCards.ts`, `src/lib/homeSignals.ts`
- `src/components/ChromeGate.tsx` (only the `/` line)
- `scripts/verify/checks/homepage.mjs`, `scripts/verify/checks/nav.mjs`
- `scripts/probe-mobile-menu.mjs`, `scripts/probe-hub-contrast.mjs`

Touched outside that scope on `feat/menu-v2`, one line each, to swap `<SiteNav>` for
`<SiteNavLive>`: every server page and page component that renders the nav (21 files), plus
`src/app/condos/[slug]/page.tsx` and `src/app/value/[neighbourhood]/page.tsx` which read
`getMegaLive()` and pass it down. `TheBoard.tsx` imports the shared formatters instead of its
module-local copies.

## Standing rules for this worktree

- **Every task prompt begins with `MH-`.** The report is `scratchpad/reports/MH-NNN-slug.md`,
  first line `# MH-NNN`, second line the worktree and branch, committed with the work.
- Keep this file updated instead of `HANDOFF.md`. Do not rewrite `HANDOFF.md` from here.
- Everything in the root `CLAUDE.md` still applies: pnpm only, exit-code gate, no em-dashes,
  "typical" not "median", terminal gets 10 lines or fewer, no clipboard writes.
- **Stop the local `next start` before `pnpm build`.** A running server holds the Prisma query
  engine DLL and the build fails on `EPERM ... query_engine-windows.dll.node`. Kill the
  listener on 3000 first (`Get-NetTCPConnection -LocalPort 3000`).
- **The Bash tool collapses `\\` to `\` inside heredocs.** A Python heredoc that writes a regex
  with `\\b` lands a BACKSPACE byte in the file; it happened once in `megaLive.ts` and only
  `od -c` showed it. Write files with backslashes through the Write or Edit tool.

## Where things stand

| | |
|---|---|
| branch head | **`3ec8b51`** (MH-003), on `266f0f4` (MH-002 + `origin/main@854ffd3`) |
| preview | `https://miltonly-p5moxdfdn-gtahomequest-hubs-projects.vercel.app` at `3ec8b51`, alias `miltonly-git-feat-menu-v2` |
| battery on preview | `FAIL · 14 checks · 463 pages · 260s`: 2 assertions, both the pre-existing `sold-mtd` cache lag (51 vs 59, production prints 51 too); every nav assertion and the other 13 checks PASS |
| local build | exit 0 at `3ec8b51`, zero `P2024`, 24/24 prebuild, 556 static |
| local battery | `--only=nav` PASS at `3ec8b51`; `homepage` failed only on the page's own cached `sold-mtd` (see traps) |
| main | does NOT have this branch |
| production | main's tip; the old menu |

## What `feat/menu-v2` carries

MH-003 (`3ec8b51`), on top of everything MH-002 listed below:

- **The rail is a tablist.** `m-tab-<menu>-<item>` buttons with `aria-selected`, roving
  `tabindex`, `aria-controls`; `m-item-<menu>-<item>` tabpanels, all served, one visible.
  Hover with intent (mouse only, 120ms), focus and click all call one `select()`.
  ArrowUp/Down, Home/End walk the rail; focusing selects.
- **One block per item, from `composeMegaLive`** (`src/lib/megaLive.ts`, `getMegaExtras()`
  for everything the homepage does not already fetch): new today (24h, week, active; the
  newest four cards), price changes (`lastPriceChangeAt` in 7 days, widened to 30 when the
  week has none and the lead says which; prior price and direction only where
  DEC-PRICE-HISTORY observed the change), condos and freehold (the tenure hubs' own
  `propertySubType` sets, matched with and without PropTx's trailing space), rentals
  (`leaseStatus='active'`, "/mo"), alerts (this week's counts + the daily-brief signup through
  `postLead`, source `daily-brief`), by neighbourhood (22 hubs, counts), with video (eight
  posters), A to Z (published page count per letter, `/streets?letter=X`; `DirectoryGrid`
  reads the letter from the URL on mount), address search (the hero's resolver + the
  most-searched strip), what's it worth (the Board's row, window and sample per figure),
  sold this month (`getSoldThisMonth`, k-gated typical, "so far"), market watch (the latest
  published `MarketEdition`: its counts and its own summary sentence, linking the edition).
- **`getListingCards({ where, orderBy, take })`** in `listingsV2Data.ts` is the ONE exported
  way to run a custom slice of the feed through `toCard` and its address gate;
  `permAdvertise` and the city are ANDed in unconditionally.
- **"Also" row** in every panel's foot keeps the destinations the rail no longer names
  (recently sold, POTL, compare, exclusive; guides, schools, mosques, condo guide; freehold
  market, condo market, about), so the link graph loses nothing.
- **Gate.** `nav.mjs` declares a format for every `menu-` figure and fails on an unknown one;
  statically asserts per menu one selected tab, one visible item panel, none empty; in
  Chrome at 1024 and 1440 hovers every rail item and asserts selection, exclusivity, live
  content, CTA, viewport fit, no internal scroll, then ArrowDown focus-selection; at 380
  asserts the first item open by default and a tap opening each of the rest, none empty.
  `homepage.mjs` adds `menu-buy-rentals` (== the record, and so == /rentals) and
  `menu-sold-mtd`.

MH-002 (`10536c6`, `266f0f4`):

- **The trigger is a `<button>`** with `aria-expanded` and `aria-controls`; the panel's index
  page (`/listings`, `/streets`, `/sell`) is the panel's CTA. All three panels are in the
  served HTML on every page, closed with `hidden`.
- **One full-bleed band** (`.m-band`) under the bar, anchored to the fixed nav, capped at
  `calc(100vh - 66px)`. Measured at 1024x768 and 1440x900: inside the viewport, no internal
  scroll, on all three panels.
- **Interaction.** Hover opens after 120ms of intent (mouse only, `pointerType` checked) and
  leaving the nav closes after 220ms; click toggles; Enter, Space and ArrowDown open AND move
  focus into the panel; ArrowLeft/Right walk the triggers; Escape closes AND returns focus to
  the trigger; Tab out of the panel closes; outside mousedown, scroll and resize close.
- **One true thing per panel**, in Fraunces at 22px, built server-side from live figures:
  Buy `461 homes for sale in Milton, 56 new this week.`; Streets `449 Milton streets with
  their own page, 40 filmed end to end.`; Sell `Over the last 13 weeks, urban Milton homes
  sold for 98.1% of asking, in 28 days.` (absent when either figure is suppressed).
- **Buy**: four newest listings through `getNewestListingCards` (display gate applied in
  `toCard`), with photograph, price, beds, baths, days on market and the PUBLISHED hub name.
  Addresses lose their `, Milton, Ontario` suffix in the composer.
- **Streets**: a street search (the hero's `resolveHeroHref`), every published hub with its
  live listing count (alphabetical), four film posters.
- **Sell**: the Board's `overall` row, three figures with window AND sample each, and one
  line of existing site copy about grounded valuations.
- **Three strips, three queries** (`getMegaStrips()`): Buy = most active listings by
  `streetSlug`; Streets = GSC impressions per `/streets/` page from `SeoOpportunity` when six
  or more streets rank, else 12-month sales with the label saying so; Sell = `soldCount12mo`.
  All intersected with `publishedStreetPageSlugs()`.
- **`/map` and `/book` removed** from the rails (both redirect). `/guides` and
  `/market-watch` added. The FOOTER still links `/book`; not this task's scope, and it is
  a 307.
- **Type floor 14px** in the menu, including the mono labels and the caret glyph; the bar's
  own links and CTA moved from 13px to 14px.
- **Mobile**: the same `Lead`, `Rail`, `Live`, `Strip` and CTA components inside native
  `<details>`, plus the street search at the top. Mounted on open, so the served HTML carries
  one copy of every link (the desktop band's).
- **`scripts/verify/checks/nav.mjs`**: static over five page types, then Chrome at 380, 1024
  and 1440 on `/` and `/streets`. Chrome comes from puppeteer's own download or `CHROME_PATH`.
- **`homepage.mjs`**: triggers asserted as `<button>`; `menu-buy-active`, `menu-buy-new`
  and `menu-streets-pages` join `FIG_SPECS` by value and format.

## Traps, and decisions that must not be re-litigated

- **`getSoldThisMonth` is cached an hour in the shared Upstash, and the record is live.** On
  2026-09-11 the homepage's own `sold-mtd` printed 51 (cache, 31 minutes left) against 59
  live; the menu's `menu-sold-mtd` reads the same function and printed the same 51. The
  gate is right to fail; the fix is not in the menu. The two surfaces agreeing is the
  property that matters. Re-run after the cache turns over before diagnosing.
- **An item's panel is never empty.** `nav.mjs` counts live blocks (`LIVE_BLOCK`) per item
  in the HTML and in the browser. A quiet day is handled in the composer (the newest four
  when fewer than four listed today; a 30-day window when the week has no price change),
  never by hiding the item.
- **Every `menu-` figure needs a row in `FIG_FORMAT`.** A figure with no stated format is a
  finding, not a pass.

- **`composeMegaLive()` is the only place a menu string is built.** Two callers (the
  homepage's `buildMegaLive`, everything else's `getMegaLive`), one formatter. Do not format
  in `SiteNav.tsx`. `MegaLive` carries display strings, not numbers.
- **`src/lib/figureFormat.ts` is the formatter.** `formatMoney1k`, `formatPct1`,
  `formatDays`, `formatCount`, `formatMoneyWhole`. The Board imports them. A new figure on
  any surface goes through here; the battery asserts the menu equals the Board on
  `data-value`, which is the same string because it is the same function.
- **The hover open is mouse-only.** `pointerType !== 'mouse'` returns early, so a finger on
  a tablet never opens a panel it did not tap. Do not "simplify" to `mouseenter`.
- **Hover does not steal focus; the keyboard does.** `focusIntoPanel` is set only by
  Enter/Space/ArrowDown. A hover-opened panel leaves focus where the user is typing.
- **The strips are three different questions.** The battery asserts the three link sets on a
  page are not identical. A shared "in demand" list will fail it.
- **The Streets strip's source is named in its label.** "Most searched on Google" only when
  `SeoOpportunity` ranks six or more published streets; the rows are the sense run's
  opportunity classes, not the whole GSC stream, so the counts are a floor. Otherwise
  "Busiest streets, last 12 months". Never label one as the other.
- **Every strip link is a published page.** Candidate slugs are intersected with
  `publishedStreetPageSlugs()`, the sitemap's own set; the nav check resolves every href and
  fails on a redirect or a non-200.
- **The nav is one `<nav>` element and the band is inside it.** `homepage.mjs` and `nav.mjs`
  read the first `<nav>...</nav>`; a second nav or a band rendered outside it blinds both.
- **The mobile panel mounts on open.** Rendering it always would double every menu link in
  the served HTML. The desktop band is the crawlable copy; the phone panel is the same
  components again, client-side.
- **A moving count can fail the battery once and pass the next minute** (MH-001's `scott`).
  Re-run before diagnosing a one-hub, off-by-one count mismatch as a code defect.
- **`--h-text-faint` is the floor for small text on the hub hero** (0.56, 5.46:1). Lowering
  it takes every label on 22 hubs back under 4.5:1.
- **A price *drop* is not derivable.** Do not re-add `priceReduced`.
- **Three counts, three sets, one of them "pages".** `publishedStreetPageSlugs()` only.
- **One neighbourhood price, from `getNeighbourhoodCards()`.** No active list-price average.
- **A LEASE NEVER CARRIES `status='active'`.** `getRentalsAvailableCount()` is the one source.
- **A dead fragment is the quietest defect.** `hub-intents.mjs` resolves route and fragment.
- **Never hand-roll a listing query.** `getNewestListingCards` applies the display gate.

## Open, and owned elsewhere

- **The hub rebuild** (`c98f40e` on `feat/homepage`) is unmerged. HANDOFF.md item 24.
- **The footer's `/book`** is a 307 to `/about`. Fix or remove when the footer is next touched.
- **Every page now pays `getMegaLive()` once per instance per five minutes.** At build that is
  once per prerender worker. The build passed at `connection_limit=10` with zero `P2024`
  twice; if pool timeouts return, this is the first suspect.
- **The design was reviewed from screenshots at 1440, 1024 and 380** (`scratchpad/menu-v2/`,
  untracked). Nobody has used it by hand.

## Next action

Aamir reviews the preview. Core merges `266f0f4` on approval. Hubs resume after.

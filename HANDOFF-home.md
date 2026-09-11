HOME · D:\miltonly-home · feat/menu-v2

# Handoff, homepage worktree

_Last rewritten 2026-09-11, MH-002: the mega menu rebuilt on `feat/menu-v2`, previewed, battery green at 14 checks, NOT merged._

## READ THIS FIRST

**`feat/menu-v2` IS PREVIEWED AND GREEN, AND IS NOT MERGED.** Head `266f0f4`, which is the
menu commit `10536c6` plus a merge of `origin/main` at `854ffd3` (MC-006 landed there as
`339293d`). Preview alias `https://miltonly-git-feat-menu-v2-gtahomequest-hubs-projects.vercel.app`.
Battery on that deployment (`miltonly-p3vklhhp6`, serving `266f0f4`): **`PASS · 14 checks · 456 pages · 187s`**, exit 0.
The brief was "stop; no merge". Core merges the SHA, never the branch name.

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
| branch head | **`266f0f4`**, merge of `origin/main@854ffd3` into the menu commit `10536c6` |
| preview | `https://miltonly-p3vklhhp6-gtahomequest-hubs-projects.vercel.app` at `266f0f4`, alias `miltonly-git-feat-menu-v2` |
| battery on preview | **`PASS · 14 checks · 456 pages · 187s`**, exit 0, at `266f0f4` |
| local build | exit 0 at `10536c6` and at `266f0f4`, zero `P2024`, 24/24 prebuild, 556 static |
| local battery | `--only=nav,homepage` against the built app: PASS, twice |
| main | does NOT have this branch |
| production | main's tip; the old menu |

## What `feat/menu-v2` carries

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

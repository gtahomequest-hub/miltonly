HOME · D:\miltonly-home · fix/menu-hotfix

# Handoff, homepage worktree

_Last rewritten 2026-09-11, MH-001: `fix/menu-hotfix` merged with main, previewed, battery green, awaiting Core's merge._

## READ THIS FIRST

**`fix/menu-hotfix` IS READY FOR CORE TO MERGE AT `339293de98b56066b7c759c7420efce0b3b30740`.**
Preview `https://miltonly-isrc7ku73-gtahomequest-hubs-projects.vercel.app` serves that SHA
(`/api/build`). Battery on it: **`PASS · 11 checks · 449 pages · 89s`**, exit 0. Merge the SHA,
not the branch name. Commits after it touch docs only; `git diff 339293d..HEAD -- src scripts`
is empty. Report: `scratchpad/reports/MH-001-menu-hotfix-merge-main.md`.

**THE HUB REBUILD IS NOT ON THIS BRANCH.** Main reverted it (`2e3cc50`) and cherry-picked the
approved fix back (`1cf5342`). Merging main into this branch (`e2a7f19`) carried that revert:
`sections.tsx` is the `h-` template again and `hub-sections.css` is gone. This branch's two
fixes to `hub-sections.css` (the `.hh-glance` specificity and the basis-line alpha) are gone
with it. They are still in this branch's history (`44b6dfa`, `3283178`) for the day the
rebuild returns, and HANDOFF.md item 24 states what must land WITH it.

**The same contrast defect existed on the template that IS on main, and is fixed there.**
`--h-text-faint` in `hub-theme.css` colours every hub hero's small text (tile labels, intent
subtitles, crumb, silent tile value). At 0.45 on `#073126` it measured 4.05:1 on all 22 hubs at
380 and 1440; it is 0.56 (5.46:1) at `339293d`. Measured with
`node scripts/probe-hub-contrast.mjs <base> walker`.

## Scope of this worktree

`D:\miltonly-home` owns **the homepage, the header with its mega menu, and the footer**. It
never touches street pages, generation, or the database.

Owned files:

- `src/app/page.tsx`, `src/app/layout.tsx` (header/footer wiring only)
- `src/components/home/*` including `home-theme.css`, `home-sections.css`, `mockData.ts`
- `src/components/nav/*`: `SiteNav.tsx`, `megaTypes.ts`, `site-nav.css`
- `src/lib/homepageData.ts`, `src/lib/neighbourhoodCards.ts`, `src/lib/homeSignals.ts`
- `src/components/ChromeGate.tsx` (only the `/` line)
- `scripts/probe-mobile-menu.mjs`, `scripts/probe-hub-contrast.mjs`

Touched outside that scope on this branch, each for a defect visible in production: the
Board's em-dashes (`TheBoard.tsx`, `ThinSegmentCard.tsx`), `PreFooterCTA.tsx` (the brief's
day), `hub-theme.css` (the contrast token), and the three verify checks.

## Standing rules for this worktree

- **Every task prompt begins with `MH-`.** The report is `scratchpad/reports/MH-NNN-slug.md`,
  first line `# MH-NNN`, second line the worktree and branch, committed with the work.
- Keep this file updated instead of `HANDOFF.md`. Do not rewrite `HANDOFF.md` from here.
- Everything in the root `CLAUDE.md` still applies: pnpm only, exit-code gate, no em-dashes,
  "typical" not "median", terminal gets 10 lines or fewer, no clipboard writes.

## Where things stand

| | |
|---|---|
| branch head, code | **`339293d`**, `fix(hub): the hero's small text has to clear 4.5:1` |
| merged from main | `00e0eb1` (main's tip on 2026-09-11 11:10 ET), as `e2a7f19` |
| preview | `miltonly-isrc7ku73` at `339293d`, alias `miltonly-git-fix-menu-hotfix` |
| battery on preview | **`PASS · 11 checks · 449 pages · 89s`**, exit 0 |
| local build | exit 0 at `e2a7f19` and `339293d`, zero `P2024`, 23/23 prebuild, 549 static |
| main | does NOT have this branch. Core merges `339293d` |
| production | main's tip; none of this branch is live |

## What this branch carries over main

Seven commits, `git log origin/main..339293d`:

- `44b6dfa` **four live defects.** (1) The mobile panel was 66px tall on every page:
  `backdrop-filter` on the `<nav>` made it the containing block for the panel's
  `position:fixed; inset:0`. The blur is removed from both navs; the nav background is opaque
  so it never blurred anything. (2) The Sell panel printed raw floats (`$937,465.504`,
  `27.829694323144103`, the ratio with a `%` welded on). `MegaLive.sell.figures` now carries
  display strings built server-side with the Board's own helpers, each with its own window.
  (3) The rebuild's derived-fact panel, gone with the revert. (4) Four rendered em-dashes:
  footer tagline, valuation kicker, brief standfirst, Board price-band note.
- `92516a9` the brief is weekday mornings (`/api/brief/send` runs `15 13 * * 1-5`), not Sundays.
- `90efab8` `hub-meta` and `hub-intents` read both templates; the menu-vs-Board comparison
  reads `data-value`; the en-dash rule skips chunks with no letters.
- `3283178` basis-line alpha in the rebuild's stylesheet (gone with the revert, see above).
- `7aa03cf` the two probes under `scripts/`, taking a base URL.
- `e2a7f19` the merge. `339293d` the `hub-theme.css` token.

The homepage gate (`scripts/verify/checks/homepage.mjs`) now asserts the menu's three market
figures equal what the Board renders on the same page (compared on `data-value`), that nothing
carrying `data-fig` renders a raw float, and that no text node carries an em-dash or a prose
en-dash, with two stated exemptions (the OGL attribution and a standalone null glyph).

## Confirmed on the preview at 380 (MH-001)

- `/` and `/streets`: `.sn-panel` is `position:fixed`, 380x780 from top 0, `overflow-y:auto`,
  zero ancestors creating a containing block. `scripts/probe-mobile-menu.mjs <base>`.
- `/neighbourhoods/walker`: three tiles `$1.03M` / `54` / `18`, 30px white, no overflow; no
  element on the hub under 4.5:1. `scripts/probe-hub-contrast.mjs <base> walker` prints
  nothing but `done`.
- `<footer>` text: zero U+2014.
- Sell panel: `$924,000` / `28 days` / `98.1%` in both text and `data-value`.

## Traps, and decisions that must not be re-litigated

- **A merge from main carries main's reverts.** Files this branch did not touch took main's
  version silently; only `hub-sections.css` conflicted because this branch had edited it. Read
  `git diff --stat <merge-base> origin/main` before assuming a merge only adds.
- **A moving count can fail the battery once and pass the next minute.** `scott` read 121
  sales on the page and 122 live during the first preview run; the page served 122 seconds
  later. Re-run before diagnosing a one-hub, off-by-one count mismatch as a code defect.
  Stop-on-failure still applies to anything systemic.
- **The Sell figures are display strings.** `MegaLive.sell.figures[].value` is already
  formatted, with its window beside it. The component must not parse or reformat it.
- **`--h-text-faint` is the floor for small text on the hub hero.** 0.56 measures 5.46:1 on
  `#073126`. Lowering it takes every label on 22 hubs back under 4.5:1.
- **The null marker in a figure is a lone glyph, not prose.** A suppressed Sell figure renders
  a single dash character with no letters in the node, which is the stated exemption in the
  em-dash rule. Do not replace it with a word.
- **A price *drop* is not derivable.** `Listing.lastPriceChangeAt` marks a change; no prior
  price is read on the serving side of this branch. Do not re-add `priceReduced`.
- **Three counts, three sets, one of them "pages".** `publishedStreetPageSlugs()` is the
  page set; `surfacedStreetWhere()` is the ladder set; a raw `StreetContent` count includes an
  address artifact the sitemap refuses. Never state a page count from anything else.
- **One neighbourhood price, from `getNeighbourhoodCards()`.** No active list-price average.
- **A figure crossing a component boundary carries its unit in its name.**
  `BoardTab.soldToAsk.value` is a ratio; the homepage reads `soldToAskPct`.
- **A presence assertion is not a value assertion.** The gates read rendered text.
- **A LEASE NEVER CARRIES `status='active'`.** `getRentalsAvailableCount()` is the one source.
- **A dead fragment is the quietest defect.** `hub-intents.mjs` resolves route and fragment;
  renaming `id="streets"` on `HubStreets` needs `intentsFor()` changed in the same commit.
- **Never hand-roll a listing query.** `getNewestListingCards` applies the display gate.

## Open, and owned elsewhere

- **The hub rebuild** (`c98f40e` on `feat/homepage`) is unmerged. HANDOFF.md item 24: the
  two checks and the sub-k `silent` model must land WITH it, and that last one is a
  k-anonymity change needing its own review. This branch's `hub-sections.css` fixes belong in
  that work.
- **380px is measured, not eyeballed.** The probes measure boxes and contrast; nobody has
  looked at a screenshot of the final preview.

## Next action

Core merges `339293d`. After it lands: `EXPECT_SHA=<main tip> BASE=https://miltonly.com node
scripts/verify/run.mjs`, then the two probes against `https://miltonly.com`.

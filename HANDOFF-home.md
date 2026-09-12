HOME · D:\miltonly-home · feat/hubs-v2

# Handoff, homepage worktree

_Last rewritten 2026-09-11, MH-004: the hub rebuild on `feat/hubs-v2`, previewed, NOT merged._

## READ THIS FIRST

**TWO BRANCHES FROM THIS WORKTREE ARE PREVIEWED AND NOT MERGED, AND ONE STACKS ON THE OTHER.**

- `feat/menu-v2` at `3ec8b51` (MH-003, the menu). Handoff state for it is in this file's git
  history and `scratchpad/reports/MH-003-rail-drives-panel.md`. Unchanged by MH-004.
- `feat/hubs-v2` (MH-004, the hubs) was branched FROM `feat/menu-v2` (`ef8d70b`), then
  `origin/main@15835ed` merged in as `c393c4b`, then the hub work. So merging `feat/hubs-v2`
  by SHA brings the menu with it. Merge order that keeps every preview honest: `3ec8b51`
  first, then the hubs SHA. Merging the hubs SHA alone also works, it just lands both.
  The preview URL, the SHA and the battery line are in
  `scratchpad/reports/MH-004-hub-rebuild.md`. The brief was "stop; no merge".

**THE HUB IS REBUILT ON DERIVED FACTS (MH-004).** `src/components/hub/sections.tsx` and
`hub-sections.css` (`.hub-v3`), data from `src/lib/hubData.ts`. Nothing static survives on the
page: the glance is `HubFact[]` (value, label, basis, href), the sibling cards lost their
hand-written character line, the intent squares land on hub-scoped destinations. Every figure
prints its basis in the same block. The ladder is EVERY published street in the hub, each row
carrying the street page's own k-gated typical, its disclosure line, and "sample too small to
publish" below k; the sold count is always printed. Film strip first (all filmed streets in the
hub, horizontally scrolling), ladder second, the A-to-Z index third.

**THE HUB GATE IS `scripts/verify/checks/hub-page.mjs`** (15th check). Every `data-fig` outside
the site nav must have a row in its `FIG_SPECS` (source, pattern, tolerance) or it is a
finding; the ladder must equal the hub's published street set; each ladder row's typical AND
basis must equal the street page's hero tile as rendered in the same crawl; every internal
href must be 200 (no redirect) and every fragment must match an id; JSON-LD must parse and its
ItemList must count the ladder. `loadHubRecord()` in `scripts/verify/lib/db.mjs` grew
`hubPage(slug)` (published/filmed street counts, active listings, the dominant-type share) and
`miltonTypicalRounded`. It is a per-page check, so it puts the street crawl back into any
`--only=` run that includes it.

**c98f40e IS ABSORBED.** The WIP hub commit on `feat/homepage` was applied three-way onto this
branch and finished. `feat/homepage` itself is now historical: everything approved from it is
on main, everything unapproved is superseded here.

## Scope of this worktree

`D:\miltonly-home` owns **the homepage, the header with its mega menu, the footer, and the
neighbourhood hub template**. It never touches street pages, generation, or the database.

Owned files (added by MH-004 in bold):

- `src/app/page.tsx`, `src/app/layout.tsx` (header/footer wiring only)
- `src/components/home/*` including `home-theme.css`, `home-sections.css`, `mockData.ts`
- `src/components/nav/*`
- **`src/components/hub/*`** (`HubPage.tsx`, `sections.tsx`, `hub-sections.css`, `types.ts`,
  `mockData.ts`; `hub-theme.css` and `icons.tsx` are shared with the tenure hubs)
- `src/lib/homepageData.ts`, `src/lib/megaLive.ts`, `src/lib/figureFormat.ts`,
  `src/lib/neighbourhoodCards.ts`, `src/lib/homeSignals.ts`
- **`src/lib/hubData.ts`, `src/lib/hubStreetLadder.ts`, `src/lib/hubSchools.ts`,
  `src/lib/hubNearby.ts`, `src/lib/hubFooter.ts`**
- `src/components/ChromeGate.tsx` (only the `/` line)
- `scripts/verify/checks/homepage.mjs`, `scripts/verify/checks/nav.mjs`,
  **`scripts/verify/checks/hub-page.mjs`**, and the hub rows of `scripts/verify/lib/db.mjs`
- `scripts/probe-mobile-menu.mjs`, `scripts/probe-hub-contrast.mjs`

Touched outside that scope on `feat/hubs-v2`: `src/lib/tenureHubData.ts` and
`src/components/tenure/tenure-sections.tsx`, because the tenure hubs share `HubData` and
`HubAtAGlance` became a fact list (their entries are definitional and say so in their basis;
the asking-price range now states it is an asking range over N active listings, which it
always was). `src/app/neighbourhoods/[slug]/page.tsx` swaps `FooterSection` for the homepage
footer through `getHubFooter()`.

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
  `/api/build` reports `unknown` otherwise and the deployment gate aborts.
- **The Bash tool collapses `\\` to `\` inside heredocs, and long heredocs can fail to parse
  at all.** Write patch scripts with the Write tool into `scratchpad/hubs-v2/` and run them.
  `/tmp` in Git Bash is not `/tmp` in Python on this machine; keep scratch files in the repo
  scratchpad or the session scratchpad, never `/tmp`.

## Where things stand

| | |
|---|---|
| branch head | **`26af26b`** (MH-004), on `c393c4b` (`feat/menu-v2@ef8d70b` + `origin/main@15835ed`) |
| preview | `https://miltonly-46hylje3o-gtahomequest-hubs-projects.vercel.app` at `26af26b` |
| battery on preview | **`PASS · 15 checks · 481 pages · 547s`** at `26af26b` |
| local build | exit 0, zero `P2024`, 24/24 prebuild, 581 static |
| `feat/menu-v2` | `3ec8b51`, previewed, not merged, unchanged |
| main | has neither branch |
| production | main's tip; the old menu and the old hub |

## What `feat/hubs-v2` carries

- **The glance, derived.** `buildFacts()` in `hubData.ts`: typical sale price with `across N
  sales in the last 12 months` (or, sub-k, the sale count with "below the publication floor of
  five"); streets with a page (`#streets`); streets filmed (`#film`); schools inside the
  boundary (`#schools`, by position against the Town polygons, `hubSchools.ts`); homes for
  sale today (`/listings?neighbourhood=<token>`); the dominant housing form as a share of
  12-month sales, suppressed under k5. A fact with an empty source is not rendered.
- **The ladder is the street page.** `hubStreetLadder.ts` takes two grouped DB2 queries
  (12-month and full record, `COUNT(*)`, `COUNT(sold_price)`, `SUM`), pools by
  `deriveIdentity(slug).identityKey` (the same identity `resolveSiblingSlugs` keys on),
  graduates 12mo-then-full at k5, rounds through `roundPriceForProse`. No cap: 48 rows on
  Beaty, 1 on Moffat. Ranked by the pooled 12-month count the row prints.
- **Intent squares.** buying -> `/listings?neighbourhood=<token>` with the live active count;
  selling -> `/value/<slug>`; renting -> `/rentals` (it takes no hood filter); investing ->
  `/sold?nbhd=<slug>` with the 12-month sale count. `listingsFilterToken()` strips the TREB
  prefix (`1037 - TM Timberlea` -> `Timberlea`, `1051 - Walker` -> `Walker`) and picks the
  shortest token every raw string of the hub contains.
- **Nearest neighbourhoods by position.** `hubNearby.ts`: boundary centre per hub from the
  Town polygons; the four nearest published hubs of either tier, distance printed to 0.1 km.
  The four rural hubs with no polygon (nassagaweya, campbellville, brookville-haltonville,
  moffat) get "Other rural neighbourhoods" and no distance. Cards print typical, sample and
  street-page count; `data-fig="hub-sibling-typical"` is asserted per slug.
- **Market section.** The compare row carries both bases (hub sample, Milton sample) and
  `data-fig="hub-compare-typical"` / `hub-compare-milton`; Milton's is
  `buildMiltonWideContext` k-gated and round5k'd, the same as every hub figure.
- **Section numbers are computed** (`idx()` in `sections.tsx`) so a hub with no film, no
  schools or no condos never shows 01 then 03.
- **The footer** is `HomeFooter` inside a `.home-v2` wrapper (its rules are scoped there). Its
  two redirecting links are gone: `/map` -> `/market-watch`, `/book` -> `/guides`. This
  changes the homepage footer too.
- **Contrast.** Small text on the forest and deep grounds sits at 0.62 white or above; the
  `.hh-glance` ground needed `.hh-sec.hh-glance` specificity or the generic `.hh-sec` cream
  won by source order and painted white figures on cream. `probe-hub-contrast.mjs` reads the
  `.hh-*` small-text classes now and returns nothing under 4.5:1.

## Traps, and decisions that must not be re-litigated

- **The ladder's count column is the 12-month pooled count; the basis line may name a
  different sample.** "4 sales / across 6 sales in the last ~2 years" is the street page's own
  graduated state, reproduced exactly. Do not "fix" the row to make the two numbers agree.
- **Money tolerance in `hub-page.mjs` is "the exact rendering passes, else 500".** `$2.12M`
  is 2,115,000 printed to two decimals; a numeric tolerance alone fails it.
- **`hub-fact-schools` has no page-independent source in the record.** It is asserted against
  the schools list on the same page, and every school link is resolved. The polygon test is
  the app's; the record does not re-run it.
- **A moving count can fail once and pass the next minute** (active listings, sales). Re-run
  before diagnosing a one-hub, off-by-one mismatch as a code defect.
- **The film strip shows every filmed street in the hub** (Ford: 19), not eight. A poster that
  cannot be derived drops the card but not the count; the gate would then report a dead
  `#film` fragment on a hub whose only filmed streets lack posters. None do today.
- **`hub-meta.mjs` already parses the `.hh-fact` markup** and passed on all 22. Its sub-k
  model reads the sale count out of the typical slot, which is the rebuilt page's contract.
- **The overflow page `/neighbourhoods/<slug>/streets` is Core's and is untouched.** It is
  rung three (A to Z) above the 12-street cap; below the cap the hub links `/streets`. With
  the ladder uncapped, the overflow page is now a sorted duplicate of the hub's list. Whether
  it stays is Core's call, noted in the report.
- **The hub `<title>` and meta description carry em-dashes.** They come from
  `src/lib/ai/hub/hubMeta.ts`, the one shared formula that `hub-meta.mjs` parses. Not touched
  here; Core's.
- Everything in MH-002/003's trap list still holds for the menu.

## Open, and owned elsewhere

- **Merge order.** `3ec8b51` (menu) then the hubs SHA; or the hubs SHA alone, which lands
  both. Core's call on approval.
- **The overflow page's purpose** now that the hub lists every street (above).
- **`/rentals` takes no neighbourhood filter**, so "I'm renting" is Milton-wide. A hood filter
  on `/rentals` (Core's page) would let the square scope like the other three.
- **School positions are approximate for centroid-placed schools** (`src/lib/schools.ts`).
  The basis line says "position", the standfirst says it is not a catchment.

## Next action

Aamir reviews the hub preview (three URLs in the report). Core merges by SHA on approval.

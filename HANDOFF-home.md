HOME · D:\miltonly-home · feat/home-hero-design

# Handoff, homepage worktree

_Last rewritten 2026-10-02, MH-012: the homepage hero designed at `/design-preview/home` on `feat/home-hero-design`, previewed, a design for review, NOT for merge. MH-011 below is unchanged and still waiting for review._

## READ THIS FIRST

**TWO HOME BRANCHES ARE PREVIEWED DESIGNS, NOT MERGE CANDIDATES. Core merges by SHA on approval (DEC-MERGE-CORE-ONLY); neither has been approved.**

- **`feat/home-hero-design @ c7fd3ee` (MH-012, the homepage hero). A DESIGN FOR REVIEW.**
  - **Branch and preview.** Cut from `origin/main @ f0b8bb7` (contains `aa8c9d8`, MC-046 Stage 1). Preview
    `https://miltonly-hokave4jn-gtahomequest-hubs-projects.vercel.app/design-preview/home` (`dpl_GbM2NFDdwKLpYuf6D99kHszMKwJz`), the only one.
    `?option=a|b|c` switches the hero: A Road, B Sentences, C Doors. A bare `?b` or `?c` does the same (for the leak test's `--explain`).
  - **What it is.** The live homepage with a new hero: the real `SiteNav` (registrant strip), the hero, then `HomePage`'s own sections on the same live
    data. Noindex, nofollow, nocache; not in the sitemap; not linked. `src/components/home/*` and `src/app/page.tsx` are untouched.
  - **The links** are one list, `src/components/home-design/links.ts`: 5 page targets (all 200), 1 phone number, 1 in-page focus of the search, 2 planned
    (`/invest`, `/sell-and-buy`, drawn and marked, not links). Every link carries `data-hero-side` and `data-hero-intent`.
  - **The gate.** Local gate exit 0, 0 `P2024`, 842/842. Local battery at `c7fd3ee` `--only=homepage,nav,phone-390,vow-display` `PASS · 4 checks · 719 pages · 184s`.
    Preview battery `--only=homepage,nav,phone-390,vow-display,leak` `PASS · 5 checks · 719 pages · 1065s`. Leak test on the preview `CLEAN · 6170 responses · 0 findings`; `--explain` on each option: 0 value and 0 class findings.
    `scratchpad/mh012/verify.mjs` PASS locally and on the preview.
  - **The pick is C, Doors.** Record in `scratchpad/reports/MH-012-home-hero-design.md`.
- **`feat/street-design @ f5b3bab` (MH-011, the street page design). A DESIGN FOR REVIEW.** Preview
  `https://miltonly-afug36ojd-gtahomequest-hubs-projects.vercel.app/design-preview/street`, `?palette=a|b|c`, `?view=visitor|registered`. Its own
  `HANDOFF-home.md` is on that branch (`ff09e13`). Record in `scratchpad/reports/MH-011-street-design.md`.

**MERGED SINCE MH-011:** MH-010 `feat/home-voice @ 12dc3f7` as `96a606c` and MH-009 `7cfa4a2` (already on main as `f1d4080`), both in MC-050.
Every earlier Home branch is merged too (MH-005 to MH-008). Do not add commits to any of them.

**BOTH DESIGN PREVIEWS SHARE ONE `ChromeGate` LINE.** `pathname?.startsWith("/design-preview/")`, byte-identical on both branches, so either can
merge first without a conflict. Neither needs a branding exemption that the other lacks: MH-012's page renders `SiteNav`, so
`scripts/test-vow-branding.ts` passes it as is; MH-011's page is in that test's `EXEMPT` set on its own branch.

**PREVIEWS COME FROM THE CLI.** `npx vercel deploy --yes --env VERCEL_GIT_COMMIT_SHA=<sha> --build-env VERCEL_GIT_COMMIT_SHA=<sha>` from the
worktree, or `/api/build` says `unknown` and the battery aborts. One preview per code task (DEC-ONE-PREVIEW).

**THE LOCAL GATE RUNS FROM GIT BASH, THROUGH COREPACK.** `corepack pnpm build > build.log 2>&1`, judged by exit code. PowerShell has no `bash`,
so `scripts/test-vercel-ignore.ts` fails there on a build that is fine. Puppeteer launches the installed Chrome at
`C:/Program Files/Google/Chrome/Application/chrome.exe`.

## Scope of this worktree

`D:\miltonly-home` owns **the homepage, the header with its mega menu, the footer, the
neighbourhood hub template, and the chrome wrapper for pages with no theme of their own**, and
takes voice tasks on the shared components when a brief assigns them. It never touches generation
or the database.

Owned files:

- `src/app/page.tsx`, `src/app/layout.tsx` (header/footer wiring only)
- `src/components/home/*` including `home-theme.css`, `home-sections.css`, `footer.css`, `mockData.ts`
- `src/components/nav/*` (`BriefSignup.tsx`, `SiteChrome.tsx`, `SiteFooter.tsx`, `site-chrome.css`, `LandlordSignup.tsx`)
- `src/components/hub/*`
- `src/lib/homepageData.ts`, `src/lib/megaLive.ts`, `src/lib/megaContext.ts`, `src/lib/rentSignals.ts`, `src/lib/figureFormat.ts`,
  `src/lib/neighbourhoodCards.ts`, `src/lib/homeSignals.ts`, `src/lib/hubData.ts`,
  `src/lib/hubStreetLadder.ts`, `src/lib/hubSchools.ts`, `src/lib/hubNearby.ts`, `src/lib/hubFooter.ts`
- `src/app/search/route.ts`, `src/components/ChromeGate.tsx`, `src/components/VercelAnalytics.tsx` (MH-009)
- On the design branches only: `src/app/design-preview/home/page.tsx` and `src/components/home-design/*` (MH-012),
  `src/app/design-preview/street/page.tsx` and `src/components/street-design/*` (MH-011)
- `scripts/verify/checks/homepage.mjs`, `nav.mjs`, `hub-page.mjs`, `footer.mjs`, and the hub rows of `scripts/verify/lib/db.mjs`
- `scripts/probe-mobile-menu.mjs`, `scripts/probe-hub-contrast.mjs`

Touched outside that scope on `feat/home-voice` (MH-010), punctuation and one CSS rule only:
`src/components/AgentContactSection.tsx`, `src/components/condo/sections.tsx`, `src/lib/condoData.ts`,
`src/lib/comparisonData.ts`, `src/lib/config.ts`, `src/components/places/places-theme.css`, and the
metadata of 19 `src/app/**/page.tsx` files and `src/app/layout.tsx`. The full list is `git show --stat 12dc3f7`.

## Standing rules for this worktree

- **Every task prompt begins with `MH-`.** The report is `scratchpad/reports/MH-NNN-slug.md`,
  first line `# MH-NNN`, second line the worktree and branch, committed with the work.
- Keep this file updated instead of `HANDOFF.md`. Do not rewrite `HANDOFF.md` from here.
- Everything in the root `CLAUDE.md` still applies: pnpm only, exit-code gate, no em-dashes,
  "typical" not "median", terminal gets 10 lines or fewer, no clipboard writes.
- **Stop the local `next start` before `pnpm build`.** A running server holds the Prisma query
  engine DLL and the build fails on `EPERM ... query_engine-windows.dll.node`. Kill the
  listener first (`Get-NetTCPConnection -LocalPort 3000`).
- **Local battery needs `VERCEL_GIT_COMMIT_SHA=local pnpm start` and `EXPECT_SHA=local`.** Against a
  preview, `EXPECT_SHA` defaults to the local HEAD, so run it before the docs commit or set it.
- **The Bash tool collapses `\\` to `\` inside heredocs.** Write patch scripts with the Write tool
  into the session scratchpad and run them from there; a Python replacement script fed through a
  heredoc is fine when it carries no backslashes (MH-010 used one for the 35 edits).
- **Python's stdout redirected to a file is cp1252 here.** A generated Markdown file with em-dashes
  came out cp1252 and had to be re-encoded; write files with `io.open(..., encoding='utf-8')`.
- **Lighthouse is not a repo dependency.** MH-006 ran the audit's `nav-lighthouse.mjs` from the
  session scratchpad against an install left in the audit worktree's scratchpad.

## Gates

- `nav.mjs`: the served chrome contract (label, skip link, GET search, `<details>` menu with its
  compact copy, no `/saved`), the CTA and strips following the page, sub-labels on the rail, the
  Rent contract; in a browser at 380, 390, 1024 and 1440: four menus, the bar search at 1024 and up,
  the phone panel under the 66px bar, Escape closing the `<details>`, and two NO-JS runs.
- `homepage.mjs`: the same chrome contract on the homepage's own render, plus the map footer's
  legal and guide links, `/sold` once, the brief form.
- `footer.mjs`: thirty page types, one map footer under one bar, every hub, every map destination,
  `<h2>`/`<h3>`, search well and brief form, every href 200.
- `phone-390.mjs` (MH-008): no text clipped by a 390px viewport on the page types it samples.
- The nightly audit (`scripts/audit/nightly/`, Audit's) reads production at 03:00 Toronto; its
  em-dash rule is the one `scratchpad/mh010/emdash-proof.mjs` runs.

## Traps, and decisions that must not be re-litigated

- **The bio is one sentence split in two, not rewritten.** "far more than price. It is about" keeps
  every word; a later voice pass on the bio is a wording task and needs its own brief.
- **A title's separator is a colon, not a pipe, unless the second half is the site name.** The
  pipe is what `layout.tsx` and the share titles already use before `Miltonly`; a colon reads as
  one title in a SERP, a comma as a qualifier, and neither is a dash.
- **The hero badge is white, the card badge is ink.** Both sit on the same 14% green tint; the tint
  over the dark hero is `#064e33`, over a card `#dbffed`. A single colour cannot pass on both.
  `#00ff80` is for CTAs (CLAUDE.md), and it was 1.25:1 on the cards.
- **`#00ff80` as text on the deep ground** (eyebrows on the recoloured pages, `--cta` on rentals)
  follows the hub theme's own use of `--h-green` for figures; it is not used on a light ground
  anywhere, where the accent is `#017848`.
- **The brief form's watch kind is the lead path's.** `kindForSource("daily-brief")` is `brief`
  (`src/lib/lead/savedSearch.ts`, Leads' file); turning a street-page brief signup into a street
  watch is Leads' call.
- **`@media (pointer: coarse)`** carries the 44px targets. Lighthouse's mobile preset emulates
  touch; a desktop browser narrowed to 380 does not.
- **The phone panel sits UNDER the bar** (`top: 66px`); `nav.mjs` asserts that geometry.
- **A lease figure's floor is its own sample.** `getLeaseMarket()` gates each home type's typical
  on that type's count and the three landlord figures on the pool's.
- **The figures block keys on its menu** (`menu-${menu.key}-${f.key}`); the Rent list uses `menu-rent-hub`.
- **The lease-market cache key is in `SOLD_WIDE_PATTERNS`.** A new `cached()` key over
  `sold.sold_records` fails `test-sold-cache-purge.ts` until it is.
- Everything in MH-002 to MH-009's trap lists still holds for the menu, the hub and the analytics mount.


## MH-012 traps

- **A preview never reaches network idle.** Puppeteer's `networkidle0` timed out at 120s on `miltonly-hokave4jn`; the MH-012 scripts wait for
  `load`, the fonts and 800ms instead.
- **Port 3112 is held by another session's server here.** MH-012 used 3127. Find a free port; do not kill a listener you did not start.
- **`leak.mjs --explain=<path>` keeps only the text up to the first `=`.** A path with `?option=b` is read as `?option`. Hence the bare `?b`.
- **The daily brief's sender is off (R17, MC-046).** `/#brief` still collects sign-ups, but `/api/brief/send` has no cron until Leads rebuilds
  the edition. Do not link the brief from a new surface until it sends again.
- **The nav's A to Z prints an em-dash for X** on every page (pre-existing, MC-050). The leak test's `--explain` lists it as a separator; it is not in the hero.

## Where things stand

| | |
|---|---|
| MH-012 work | **`c7fd3ee14bc4f93098fa0ae080194fc6f3e01025`** (`feat/home-hero-design`), plus the docs commit with this file, the report and the proofs |
| MH-012 preview | `https://miltonly-hokave4jn-gtahomequest-hubs-projects.vercel.app/design-preview/home` |
| MH-011 work | `f5b3bab` (`feat/street-design`), docs `ff09e13` |
| main | `f0b8bb7` (the 2026-10-02 morning report), production `aa8c9d8`; has neither design |

## Open, and owned elsewhere

- **Review** of both designs: Aamir. If MH-012 is approved, building the hero on `/` is its own brief: the H1 and hero swap on `src/app/page.tsx`,
  a GA4 listener for the `data-hero-*` attributes, and the two planned pages (`/invest`, `/sell-and-buy`) as separate briefs.
- **The brief's sender** (R17): Leads. **The nav's X cell**: whoever next takes the nav.

## Next action

Aamir reviews the MH-012 preview and picks an option (the report has the URL, the link table and the pick). Nothing to merge.

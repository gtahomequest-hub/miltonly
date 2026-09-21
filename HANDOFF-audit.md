# Handoff: audit worktree

AUDIT · D:\miltonly-audit · feat/audit

_Last rewritten 2026-09-21 (MA-008): the morning report built and sent once by hand; MA-007 (street cache share) and the earlier audits before it._

## What this worktree is

It owns `scripts/audit/` only. It reads production and previews and writes reports. It never edits a
page, a component, a library file or the schema. A task ends with its report under `scratchpad/reports/`
and a reply whose last line is `Report: <path>`; nothing opens the editor (MC-021).

MA-002 touched three files outside `scripts/audit/`, each one line and each for the nightly to
exist: `.github/workflows/nightly-audit.yml` (new), `.gitignore` (tracks `scratchpad/audit/nightly/`)
and `vercel.json` (`ignoreCommand`, so the nightly report commit never spends a Vercel build).

## READ THIS FIRST

**MA-008 IS DONE: THE MORNING REPORT, SECTIONS 1 TO 4, RUN ONCE BY HAND AND EMAILED.** Record:
`scratchpad/reports/MA-008-morning-report.md`. `scripts/audit/morning/run.mjs` with four sources (Vercel
dollars through `vercel usage --json` over the real billing period plus `/v2/usage` and deployments; Neon
per-project month-to-date compute and egress with every project labelled by its reader, `lingering-sea`
as inspectionly.ca production; GSC through the service account; DB1 leads and DB2 streets without a page),
`rules.json` for The One Thing, `config.json` for the facts about our accounts, small-sample floors in
`lib.mjs`, and `.github/workflows/morning-report.yml` at 06:00 Toronto on a GitHub runner. First page
`scratchpad/audit/morning/2026-09-21.md`, Resend `01a0c22b-4c51-72ef-b819-7f37b21acf84`, exit 0, 42 calls,
40 s, no secret in log, report or email. Real figures: Vercel $160.63 cycle to date (cap crossed in 4.4 days
at this rate), Neon DB1 127.8 CU-h, GSC 2026-09-18 12 clicks / 467 impressions, 1 lead yesterday. Web
Analytics and the bot counts print "awaiting first data" until the script ships, which is expected.
**Scheduling waits on Core**: merge `feat/audit` and add the seven Actions secrets named in the workflow
header (the `.env.local` values; `GSC_SERVICE_ACCOUNT_JSON` is the key file's contents). Local runs:
`node scripts/audit/morning/run.mjs [--no-email] [--out=<dir>]`; `--out` also moves `state.json`.

**MA-007 IS DONE: THE STREET PAGE'S 9.6% CACHED SHARE, DIAGNOSED, NOT FIXED.** Record:
`scratchpad/reports/MA-007-street-cache-share.md`. Not a render-tree bug: no cookies(), headers(),
draftMode() or searchParams in the tree (the sold-records card is a client island), no header override, the
middleware matches both routes and falls through, and six spaced GETs of `restivo-lane-milton` all `HIT`.
The cause is cold cache: seven production deployments in 24 h, each dropping the 596 streets outside the
50-slug prerender set (`src/lib/streetPrerender.ts:14`), followed each time by the 646-page production
battery that renders them all again; about 2,800 of the route's 4,100 daily requests and 2,700 of its 3,700
renders are the battery (four runs) and the nightly (about 240). The hub is 72% because it prerenders all
22 and is re-warmed by `/api/jobs/warm-hubs`. The one-line fix for MC-035 is the prerender cap to the
published count; `revalidate` is not the cause (expired entries are served `STALE`). Tooling:
`scripts/audit/cache-states.mjs`. Vercel answered 200 again from the 20th; the pause paragraph below is
history.

**VERCEL IS PAUSED (2026-09-19, about seven hours from 17:00Z): EVERY DEPLOYMENT ANSWERS 402.** Until
production answers 200 again: no `npx vercel` deploys; a gate is `pnpm build` then `next start` on a free
port, with the battery and checks run as `BASE=http://localhost:<port>` against the local build SHA, and the
report says "gated locally, preview pending"; merges to `main` may be prepared but not pushed. This worktree
builds nothing and deploys nothing, so the only effect here is on the nightly: it ran three times on the 19th
(12:16Z, 12:57Z, 13:42Z) and exited 2 at "sitemap unreadable: status 402" each time, which is correct: no
report, no email, `state.json` unchanged, and the first run after production returns diffs against the
18th. An audit prompted while the pause holds reads the local build the same way (`BASE=http://localhost:<port>`
for `hub-page.mjs`, `hub-lighthouse.mjs`, `hub-inbound.mjs` and the rest; `hub-bench.mjs` needs no host).

**MA-006 ADDENDUM IS DONE: VOW-ONLY FIELDS ON PUBLIC SURFACES, BY SURFACE, WITH FILE:LINE.** Record:
`scratchpad/reports/MA-006-vow-fields-addendum.md`. Production at `e606d8b`. The facts Core needs first: no
surface reads `Listing.daysOnMarket` (null on every row); every "Nd on market" is today minus `listedAt`
(`OriginalEntryTimestamp`), on the listing page in five places including the meta description, on
`/listings` cards, `/rentals`, the homepage, school and mosque pages, and the three ad surfaces. The listing
page renders any row that exists and is advertisable, so 604 sold, 1,044 expired and 229 leased rows answer
`index, follow` with a status label and a DOM counted to today, and `Offer.availability: InStock` on all of
them; the whole Prisma row (`priorPrice`, `priceChangedAt`, `lastPriceChangeAt`, `listedAt`) is in the RSC
payload. `/listings?status=sold` (noindex) badges 604 rows "Sold" and prints "Sold for $875,000" over the
asking price because `soldPrice` is null; `/listings?status=rent` badges every available rental "Leased for"
because `status === 'rented'` is read as sold, and includes the 229 leased units. The mega menu on every page
shows a struck-through prior price and "down $40,000" per listing (`megaLive.ts:152-155`, `SiteNav.tsx:294-296`).
Aggregates (street "Time on market", hub prose, market-watch line, the `/listings` "Avg days on market: —"
tile and `/api/street-stats` `avgDOM`, both over the null column) are listed separately, not as findings.

**MA-005 IS DONE: THE NEIGHBOURHOOD HUB PAGE ON PRODUCTION, FIVE HUBS, TWO WIDTHS.** Record:
`scratchpad/reports/MA-005-hub-page-audit.md`, 25 defects ranked and ten changes. Production at `1b2d7d8`.
The four S1s to read first: every paragraph and FAQ answer on all 22 hubs is a June snapshot whose figures
contradict the live tiles beside them (Timberlea "102 sales" under a standfirst saying 95; Nassagaweya prose
saying no typical can be stated under a row saying $1.83M) and the same answers ship as `FAQPage` JSON-LD;
the hub's "typical" is `AVG` while `/sold`'s is the median, so Milton reads $1.01M on the hub and $930,000
one click later, and `/sold?nbhd=` shows no active chip for 12 hubs and drops `nbhd` at sign-in; there is
no lead capture on the hub body at all (first email field 14.6 to 16.0 phone screens down); Bronte Meadows
is registered `rural_hub`, which makes its title "Road Guide" and makes it a "rural neighbourhood" on Moffat
and Nassagaweya while Nassagaweya, Rural Milton West and Rural Trafalgar are never anyone's sibling. Also
measured: 21 of 22 hubs render synchronously at 2.4 to 4.0 s for the first visitor after a deploy or a tag
drop, then `HIT` at 120 ms; mobile LCP 3.6 to 5.2 s (render delay, fonts, Facebook and GTM, same shape as
MA-001); seven streets on five hubs where the street page's up-link and the ladder disagree; the ladder
printing "1 sale · $925K" on full-window rows; the condo cap of six under-counting Dempsey's 17. Tooling:
`hubs.json`, `hub-sweep.mjs` (all 22, cache state and shape), `hub-page.mjs` (Puppeteer, the full read),
`hub-intents.mjs` (where the four squares and two cards land, at 390), `hub-lighthouse.mjs`,
`hub-inbound.mjs` (body links only, chrome stripped), `hub-bench.mjs` (Zolo, HouseSigma, Realtor.ca,
Rightmove). Raw output in `scratchpad/audit/MA-005/`, untracked. HouseSigma renders a client-only shell to
headless Chrome and Realtor.ca blocks the phone UA; both are noted as such in the report.

**WHAT CORE AND HOME HAVE TAKEN SINCE MA-004.** The nightly is on `main` (MC-019, `feat/audit @ 4a1e349`
as `8326b2a`) and its gate is fixed (`fix/node-22`, on `main` 2026-09-16 22:10Z); the 14th to 16th runs
were delivered before the fix and skipped. The first unattended run to confirm is the 17th after 07:00 UTC
(`git log main` for `audit(nightly): 2026-09-17`). MC-020 took the first night's findings; MH-006 took all
ten MA-004 changes (merged `6aac9c9`); MH-007 added the Rent menu (`1b2d7d8`). The brief signup now records
the hub or street on the lead row (`BriefSignup.tsx:56`), which closes MA-004 defect 7.

**MA-004 IS DONE: THE HEADER, MEGA MENU AND FOOTER ON PRODUCTION, FIVE PAGE TYPES, THREE WIDTHS.**
Record: `scratchpad/reports/MA-004-nav-footer-audit.md`, 22 defects ranked and ten changes. The four
S1s are the ones to read first: on the homepage at 390 the scrolled-in nav search pushes the seller
CTA and the burger off-screen (`home-theme.css:247-255`); the 509 street pages render no footer at
all; `.street-v2 a { color: inherit }` turns every panel CTA white on `#00ff80` on street pages;
and the 461 listing pages still ship the navy `Navbar` and `FooterSection` (no menu, no search,
`/map` 307, "Sign in" CTA). Guides render both headers because `ChromeGate` has no `/guides` rule.
The forest menu itself passed every behavioural check (hover intent, keyboard path, Escape, outside
click, scroll, focus trap, CLS 0, fit at 1024) and no blurb fell back on any run. The brief form's
POST was intercepted and aborted: it posts email plus `event_source_url` only, so a street-page
signup is a Milton-wide watch. Tooling: `nav-footer.mjs` (Puppeteer, three widths, every panel and
the accordion), `nav-links.mjs` (every chrome href checked, footer coverage against the sitemap),
`nav-lighthouse.mjs`, `nav-bench.mjs` (Homesly, Rightmove, Zoopla, Airbnb captures). Raw output in
`scratchpad/audit/MA-004/`, untracked. Nothing outside `scripts/audit/`, the report, this file and
`QUEUE.md` was touched.


**THE NIGHTLY AUDIT IS ON `feat/audit`, MA-002 AT `4a1e349` AND MA-003 ON TOP; CORE MERGES THE HEAD WITH
MC-020.** Records: `scratchpad/reports/MA-002-nightly-audit.md` and `MA-003-checks-tightened.md`. The
committed `scratchpad/audit/nightly/2026-09-13.md` and `state.json` are the MA-003 rerun (the second run
of the date, no email); the MA-002 proof email was `7a8d3344-57b4-4068-bfcd-97f6ed7a63cf`.

**MA-003 TIGHTENED FOUR THINGS.** A catchment word counts only within twelve words of school, board,
zone or catchment context (the match itself counts when it names one, so "school zone" always fires);
the bare nouns never in a Town-polygon or distance sentence; the hub disclaimer ("a catchment is the
school board's fact") is exempt; a `data-remarks` block is the seller's words and leaves the body
before the catchment, superlative and TREB checks, and is itself an S2 `remarks-unlabelled` when it
lacks the visible label "Listing agent's remarks". Until Core ships the attribute (MC-020), a
listing page gets one S3 `remarks-unmarked` and its body keeps the old exemption; once the block
exists, the rest of the listing page is our copy and is checked in full. TREB strings on our own
copy stay S2.

**IT RUNS BY ITSELF NOW.** Merged by MC-019, secrets added, gate fixed by `fix/node-22`; see the paragraph
above for what to confirm on the 17th. The runner path is Chrome at `/usr/bin/google-chrome`, a lean
`npm install` of `puppeteer-core@24 lighthouse@12`, no app install, no database.

**THE STATE AFTER TWO RUNS ON 2026-09-13 (1,013 PAGES SWEPT, 308 NEVER), 3,572 OPEN FINDINGS.** S1 32:
`catchment`, the `/schools/*` title "Prices, Listings & School Zone Data" (29), `/schools` text and
description, `/listings` "School zones". S2 16: `treb-string` 13 (the listing fact strip prints
"Bungalow-Raised", "Sidesplit 3", "Backsplit 4"), `h1-multiple` on `/rentals`, `catchment` 2 (the
schools guide's "boundary data" sentence and one carried listing). S3 3,524: `em-dash` 1,722,
`meta-length` 687, `title-length` 494, `dead-anchor` 378, `remarks-unmarked` 107, `superlative` 58,
`font-under-12` 43, `link-unpublished` 31, `link-redirect` 4. MA-003 cleared 26 hub findings (the
disclaimer and "Schools inside the boundary" on 13 hubs). Nothing 4xx or 5xx, no host leak, no
canonical mismatch, no JSON-LD parse failure, no overflow at 390. The rerun took 265 s: production
answered GET p50 3.2 s (183 REVALIDATED, 267 MISS), the sweep yielded to the clock with 55 pages
unswept and the sample stopped at 29 of 40. The clock guards work; a slow host costs coverage, not
the run.

**THE FETCH BUDGET IS THE SHAPE OF THE RUN.** The sitemap is 1,113 URLs (510 streets, 461 listings,
144 other) and the budget is 600 fetches, so the sweep is 507 a night: the 144 non-street pages and
the twelve Lighthouse pages every night, the rest of the streets and listings by oldest sweep first,
the whole set every 3 nights. A page not swept tonight carries last night's findings, marked, and
counts as neither new nor fixed. Off-sitemap links are checked most-linked first within what is
left (32 of 308 tonight). The report's Summary and Budget sections say exactly what was covered.

## Tooling (all under `scripts/audit/`, all read-only against the host)

| script | what it does |
|---|---|
| `nightly/run.mjs` | the nightly: `BASE=https://miltonly.com AUDIT_DEPS=<dir> node scripts/audit/nightly/run.mjs [--no-email] [--no-lh] [--out=dir] [--budget=600] [--deadline=285] [--sample=40] [--lh=12]` |
| `nightly/checks.mjs` | raw-HTML checks: title, H1, meta, canonical, JSON-LD, host leak, em-dash, superlatives, catchment, TREB strings, alt, dead anchors, links out |
| `nightly/browser.mjs` | Chrome at 390 px (fonts under 12 px, overflow, DOM ids) and the Lighthouse CLI wrapper |
| `streets.json` | the ten audit streets and their shapes; the nightly's fixed Lighthouse set |
| `pick-streets.mjs` | picks shapes from the record (DB1 + DB2), for re-selecting the sample |
| `street-page.mjs` | MA-001: Puppeteer at 1440 and 390, the full structural read of one street. `--only=slug` |
| `lighthouse.mjs` | MA-001: Lighthouse mobile + desktop per street; `LH_BIN` points at an installed CLI |
| `inbound-links.mjs` | MA-001: crawls the sitemap and counts pages linking to each audit street |
| `hubs.json`, `hub-sweep.mjs`, `hub-page.mjs`, `hub-intents.mjs`, `hub-lighthouse.mjs`, `hub-inbound.mjs`, `hub-bench.mjs` | MA-005: the hub page. `hub-sweep.mjs` reads all 22 hubs once (cache, TTFB, shape); the rest mirror the MA-001 set for `/neighbourhoods/<slug>`; `hub-intents.mjs` opens every intent square and CTA card destination at 390 |
| `morning/run.mjs`, `morning/sources/*.mjs`, `morning/rules.json`, `morning/config.json` | MA-008: the 06:00 morning report (Money, Traffic, Conversion, The One Thing), one email a day; `--no-email --out=<dir>` for a dry run |
| `cache-states.mjs` | MA-007: one GET per sitemap URL in a route family, recording the edge cache state, age and TTFB |
| `bytes.mjs` | MA-001: bytes on the wire per resource type via CDP at 390 px; `--throttle` for slow 4G |
| `cache-sweep.mjs` | one GET per published street: `x-vercel-cache`, `x-matched-path`, TTFB |
| `crops.mjs` | per-section screenshots at 390 px for visual review |
| `nav-pages.json` | MA-004: the five page types (home, street, hub, listing, guide) |
| `nav-footer.mjs` | MA-004: Puppeteer at 1440, 1024 and 390: bar, every panel and rail item, keyboard and hover paths, the 390 accordion, footer fonts, contrast and targets, the brief form intercepted. `--only=key --widths=1440,390` |
| `nav-links.mjs` | MA-004: every header and footer href checked once (redirects not followed), footer and nav coverage of hubs, guides, schools, mosques, condos against the sitemap |
| `nav-lighthouse.mjs` | MA-004: Lighthouse mobile + desktop over `nav-pages.json`, keeping the chrome-relevant audits |
| `nav-bench.mjs` | MA-004: Homesly, Rightmove, Zoopla and Airbnb header and footer captures at 1440 and 390 |

Dependencies: locally the repo's `puppeteer` devDependency and Chrome at
`C:/Program Files/Google/Chrome/Application/chrome.exe` (`CHROME_PATH` overrides). Lighthouse is not
a repo dependency: set `AUDIT_DEPS` to a folder holding `node_modules/lighthouse` and
`node_modules/puppeteer-core` (`npm install lighthouse@12 puppeteer-core@24` in a scratch folder,
16 s), or `LH_BIN` to a Lighthouse `cli/index.js`. The GitHub runner does the same lean install.

Local `.env.local` supplies `RESEND_API_KEY` and `RESEND_FROM_EMAIL`; the script reads it when the
variables are unset. `AUDIT_EMAIL_TO` overrides the recipient.

## How the nightly decides

- **Identity** of a finding is `path|code|key`. New = present tonight on a re-checked page, absent
  last night. Fixed = present last night, absent tonight, page re-checked. Browser findings
  (`font-under-12`, `overflow-390`) refresh only when the page is in the sample again.
- **Severity.** S1: 5xx, 4xx or fetch error on a sitemap URL, host leak, JSON-LD parse failure,
  catchment assignment vocabulary. S2: sitemap URL redirecting, redirect chain, canonical missing or
  mismatched, title, H1 or meta missing, `noindex` on a sitemap URL, TREB feed strings, overflow at
  390, broken or unpublished link, the bare catchment nouns in school context. S3: length out of
  range, em-dash, superlative, dead anchor, missing alt, fonts under 12 px, a link that redirects, a
  page that renders but is off the sitemap, Lighthouse drops. S4: informational.
- **Catchment words** need school, board, zone or catchment context within twelve words; the bare
  nouns are S2 and never count in a Town-polygon or distance sentence; the hub disclaimer is exempt.
- **Remarks.** A `data-remarks` block leaves the body before the vocabulary checks and must carry the
  label "Listing agent's remarks" (S2 `remarks-unlabelled` otherwise). A listing page without the
  block is S3 `remarks-unmarked` and its body keeps the third-party exemption. Titles and
  descriptions are always checked. Board attribution ("TRREB", the MLS mark) is not a TREB string.
- **Lighthouse moves** in the email: a category down 10 (perf) or 5 (seo, a11y, bp), LCP moved a
  quarter and 500 ms, an audit newly failing.
- **The email.** Baseline night: every open finding by severity, capped at 80. A night with change:
  broke, fixed, Lighthouse moves, then one line of what is still open. A quiet night: three lines,
  so silence means the job did not run. Subject carries the counts.
- **Clock.** 285 s deadline: the sweep yields at 70 %, Lighthouse at 75 %, links at 80 %, the sample
  at 92 %; anything cut is named in Run notes. Tonight's run was 162 s locally.

## Where things stand

| | |
|---|---|
| `feat/audit` | MA-001 tooling, the nightly (on main), MA-003, MA-004, MA-005, MA-006 addendum, MA-007, MA-008 morning report on top; `origin/main` merged in at each start |
| production audited | `f01a96a` on 2026-09-12 (MA-001) and 2026-09-13 (MA-004); `1b2d7d8` on 2026-09-16 (MA-005); `e606d8b` on 2026-09-18 (MA-006 addendum); `d068f84` on 2026-09-20/21 (MA-007); the nightly baseline 2026-09-13 |
| pages edited | none |
| waiting on Core | merge `feat/audit` and add the morning report's seven Actions secrets (MA-008); MC-035, the street prerender cap (MA-007); the MA-006 addendum list; the MA-005 changes not taken by MC-027; the MA-001 changes not yet taken |
| next | whatever the next `MA-` prompt asks; the MA-001 and MA-005 changes and the baseline S1 and S2 belong to core |

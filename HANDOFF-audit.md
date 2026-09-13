# Handoff: audit worktree

AUDIT · D:\miltonly-audit · feat/audit

_Last rewritten 2026-09-13 (MA-004): the header, mega menu and footer audited on production; the nightly (MA-002, MA-003) is unchanged and still waits on Core._

## What this worktree is

It owns `scripts/audit/` only. It reads production and previews and writes reports. It never edits a
page, a component, a library file or the schema. Reports open with `code D:\miltonly-audit <path>`.

MA-002 touched three files outside `scripts/audit/`, each one line and each for the nightly to
exist: `.github/workflows/nightly-audit.yml` (new), `.gitignore` (tracks `scratchpad/audit/nightly/`)
and `vercel.json` (`ignoreCommand`, so the nightly report commit never spends a Vercel build).

## READ THIS FIRST

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

**IT DOES NOT RUN BY ITSELF UNTIL CORE DOES TWO THINGS.** (1) Merge `feat/audit` to main: GitHub runs
`schedule` and lists `workflow_dispatch` only from the default branch. (2) Add two repository
secrets under Settings, Secrets and variables, Actions: `RESEND_API_KEY` and `RESEND_FROM_EMAIL`,
the same values as `.env.local`. Without them the run completes, commits the report and prints
"RESEND_API_KEY or RESEND_FROM_EMAIL unset; no email". After the merge, `Actions > Nightly audit >
Run workflow` proves the runner path (Chrome at `/usr/bin/google-chrome`, a lean `npm install` of
`puppeteer-core@24 lighthouse@12`, no app install, no database).

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
| `feat/audit` | MA-001 tooling, MA-002 nightly at `4a1e349`, MA-003 tightened checks, MA-004 nav and footer audit on top |
| production audited | `f01a96a` on 2026-09-12 (MA-001) and 2026-09-13 (MA-004); the nightly baseline 2026-09-13 |
| pages edited | none |
| waiting on Core | MC-020: merge the `feat/audit` head; add `RESEND_API_KEY` and `RESEND_FROM_EMAIL` as Actions secrets; run the workflow once by hand; label the remarks block with `data-remarks` and the visible label. `D:miltonly` main holds an unpushed local merge `8326b2a` of `4a1e349` from the interrupted MC-019 (`pnpm build` exit 0); supersede or keep it |
| next | whatever the next `MA-` prompt asks; the ten MA-001 changes, the ten MA-004 changes and the baseline's S1 and S2 belong to core (the MA-004 S1s are one-line CSS fixes, a footer on the street page, and the listing-page chrome cutover) |

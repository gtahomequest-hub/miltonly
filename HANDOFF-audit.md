# Handoff: audit worktree

AUDIT · D:\miltonly-audit · feat/audit

_Last rewritten 2026-09-13 (MA-002): the autonomous nightly audit built and proven once; waits on Core._

## What this worktree is

It owns `scripts/audit/` only. It reads production and previews and writes reports. It never edits a
page, a component, a library file or the schema. Reports open with `code D:\miltonly-audit <path>`.

MA-002 touched three files outside `scripts/audit/`, each one line and each for the nightly to
exist: `.github/workflows/nightly-audit.yml` (new), `.gitignore` (tracks `scratchpad/audit/nightly/`)
and `vercel.json` (`ignoreCommand`, so the nightly report commit never spends a Vercel build).

## READ THIS FIRST

**THE NIGHTLY AUDIT IS ON `feat/audit` AT `4a1e349` AND HAS RUN ONCE, BY HAND.** Record:
`scratchpad/reports/MA-002-nightly-audit.md`. The baseline is committed:
`scratchpad/audit/nightly/2026-09-13.md` and `state.json`. Email `7a8d3344-57b4-4068-bfcd-97f6ed7a63cf`
went to gtahomequest@gmail.com through Resend.

**IT DOES NOT RUN BY ITSELF UNTIL CORE DOES TWO THINGS.** (1) Merge `feat/audit` to main: GitHub runs
`schedule` and lists `workflow_dispatch` only from the default branch. (2) Add two repository
secrets under Settings, Secrets and variables, Actions: `RESEND_API_KEY` and `RESEND_FROM_EMAIL`,
the same values as `.env.local`. Without them the run completes, commits the report and prints
"RESEND_API_KEY or RESEND_FROM_EMAIL unset; no email". After the merge, `Actions > Nightly audit >
Run workflow` proves the runner path (Chrome at `/usr/bin/google-chrome`, a lean `npm install` of
`puppeteer-core@24 lighthouse@12`, no app install, no database).

**THE BASELINE SAYS WHAT PRODUCTION LOOKS LIKE TONIGHT, 2,025 OPEN FINDINGS.** S1 32: `catchment`
vocabulary, 30 of them the `/schools/*` title "Prices, Listings & School Zone Data", plus `/schools`
and `/listings` chrome. S2 38: `treb-string` (the listing fact strip prints "Bungalow-Raised",
"Sidesplit 3", "Backsplit 4"), `h1-multiple` on `/rentals`, the S2 catchment nouns. S3 1,955:
`em-dash` 935 (every listing title and description, most street descriptions), `meta-length` 423
and `title-length` 387 (templates), `dead-anchor` 125 (the street hero's `#type-*` links point at
no id), `font-under-12` on all 40 sampled pages (the compliance footer at 11 px), `superlative` 29,
`link-unpublished` 12 (`/streets/<rural road>` renders but is not on the sitemap), `link-redirect` 4.
Nothing 4xx or 5xx, no host leak, no canonical mismatch, no JSON-LD parse failure, no overflow at
390. `x-vercel-cache` was MISS on 497 of 507 swept pages; GET p50 2.1 s.

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
- **Voice checks skip listing bodies** (the remarks are the seller's words) but never skip titles
  and descriptions. Board attribution ("TRREB", the MLS mark) is not a TREB string.
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
| `feat/audit` | MA-001 report and tooling, MA-002 nightly at `4a1e349`, baseline committed |
| production audited | `f01a96a` on 2026-09-12 (MA-001); the nightly baseline 2026-09-13 |
| pages edited | none |
| waiting on Core | merge `feat/audit`; add `RESEND_API_KEY` and `RESEND_FROM_EMAIL` as Actions secrets; run the workflow once by hand |
| next | whatever the next `MA-` prompt asks; the ten MA-001 changes and the baseline's S1 and S2 belong to core |

# MA-002
AUDIT · D:\miltonly-audit · feat/audit

## MA-002: the autonomous nightly audit, built and proven once

Built on `feat/audit` at `4a1e349`. Nothing on a page was edited. Proven by one local run against
production on 2026-09-13; the GitHub Action cannot fire until Core merges.

**What was built**

- `scripts/audit/nightly/run.mjs`, `checks.mjs`, `browser.mjs`: the sitemap, a status sweep with
  redirect chains, off-sitemap link checks (broken, unpublished, off-host, redirecting), dead
  anchors on the page and across pages, host leaks, canonical mismatches, title, H1 and meta
  presence and length, JSON-LD parse, em-dashes, superlatives, catchment words and TREB feed
  strings in rendered text, titles and descriptions, missing alt, and in Chrome at 390 px on a
  40-page sample (the ten audit streets, the homepage, the Timberlea hub, 28 drawn across every
  route family by a date seed) fonts under 12 px and overflow. Lighthouse mobile on the twelve
  fixed pages. A diff against the previous night's `state.json`: identity is `path|code|key`,
  pages not re-swept carry their findings and count as neither new nor fixed.
- `.github/workflows/nightly-audit.yml`: cron at 07:00 and 08:00 UTC with a gate that keeps the
  one that is 03:00 America/Toronto, plus `workflow_dispatch`. A lean `npm install` of
  `puppeteer-core@24 lighthouse@12` (16 s), the runner's Chrome, no app install, no
  `DATABASE_URL`. Commits `scratchpad/audit/nightly/` back to the branch it ran on.
- `vercel.json` gains `ignoreCommand: git diff --quiet HEAD^ HEAD -- . ':(exclude)scratchpad/audit/nightly'`,
  verified locally: a commit touching only the nightly directory exits 0 (Vercel skips), any other
  commit exits 1 (Vercel builds). `.gitignore` tracks `scratchpad/audit/nightly/` and nothing
  else under `scratchpad/audit/`.
- The email: Resend REST, from `RESEND_FROM_EMAIL`, to gtahomequest@gmail.com, severity-ranked,
  only what broke, what was fixed and which Lighthouse scores moved, one line for what is still
  open, a link to the committed report. A quiet night sends three lines so silence means the job
  did not run.

**Budget, measured on the proof run**

- 596 of 600 fetches: sitemap 1, sweep 507, Lighthouse 12, links 36, sample 40. Every redirect
  hop counts. The budget is enforced in code and printed in the report.
- 162 s of 285 locally (sweep 117 s, links 130 s, Lighthouse 132 s in parallel with the sweep,
  sample 162 s). The clock cuts each phase at a fixed share and names what it cut.
- Neon-free: pages only. The user agent is `miltonly-audit/nightly`.

**The one assumption the budget forced.** The sitemap is 1,113 URLs (510 streets, 461 listings,
144 other), so "a full status sweep" does not fit in 600 fetches. The sweep is 507 a night: the
144 non-street pages and the twelve Lighthouse pages every night, the other streets and listings
by oldest sweep first, so the whole sitemap is covered every 3 nights. Off-sitemap links are
checked most-linked first within what is left (32 of 308 tonight). Raising the budget to 1,200
would make the sweep nightly-complete; the runtime would stay under 5 minutes.

**The baseline, 2,025 open findings.** S1 32: `catchment` vocabulary, 30 of them the `/schools/*`
title "Prices, Listings & School Zone Data", plus `/schools` ("School zone intelligence", "by
school zone" in the description) and `/listings` ("School zones"). S2 38: `treb-string` 9 (the
listing fact strip prints "Bungalow-Raised", "Sidesplit 3", "Backsplit 4"), `h1-multiple` on
`/rentals`, the S2 catchment nouns in school context on the hubs' school note. S3 1,955: `em-dash`
935 (every listing title and description, most street descriptions and several titles),
`meta-length` 423 and `title-length` 387 (templated, 168 to 294 and 69 to 105 characters),
`dead-anchor` 125 (the street hero's `#type-detached`, `#type-semi`, `#type-townhouse`,
`#type-condo` links point at no id, confirmed in the served HTML), `font-under-12` on all 40
sampled pages (the compliance footer and the "sold" em at 11 px), `superlative` 29 ("best
suits", "it is best to confirm" in condo prose, "top-tier" on `/about`), `link-unpublished` 12
(rural roads such as `/streets/bell-school-line-milton` render but are off the sitemap; `/streets`
and listing pages link to them), `link-redirect` 4 (`/streets` links to four slugs that 308).
Nothing 4xx or 5xx, no host leak, no canonical mismatch, no JSON-LD parse failure, no noindex, no
overflow at 390. `x-vercel-cache` was MISS on 497 of 507 swept pages; GET p50 2.1 s, p95 5.8 s.
Lighthouse mobile: perf 67 to 78, seo 100, a11y 90 to 96, bp 79, LCP 3.4 to 5.4 s.

**Two calls made in the checks, both stated in the code.** Listing bodies skip the em-dash and
superlative checks (the remarks are the seller's words) and need school context for catchment
words; titles and descriptions never skip. Board attribution ("TRREB", the MLS mark, the
brokerage line) is required by the IDX rules and is not a TREB feed string; the bare nouns
"catchment" and "boundary" count only in school context, since every hub says "Town of Milton
boundary".

**Proof.** Email id `7a8d3344-57b4-4068-bfcd-97f6ed7a63cf`, subject "Miltonly nightly audit
2026-09-13: baseline, 2025 open findings", to gtahomequest@gmail.com. Report
`scratchpad/audit/nightly/2026-09-13.md` (2,360 lines, the email id on its last line), state
`scratchpad/audit/nightly/state.json`, both committed in `4a1e349`. Two earlier proof emails
(`f13cb127-fd54-48e1-908f-fa17f99b088d`, `67592a70-19a8-425b-9d54-b9445de72f35`) came from runs
whose false positives were then removed; their reports were discarded before the baseline.

**For Core, in order.** (1) Merge `feat/audit` to main; `schedule` and `workflow_dispatch` read
the default branch only. (2) Add repository secrets `RESEND_API_KEY` and `RESEND_FROM_EMAIL`
(Settings, Secrets and variables, Actions), the `.env.local` values. (3) Run `Actions > Nightly
audit > Run workflow` once and read the report it commits; the first run on the runner is the
second night, so its email will say what changed, not the baseline. (4) The S1 and S2 above are
for core to take; the em-dash and length findings are templates and will hold at their counts
until the templates change.

Report: scratchpad/reports/MA-002-nightly-audit.md

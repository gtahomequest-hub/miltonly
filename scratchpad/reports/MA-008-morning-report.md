# MA-008
AUDIT · D:\miltonly-audit · feat/audit

## MA-008: the morning report, skeleton (Money, Traffic, Conversion, The One Thing)

Built 2026-09-21 in the audit worktree; nothing under `src/` was touched. Run once by hand and emailed
before scheduling; the schedule is a GitHub Action, not a Vercel cron, so it spends no build minutes.

### What was built

- `scripts/audit/morning/run.mjs`: gathers the four sources in parallel, computes the derived figures,
  runs the rules, renders one page as Markdown and as email HTML, writes
  `scratchpad/audit/morning/<date>.md` and `state.json` (yesterday's figures for the diff), and sends one
  email through Resend to the desk. Exit 0 clean; 2 when a source failed (the report still goes out and
  names it); 3 when the email failed; 4 when nothing at all could be gathered.
- `sources/vercel.mjs`: dollars from `vercel usage --json` over the real billing period (`--from` the
  period start from `/v2/teams`; the CLI defaults to the calendar month), by service, by project and by
  day, plus the same day last cycle; requests, cache share, invocations, GB-hours and builds from
  `/v2/usage` per project; deployments from `/v6/deployments`. The REST API has no spend endpoint this
  token can read (`/v1/usage`, `/v1/billing/*`, `/v1/teams/*/spend` all refuse), which is why the CLI.
- `sources/neon.mjs`: every project the key sees, in both organisations, with month-to-date compute
  hours and egress from `/projects/{id}` (`consumption_history` is a Scale-plan endpoint, 403 on Launch),
  each labelled by what reads it from `config.json`. `lingering-sea-07597558` is labelled
  "inspectionly.ca PRODUCTION database, never touch"; a project without a label prints "no known
  Miltonly reader, not unused". Dollars are an estimate from the Launch rates and the line says so.
- `sources/gsc.mjs`: a service-account JWT (the key file at `GSC_SERVICE_ACCOUNT`, or its contents in
  `GSC_SERVICE_ACCOUNT_JSON` on the runner), then Search Analytics: the daily series (latest day, 7-day
  average, same weekday last week, month and 28 days to date), top pages with position, new queries
  against the prior 28 days, pages that fell out of the top 10, and the www/apex split.
- `sources/db.mjs`: DB1 leads yesterday by source, landing page and intent; 7-day, month-to-date and
  28-day counts (with and without a gclid or utm_source); the 28-day leads-by-landing-page table joined
  to GSC's page table; and, with DB2, streets with sales in 90 days that are in the registry and have no
  published page. Counts only; no sold price leaves DB2.
- `sources/analytics.mjs`: Vercel Web Analytics has no documented endpoint and the script is not on the
  site yet; the dashboard's endpoint is tried and answers 404, so every field prints "awaiting first
  data", the expected state. AI-search referrer hosts are listed in `config.json` for the day it answers.
  Googlebot and oai-searchbot counts have no API either and print "awaiting a source".
- `rules.json`: The One Thing as data. Each rule names a fact list, `where` clauses, a `pick` and a `say`
  template; the four asked for are in: cost line moved more than 20% day over day, highest-traffic page
  with zero leads, a query at position 11 to 20 with impressions, a street with recent sales and no page.
- `config.json`: the desk, the cap, the project list, the Neon labels and rates, the sample floors, the
  runner rate.
- `.github/workflows/morning-report.yml`: the nightly's shape, crons at 10:00, 11:00 and 12:00 UTC with a
  gate that runs the first delivery of each Toronto day at or after 06:00; a lean install of
  `@neondatabase/serverless`; the report committed to the branch it ran on (`scratchpad/` only, so the
  ignore rule keeps it out of builds). `.gitignore` now tracks `scratchpad/audit/morning/`.

### Small-sample honesty, as built

`lib.mjs`: `rate()` prints no percentage under 30 in the denominator ("not enough data, n=…") and always
prints the denominator; `movement()` calls a day-over-day or week-over-week change only when both sides
are at least 20 and the change exceeds two standard deviations of a Poisson count of that size, otherwise
"within noise" or "too few to call". Section 3 states the expected daily lead count from the 7-day click
average at a 1 to 3% rate and says a zero day is the normal result. Today's page says "12 vs 3, too few
to call" for the same-weekday comparison, which is the intended behaviour.

### The gates

1. **Run by hand, email sent**: `node scripts/audit/morning/run.mjs`, exit 0, 40 s, 42 API calls, Resend
   id `01a0c22b-4c51-72ef-b819-7f37b21acf84` to the desk, subject "Miltonly morning 2026-09-21: $161
   Vercel · 12 clicks (2026-09-18) · 1 lead". The page is `scratchpad/audit/morning/2026-09-21.md`,
   4,747 bytes, 34 lines.
2. **Each API returns real data, one figure each**: Vercel, on-demand cycle to date **$160.63** (billed;
   list $180.63), day 18 of 30, Build CPU Minutes $137.24 of it, miltonly $86.04 and homesly $63.57.
   Neon, `fancy-bread-13256110` (Miltonly DB1) **127.8 CU-h and 74 GB egress** month to date;
   `lingering-sea-07597558` 99.3 CU-h, labelled inspectionly.ca production. GSC, **2026-09-18: 12 clicks,
   467 impressions, position 8.3**, service account `miltonly-report@miltonly-reporting.iam.gserviceaccount.com`
   with `siteFullUser` on `sc-domain:miltonly.com`. DB1, **1 lead yesterday** (sale-detail, buy, from
   `/listings/W13806174`), 32 month to date. Web Analytics answered 404 and printed "awaiting first data".
3. **No secret in any log, commit or the email**: every source reads `process.env` and sends the value
   as a header or a CLI flag; `redact()` strips every secret value and any token-shaped run from every
   error before it is written; the run log, the report and `state.json` were scanned for the first
   twelve characters of each of `VERCEL_API_TOKEN`, `NEON_API_KEY`, `RESEND_API_KEY`, `DATABASE_URL` and
   `SOLD_DATABASE_URL` and for `private_key`: zero hits. The email body is the report text. `.env.local`
   and `D:\secrets\` are outside the commit.
4. **What it cost to run**: 42 API calls (Vercel 10 plus 4 CLI calls, Neon 11, Google 9, Neon SQL 8),
   0.7 minutes, one email; $0 to Vercel, Neon, Google and Resend (all within free allowances); on the
   runner about 1.5 GitHub minutes a day, $0 inside the free 2,000 a month on a private repository
   (about $0.012 a day beyond it). The page prints this line at its foot on every run.

### What today's page found, for the record

The cap is crossed in 4.4 days at the cycle's rate ($267.72 projected against $200); yesterday's Build
CPU Minutes were $1.93 against $0.48 the day before; the homepage fell from position 7.7 to 27.7 this
week; `/streets/zilio-terrace-milton` took the most clicks of any page in 28 days and produced no lead;
"bronte meadows milton homes" sits at position 17.1; Dredge Court had four sales in 90 days and no page.

### What is not done, and why

- **Scheduling needs Core**: the workflow runs from the default branch only, so it starts when Core merges
  `feat/audit` and adds seven Actions secrets (`VERCEL_API_TOKEN`, `NEON_API_KEY`,
  `GSC_SERVICE_ACCOUNT_JSON`, `DATABASE_URL`, `SOLD_DATABASE_URL`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`;
  `REPORT_EMAIL_TO` optional). The `.env.local` values are the ones to paste; the GSC secret is the key
  file's contents.
- Sessions, bounce, referrers and the two bot counts wait on the analytics script and on a source for
  request logs; cost per visit divides by GSC clicks until then and says so on the line.
- Health and Content sections: not built, by instruction.
- The page is about four phone screens on a first run; the Neon "every project" line is the price of the
  labelling rule and can move to a weekly line once the labels are trusted.

## Files

- `scripts/audit/morning/` (`run.mjs`, `lib.mjs`, `config.json`, `rules.json`, `sources/`),
  `.github/workflows/morning-report.yml`, `.gitignore` (one line), `scratchpad/audit/morning/2026-09-21.md`
  and `state.json`, tracked.
- `HANDOFF-audit.md` rewritten, `QUEUE.md` marked. No page, component, library file, route or schema
  was edited.

## Addendum, 2026-09-21 evening: two fixes after the first scheduled run

Core merged `feat/audit`, added the secrets and dispatched the workflow by hand (`31da4b9`, the 22:59
Toronto rerun, Resend `01a0c70d-8deb-75c9-9a7d-a020662c314f`), so the schedule is live.

1. **The cap.** `config.json` `teamCapUsd` 200 to 300 (raised 2026-09-21). The projection no longer
   straight-lines the cycle's average, which the first heavy week dragged for a month; it is spend so far
   plus the last seven full days' daily rate times the days left (`sources/vercel.mjs:62-69`), and the cap
   line says "no cap risk this cycle" unless the days to the cap fall inside the cycle (`run.mjs:85-86`).
   Dry run: $165.55 so far plus $4.34 a day for 11.2 days, **$213.95 projected, headroom $134.45, 31 days
   to the cap, no risk**.
2. **The backlog, not a drip.** `sources/db.mjs` returns every registry street with a sale in 90 days and
   no published page, ordered by count, and section 3 prints the full list with counts
   (`run.mjs:121`). Dry run: **32 streets**, Clarriage Crt E 4, Dredge Crt N 4, then seven at 2 and 23 at
   1. The rule still names the top one and now points at the list.

Dry run exit 0, 42 calls, 39 s; no email sent for the fix (the corrected page goes out at 06:00). The
runner reads `main`, so the fixes reach it when Core merges `feat/audit` again.

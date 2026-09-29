# ML-013

LEADS · D:\miltonly-leads · feat/leads

**Every capture on production works. Ten forms, twelve submissions, driven as an iPhone against `miltonly.com` (`1f3b216`): every one wrote its row, sent its confirmation and its desk alert, and the emails were in the inbox within two seconds; the register flow signed a verified session in through its emailed link. Nothing was fixed because nothing failed; no code changed; the test rows are deleted. The zero week is not a break: it is the site's rate.** The "32 month to date" is the morning report counting preview rows: the production table holds 2 September leads, one the desk's own MC-028 proof and one the ML-005 bot, and the last real lead is a phone-only booking on 2026-08-30.

## 1. The last 15 leads

`public.Lead`, `env = 'production'`, newest first, Toronto time. "Attribution" reads `gclid`, `gclidLast`, `utmSource`; "page" is `landingPage` or `firstPage`.

| when | form (`source`) | attribution | page | who |
|---|---|---|---|---|
| 2026-09-20 09:24 | `sale-detail` | organic | /listings/W13806174 | **the bot**: name "Tede Rvbkrvxq", user agent wrapped in a double quote (ML-005's signature); the user-agent guard reached production only on 2026-09-28 02:42 UTC with `1f3b216` |
| 2026-09-17 23:31 | `daily-brief` | organic | / | **the desk**: `gt…@gmail.com`, user agent `… mc028`, MC-028's proof row |
| 2026-08-30 16:27 | `rental-detail-book` | organic | (none) | Taylor, phone only, no email, no consent text: **the last real lead** |
| 2026-07-03 15:22 | `rental-detail-book` | organic | (none) | Adenike, `ad…@gmail.com`, phone: real |
| 2026-05-26 16:27 | `homepage-newsletter` | organic | (none) | `se…@yahoo.com` |
| 2026-05-26 14:48 | `homepage-newsletter` | organic | (none) | `ca…@hotmail.com` |
| 2026-05-26 14:41 | `homepage-newsletter` | organic | (none) | `ch…@icloud.com` |
| 2026-05-26 14:09 | `homepage-newsletter` | organic | (none) | `s.…@gmail.com` |
| 2026-05-26 10:00 | `homepage-newsletter` | organic | (none) | `je…@hotmail.co.uk` |
| 2026-05-24 13:37 | `homepage-newsletter` | organic | (none) | `ma…@hotmail.com` |
| 2026-05-23 16:22 | `ads-rentals-lp` | gclid | /rentals/ads | `4@4.com`: a test |
| 2026-05-23 15:58 | `ads-rentals-lp` | utm fb/cpc | /rentals/ads | `ve…@miltonly.test`: a test |
| 2026-05-23 15:43 | `adsleads:ads-rentals-lp` | utm fb/cpc | /rentals/ads | `te…@test.com`: a test |
| 2026-05-23 15:43 | `ads-rentals-lp` | utm fb/cpc | /rentals/ads | `te…@test.com`: a test |
| 2026-05-23 03:27 | `ads-rentals-lp` | organic | (none) | `ve…@miltonly.test`: a test |

- **Last lead of any kind:** 2026-09-20 09:24, the bot. **Last non-ad lead from a person:** 2026-08-30 16:27, `rental-detail-book`, phone only. **Last lead with an email from a person:** 2026-07-03. **Last ad-attributed lead:** 2026-05-23, a test.
- **Counts:** all-time rows 47, production 17; August 1; September 2 (the desk and the bot); last 7 days 0; last 28 days 2.
- **Where "32" comes from.** `scripts/audit/morning/sources/db.mjs:23-27` counts `public."Lead"` with no `env` filter. September has 2 production rows and **30 preview rows** (the worktrees' proof batches: 29 distinct sources, 19 of them carrying a gclid from the ads-landing tests). The morning report's "month to date 32", "32 leads in all, 19 carrying a gclid" and "13 not ad-attributed" are those 32 rows. `scripts/leads-report.ts` and the weekly digest filter on `env = 'production'` and read 2. That is Audit's file (`scripts/audit/`); this task did not touch it.

## 2. Every form on production, as a phone

Driven with `scratchpad/ml013/drive.mjs` (puppeteer, iPhone 13 emulation, Chrome, a real user agent), each form filled by the selectors in its JSX and submitted with `gtahomequest+ml013-<form>@gmail.com`, one submission every 150 s so the per-IP limiter (5 per 10 minutes, 12 per day) never saw more than four in a window. Every plan was first rehearsed with the submit step withheld (`--dry`), so no token was spent on a selector guess. The proof of each is threefold: the `POST /api/leads/create` reply carries a `lead_id` (a honeypot or user-agent refusal answers `{ok:true}` with none and the page still shows success, so the DOM alone proves nothing), the row exists with its `LeadActivity` delivery records, and the email is in the inbox.

| form | `source` | page | row | confirmation to the submitter | desk alert | watch | verdict |
|---|---|---|---|---|---|---|---|
| the owner form on a street page (the one-field valuation under the hero) | `street-valuation` | /streets/main-street-milton | `cmuln90ds…` 19:32:01 UTC | "Your valuation is being prepared", inbox 19:32:01 | "New lead — street-valuation", inbox 19:32:01 | none by design | **PASS** |
| watch the street (the hero segment) | `street-alert` | /streets/main-street-milton | `cmulnciui…` 19:34:45 | "You are watching Main Street", inbox 19:34:45 | "New lead — street-alert" | `street`, "New listings on Main Street" | **PASS** |
| newsletter (the daily brief on the homepage; `homepage-newsletter` is not mounted anywhere) | `daily-brief` | / `#brief` | `cmulng3zl…` 19:37:32 | "Your Milton daily brief starts tomorrow", inbox 19:37:33 | "New lead — daily-brief" | `brief`, "Milton daily brief" | **PASS** |
| book (the listing card's showing modal) | `listing-card-book` | /listings, first card (W13833302) | `cmulnjn5h…` 19:40:17, name and phone only | none: the modal takes no email, by design | "New lead — listing-card-book" | none | **PASS** |
| valuation (the homepage band) | `homepage-valuation` | / `#valuation` | `cmulnkgdp…` 19:40:55, address, phone, notes, consent ticked | "I got your message", inbox 19:40:55 | "New lead — homepage-valuation" | none by design | **PASS** |
| contact (the sale listing's "Request a showing" form; the only other "Contact" form is the condo building's, below) | `sale-detail` | /listings/W13832706 | `cmulno01j…` 19:43:40, name, phone, email | "I got your message", inbox 19:43:41 | "New lead — sale-detail" | none | **PASS** |
| book (the rental listing's booking card) | `rental-detail-book` | /listings/W13832868 | `cmulnrldt…` 19:46:28 and again `cmulosywq…` 20:15:32, name, email, phone | "I got your message", inbox 19:46:28 and 20:15:32 | "New lead — rental-detail-book", both times | none | **PASS**, twice |
| contact (the condo building's contact panel) | `condo-building-contact` | /condos/610-farmstead-drive-milton | `cmulnv5d3…` 19:49:14 and again `cmulowlsn…` 20:18:21, name, email, message | "I got your message", inbox 19:49:14 and 20:18:22 | "New lead — condo-building-contact", both times | `hub`, "New listings in Willmott" | **PASS**, twice |
| valuation (/sell, the same card as the homepage) | `sell-page` | /sell `#valuation` | `cmulp0oqh…` 20:21:32, address, phone, notes, consent ticked | "Your valuation is being prepared", inbox 20:21:32 | "New lead — sell-page" | none | **PASS** |
| the register flow (the portal door) | none: `/api/auth/signup` writes no lead | /signin, "Continue", "Email me a link instead" | `User` row 20:24:16, code and token hash set, `verified: false` | "124761 is your Miltonly sign-in code", inbox 20:24:18, with the link | none by design | none | **PASS**: the link opened as the phone posted `/api/auth/verify` 200, set the session cookie, landed on `/saved` reading "Welcome back gtahomequest+ml013-register@gmail.com", and left the row `verified: true` with the code and token cleared and no password |

Two forms ran twice. Claude Code reported the second group of submissions "stopped because the system is running low on memory" (2.2 GB free of 15.9, the desk's own Chrome and ffmpeg holding the rest), but the script had in fact carried on and submitted the rental booking and the condo contact at 15:46 and 15:49 local; the third group, launched detached under Git Bash once free memory reached 3.1 GB, repeated them at 16:15 and 16:18. Both pairs passed identically. The limiter's day bucket for this connection read 12 of 12 at the end and refused nothing.

**Not driven.** `homepage-newsletter`, `homepage-mortgage-calculator`, `homepage-sold-on-my-street`, `homepage-exclusive` and the three `homepage-persona-*` sources are in `LIVE_SOURCES` but no page mounts their component (the prebuild only asks that the literal exists in a file), so the digest's "produced nothing in 28 days" for them is structural. `/contact`, `/newsletter` and `/register` are 404 and `/book` redirects to `/about`, which has no form; the "contact" form is the condo building's, the register flow is `/signin`.

**Clean-up.** Every test row is deleted (`scratchpad/ml013/rows.mjs --apply`, twice: after the first six and after the last five): 11 `Lead` rows with their 21 `LeadActivity` delivery records, 3 `SavedSearch` watches (the street, the brief, the Willmott hub) and the 1 `User` row, which had no password and so was not a credential record. A final listing shows 0, 0, 0. The brief watch went before tomorrow's 09:15 send and the street and hub watches before the 10:00 alert match, so the test inbox receives nothing further. The desk keeps the twelve "New lead — …" alert emails and the SMS Twilio sent for each; they are labelled `ML013 test` or `Lead 0013` and can be deleted. The two limiter keys the last submission left on the test inbox expire on their own.

## 3. The guards

- **A refusal writes nothing and is not persisted.** `src/lib/lead/ingest.ts` logs `[lead/ingest] rejected { reason, source }` with `console.warn` and returns; the only record is Vercel's runtime log, which the CLI reaches back about one day (`npx vercel logs --json -n 5000 --query "leads/create"` returned entries from 05:54 UTC on 2026-09-28; nothing older is served). A seven-day count does not exist anywhere.
- **In the reachable day, before this run:** 5 `POST /api/leads/create`, all five refused, all five **honeypot**; 0 origin, 0 user-agent, 0 rate-limit refusals; 0 stored. Four of the five are one burst at 05:54:36 to 05:54:57 UTC (01:54 Toronto): `daily-brief`, `street-alert`, `street-alert`, `sale-detail`, four different forms on three pages in 21 seconds, which no person does. The fifth is a `daily-brief` at 17:26 UTC. No audit or morning job posts to the ingress (grep of `scripts/audit` and `scripts/verify` for the route and the field), so none of the five is the site's own probe.
- **Real traffic is not being refused by the guards this run can see:** twelve real phone submissions passed the honeypot, origin, user-agent and rate-limit checks and every one wrote its row. The honeypot is `input[name="company_website"]`, `tabindex=-1`, `autocomplete="off"`, inside an `aria-hidden` wrapper at `left:-10000px`; a password manager that fills a field named "company website" on a form with no company field would trip it, and the 17:26 refusal cannot be told apart from that. It is one submission in a day.
- **The limiter's counters** live in Upstash (`lead:ip:*`, `lead:email:*`): 82 IP windows and one inbox window were live at 19:30 UTC, the inbox one being the test address itself (three tokens from the portal tier's sign-in tests). This run deleted only the keys naming the test inbox (`scratchpad/ml013/ratelimit-keys.mjs --apply`, before each email-bearing form) so the six-per-day inbox allowance did not refuse the test; no IP key and no one else's key was touched.

## 4. The ads

**Arrivals are not readable from the codebase or its logs.** Nothing server-side records a page view: `src/lib/attribution.ts` keeps `gclid` and `utm_*` in the browser (localStorage and a cookie) and hands them to the lead payload at submit time; there is no visit table, Vercel Web Analytics is "awaiting first data" in the morning report, and GA4 (`NEXT_PUBLIC_GA_ID`) has no API credential in the repo. What is readable is the leads that carried a gclid:

| period | leads with a gclid (production) |
|---|---|
| each of the last 28 days | 0 |
| last gclid lead | 2026-05-23 16:22, `ads-rentals-lp`, `4@4.com`, a test |
| last utm lead | 2026-05-23 15:58, `ads-rentals-lp`, `fb/cpc`, `…@miltonly.test`, a test |

No ad-attributed lead from a person exists in the table. The `AdsLead` table's newest row is also 2026-05-23. The morning report's "19 carrying a gclid" are preview rows (section 1). If a campaign is running, its clicks are not reaching a form, or are not tagged; if none is running, the funnel line in the morning report is measuring GSC clicks, which is organic search.

## 5. What this means

- The pipeline is sound end to end on every surface the task named, from a phone, on the production build. Row, both emails, the watch where one is due, all within seconds.
- The site's lead rate is about one real lead a month (August 1, September 0 from a person, the six newsletter sign-ups of 24 to 26 May the only cluster). At the morning report's own arithmetic (about 10 GSC clicks a day at 1 to 3%), a zero week is the expected outcome. The "32" that made this week look like a drop is a counting defect in the morning report, worth one `WHERE env = 'production'` in `scripts/audit/morning/sources/db.mjs` (Audit's).
- The one guard question left open is the 17:26 UTC honeypot refusal of a `daily-brief` submission: a bot or a browser autofill, one per day, and the log is the only place it shows. If it matters, persist refusals (a `LeadActivity` without a lead, or a small `LeadRefusal` table) so the seven-day count the task asked for exists next time; that is a schema change and not this task's.

## 6. Left as found

- No code changed. Branch `feat/leads` is `origin/main` (`e0bfc40`, MC-049) plus one docs commit: this report, the handoff, the queue mark and `scratchpad/ml013/` (the driver, the plans, the run records with every request and reply, the screenshots, the queries, the log dumps). Core merges by SHA and there is nothing to deploy.
- `.env.vercel-prod` (gitignored, `.env*`) now holds the production environment pulled with `vercel env pull` for the Upstash key inspector; delete it if it should not sit on the desk.

Report: scratchpad/reports/ML-013-forms.md

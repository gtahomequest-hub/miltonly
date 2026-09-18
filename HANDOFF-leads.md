# Handoff — leads worktree

LEADS · D:\miltonly-leads · feat/leads

_Last rewritten 2026-09-12, after ML-003 built the weekly leads digest._

## READ THIS FIRST

**ML-003 AND ML-002 ARE ON THIS BRANCH, AWAITING CORE'S MERGE.** The proven tree is
**`e205757`** (ML-003 on top of ML-002, with `origin/main` `2a89120` merged in and the prebuild
line unioned); the head is one docs commit above it. Merge the head.

**ML-003 IS THE WEEKLY LEADS DIGEST.** Monday 07:00 Toronto, one email to the desk
(`LEADS_DIGEST_TO`, falling back to `ALERT_EMAIL_TO`, which is the desk address in both
environments, so no new production variable is needed): leads by source and by page for the
7 and the 28 local days ending Sunday, from `lead_daily_by_page`; brief subscribers and
watches active; confirmation and desk-alert delivery counts; every mounted surface with no
submission in 28 days. Two UTC crons, `0 11 * * 1` and `0 12 * * 1`, and the route runs only
when the Toronto hour is 7 (the market-watch pattern). **One send proven on preview
`miltonly-bsn6qltes`** to `gtahomequest+ml003@gmail.com` (Resend
`118ed5c7-b5fa-455f-8991-a5fc15e7ca94`, received 23:58Z); the Preview variable was then
deleted. Full battery on that preview: **PASS · 14 checks · 481 pages**. Record in
`scratchpad/reports/ML-003-weekly-leads-digest.md`.

**DELIVERY COUNTS HAD NO SOURCE, SO THE INGEST PATH NOW LOGS EVERY SEND ATTEMPT.** Neither
the confirmation nor the desk alert left a trace before ML-003. `recordDeliveries` in
`src/lib/lead/notify.ts` writes one `LeadActivity` row per attempt that reached Resend:
`email_sent` with the Resend id, `email_failed` with the message. A skipped send leaves no
row, a log failure is swallowed, and the digest joins the rows to production leads only.
Proven on preview with lead `cmtxmrdy70000glan0oblr6e7`: two `email_sent` rows whose ids
match the diagnostics. **The log begins at the production deploy that carries this**, and the
first digests say so; nothing before it is counted.

**THE VIEW BUCKETS BY UTC DAY, AND THE DIGEST SAYS SO RATHER THAN HIDING IT.**
`lead_daily_by_page.day` is `("createdAt" AT TIME ZONE 'UTC')::date` (Phase 1 migration), so a
lead sent after 20:00 Toronto sits on the following day's row. The digest reads `day` on the
date basis, as the rule says, and the route returns a cross-check count of `Lead.createdAt` on
the Toronto instants beside it (they agreed, 10 and 11, on 2026-09-11). Moving the view to
`America/Toronto` is a one-line `CREATE OR REPLACE VIEW` migration and Core's to apply; open
item 1 below.

**ML-002 IS ON THIS BRANCH, AWAITING CORE'S MERGE.** The brief's sold read bounded `sold_date`
with the Toronto instants. `sold_date` is a calendar date stamped 00:00 UTC, and Toronto
midnight is 04:00 UTC, so the edition for the 9th read nothing stamped on the 9th and everything
stamped on the 10th: **3 sales where the day holds 8, and the 3 were the wrong day's.** Every
production edition so far reported the following day's sales under yesterday's date. The fix
is the Market Watch pattern (`src/lib/marketWatch/windows.ts`, "TWO BASES FOR ONE WEEK"):
`BriefWindow` carries `dateStartUtc` and `dateEndExclusiveUtc` beside `start` and `end`, the
sold read uses the date pair plus `sold_date <= NOW()` (Ruling 10), and `listedAt` and
`lastPriceChangeAt`, which are real timestamps, stay on the instants. Dry run of the 09-09
edition reads **8, typical $825,000** (8 clears `K_ANON_PRICE`, where 3 did not). Twelve new
prebuild assertions in `test-lead-guards.ts` pin the fixture day and read the query off the
source. Merge SHA and preview in `scratchpad/reports/ML-002-brief-sold-date-basis.md`.

**Phase 2 IS MERGED.** Core merged `feat/leads @ 26381f9` as **`543ef99`**, a real two-parent
merge, and main has moved on to `00e0eb1`. `feat/leads` was fast-forwarded to **`00e0eb1`** in
ML-001, and ML-002 is the only commit on top of it.

**`BRIEF_UNSUBSCRIBE_SECRET` IS NOW SET** in Production and Preview (32 random bytes, hex, one
value for both, added via stdin as a sensitive variable in ML-001). It no longer shares
`CRON_SECRET`. **It binds on the next deploy of each environment**; until then the running
builds still sign with `CRON_SECRET`. Any unsubscribe link signed before that deploy stops
verifying after it. Production brief watches were 0 at the time, so no live link is affected.

**The battery's two hub failures are main's, not this branch's.** `hub-meta` and `hub-intents`
fail identically on the final Phase 2 preview and on production, from the hub tier that landed on
main between the merges. Nothing in the lead layer touches a hub page, a hub parser or a stat
tile. Main's own `HANDOFF.md` owns them.

## Where things stand

| | |
|---|---|
| branch | `feat/leads`, ML-003 and ML-002 on top of `origin/main` `2a89120`. Proven tree **`e205757`**, head one docs commit above |
| Phase 2 merge on main | **`543ef99`** (merges `26381f9`) |
| last preview of this branch | `miltonly-bsn6qltes` at `e205757` |
| battery there | **PASS · 14 checks · 481 pages · 394s** (the first run failed one homepage figure by $5k against its live hub record, a sold-figure cache timing outside the lead layer; the re-run and the full re-run passed) |
| prebuild, lead layer | `[lead-guards] 183` · `[lead-forms] 105` · `[leads-digest] 228` assertions |
| `public.Lead` | 25 production rows (10 `sale-detail` on 2026-09-11 alone, on four listings; open item 7), 30 preview |
| `SavedSearch` | 9 rows, all `env=preview`. **Production watches: 0, brief subscribers: 0** |
| ingress routes | **one**: `/api/leads/create` |
| Phase 0, 1, 2 | **all merged** |
| `BRIEF_UNSUBSCRIBE_SECRET` | **set** in Production and Preview, pending a deploy to bind |
| `LEADS_DIGEST_TO` | **unset everywhere**, deliberately. The digest falls back to `ALERT_EMAIL_TO` |

## The shape that shipped

```
a form  →  postLeadDetailed()  →  POST /api/leads/create  →  ingestLead()
           src/lib/postLeadClient.ts                          src/lib/lead/ingest.ts
                                                                ├─ guards.ts    honeypot, origin, rate limit
                                                                ├─ fields.ts    every form→column mapping
                                                                ├─ score.ts     the one scoring rule
                                                                ├─ intent.ts    the value vocabulary
                                                                ├─ notify.ts    confirmation + ops alert
                                                                ├─ sms.ts       Twilio, countable env only
                                                                └─ savedSearch.ts  street | hub | price-band | brief

a brief watch  →  /api/brief/send (cron 15 13 * * 1-5)  →  src/lib/brief/
                                                             ├─ window.ts     the local-day period
                                                             ├─ compose.ts    the reads and the copy
                                                             └─ unsubscribe.ts  HMAC, fails closed
                  /api/brief/unsubscribe  ← the signed one-click link

the desk  ←  /api/digest/leads (cron 0 11 * * 1 and 0 12 * * 1, runs at Toronto hour 7)  →  src/lib/digest/
                                                                                          ├─ window.ts   7 and 28 local days ending Sunday, both bases
                                                                                          └─ compose.ts  the reads and the copy
             every send attempt in ingest  →  LeadActivity email_sent | email_failed  (notify.ts recordDeliveries)
             src/lib/lead/sources.ts  the mounted surfaces, held to src/ by scripts/test-leads-digest.ts
```

`scripts/test-lead-forms.ts` walks `src/` at prebuild and fails the build on a lead ingress
named anywhere but `/api/leads/create`. Full Phase 2 record, with the four live defects the
migration found and fixed, in `scratchpad/reports/067-leads-phase2.md`.

## The rulings Phase 2 made

- **A phone-only lead is promised a call and nothing by email.** `OffMarketForm` captures no
  address, so: no confirmation, no watch, and the desk alert plus the SMS to Aamir ARE the
  delivery. Stated on the card.
- **`homepage-newsletter` leaves no watch.** `PreFooterCTA` promises a brief "Sundays at 8am"
  and the sender is Monday to Friday. Mapping it to a `brief` watch would mail five times a
  week. **See the open item below.**
- **`alert` and `new-match-alert` make `price-band` watches.** The band is the only criterion
  those surfaces capture.
- **A `brief` watch keys on the address alone**, not on its street, so a subscriber who signs up
  from two pages gets one brief. The street is still stored, because it personalises the edition.
- **Monday's brief covers the weekend.** Sending Mon–Fri and reporting a literal "yesterday"
  would mean Saturday was reported to nobody, ever.
- **"Changed price", never "dropped"** (DEC-PRICE-CHANGE-NOT-DROP). `lastPriceChangeAt` cannot
  tell a cut from a rise, and the prebuild gate fails on the word. **One sale is below
  `K_ANON_PRICE`**, so the count is published, the price is not, and the clause says which. **An
  edition with nothing in it is not sent.**

## Traps

- **`origin/main` moved twice during ML-003** (sold-sync purge, menu v2). The first push built at
  `ee846bf` without them; the ancestor check caught it, main was merged, the tree rebuilt and
  re-pushed. **Run the ancestor check after the LAST fetch, not the first.**
- **The digest slot guard refuses everything but Monday 07:00 Toronto.** A manual trigger needs
  `force=true`; `dryRun=true` computes and returns without sending and needs no force. The
  Preview `CRON_SECRET` is the value in `.env.local`; a bearer header against the preview URL works.
- **`LEADS_DIGEST_TO` overrides the recipient wherever it is set.** Set on Preview for the proof
  and deleted after. The running `miltonly-bsn6qltes` deployment still has it bound; a new
  preview deploy does not.
- **`scripts/migrate-digest-dry.ts`** (gitignored) composes the digest locally for any instant:
  `npx tsx --tsconfig tsconfig.test.json scripts/migrate-digest-dry.ts 2026-09-14T11:00:00Z`.
- **`git commit-tree` DOES NOT MERGE — it snapshots.** Re-check
  `git merge-base --is-ancestor origin/main HEAD` after the last fetch and **STOP if it fails**;
  merge main into the branch first, then build from that tree.
- **`sold_date` is a date wearing a timestamptz. Read it on `win.dateStartUtc` /
  `win.dateEndExclusiveUtc`, never on `win.start` / `win.end`.** The instants are for DB1's real
  timestamps only. The prebuild reads the sold query off the source and fails on the instants.
- **The prebuild rate-limit test runs against the real Upstash store on Vercel.** The Upstash
  variables ARE set on a Vercel build. The key now carries per-run entropy (`f9b7ea5`) and the
  assertion states what holds of both stores. Do not reintroduce an exact "5 per window" claim.
- **The rate limit is real on preview and a REFUSED call still spends a token.** 5 per IP per 10
  minutes, sliding. Wait a clear ten minutes with **zero** requests between proof batches.
- **Preview writes to production data.** Rows and watches are tagged and excluded from every
  count and every send, but they are real rows in the real table.
- **`LEAD_ALERTS_ON_PREVIEW=true`** (Preview only) makes preview leads raise a prefixed ops
  alert. It cannot make a row countable.
- **`CRON_SECRET` is in Preview**, which is what lets the brief be triggered there by hand.
  Vercel only schedules crons on production.
- **Vercel env vars bind at deploy time.** A new variable needs a redeploy, and `vercel redeploy`
  gives a new URL. This is why `BRIEF_UNSUBSCRIBE_SECRET` is set but not yet live.
- **`prisma migrate deploy` and the migration ledger are Core's**, per main's `HANDOFF.md` and
  the migrations audit on main (`bb32044`, `217e9ef`). **The lead layer needs no migration.**
- **`DIRECT_DATABASE_URL` is `DATABASE_URL` with `-pooler` removed.** Every `NEON_*` variable
  points at the sold/analytics project. Run `npx prisma migrate status` and read the host it
  prints, every time.
- **`scripts/migrate-*.ts` is gitignored** (`.gitignore:84`) — the place for a throwaway script
  that needs `@prisma/client`.
- **The `name-prose` prebuild guard reads string literals**, not just page copy.
- **Reports are now `scratchpad/reports/<TASK-ID>-<slug>.md`**, first line `# <TASK-ID>`,
  tracked in git. Leads tasks are `ML-`. The numbered series (062–068) is closed.

## What is open

1. **`lead_daily_by_page` buckets by UTC day.** One-line fix, `AT TIME ZONE 'America/Toronto'`
   in a `CREATE OR REPLACE VIEW` migration; Core's ledger. Until then the digest states the
   basis and the route's cross-check shows the gap, which was 0 on 2026-09-11.
2. **The first production digest is Monday 2026-09-14 at 07:00 EDT (11:00 UTC)** if the merge
   deploys before then. Its delivery counts will be partial: the log begins at the deploy.
3. **The Sunday brief `PreFooterCTA` promises has no sender.** Either its copy becomes the daily
   brief and its source becomes `daily-brief` (homepage worktree owns the copy), or a weekly
   sender gets built. Today those subscribers get a confirmation and nothing after it.
4. **`BRIEF_UNSUBSCRIBE_SECRET` needs a deploy to bind** in each environment. The next
   production deploy of any branch does it. Nothing to build.
5. **The brief cron is live on production** since the Phase 2 merge deployed. Production brief
   watches are **0**, so each run sends nothing. The first real subscriber makes it real.
6. **Eight questionable `homepage-newsletter` rows** predate that surface having a honeypot.
   Still in the table, untouched.
7. **Ten `sale-detail` leads on 2026-09-11**, on four listings, in a table that held 15 rows the
   day before. Not examined in ML-003; the digest will show them Monday. Worth a look before
   they are read as demand.
8. **Nine preview watches** remain, matching Phase 1's posture. Tagged, so no cron reads them.
9. Still open from report 062: **G10, the street-grain valuation figure on `/sell`**, and the
   MOD-58 lead admin columns with no UI.

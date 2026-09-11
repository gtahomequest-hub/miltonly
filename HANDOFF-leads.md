# Handoff — leads worktree

LEADS · D:\miltonly-leads · feat/leads

_Last rewritten 2026-09-11, after ML-002 fixed the brief's sold read._

## READ THIS FIRST

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
| branch | `feat/leads`, ML-002 on top of `origin/main` `00e0eb1`. **See the ML-002 report for the SHA** |
| Phase 2 merge on main | **`543ef99`** (merges `26381f9`) |
| last preview of this branch | in the ML-002 report |
| battery there | in the ML-002 report |
| prebuild, lead layer | `[lead-guards] 183 assertions` · `[lead-forms] 105 assertions` · 22 tests |
| `public.Lead` | 15 production rows (untouched), 25 preview |
| `SavedSearch` | 9 rows, all `env=preview`. **Production watches: 0** |
| ingress routes | **one**: `/api/leads/create` |
| Phase 0, 1, 2 | **all merged** |
| `BRIEF_UNSUBSCRIBE_SECRET` | **set** in Production and Preview, pending a deploy to bind |

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

1. **The Sunday brief `PreFooterCTA` promises has no sender.** Either its copy becomes the daily
   brief and its source becomes `daily-brief` (homepage worktree owns the copy), or a weekly
   sender gets built. Today those subscribers get a confirmation and nothing after it.
2. **`BRIEF_UNSUBSCRIBE_SECRET` needs a deploy to bind** in each environment. The next
   production deploy of any branch does it. Nothing to build.
3. **The brief cron is live on production** since the Phase 2 merge deployed. Production brief
   watches are **0**, so each run sends nothing. The first real subscriber makes it real.
4. **Eight questionable `homepage-newsletter` rows** predate that surface having a honeypot.
   Still in the table, untouched.
5. **Nine preview watches** remain, matching Phase 1's posture. Tagged, so no cron reads them.
6. Still open from report 062: **G10, the street-grain valuation figure on `/sell`**, and the
   MOD-58 lead admin columns with no UI.

# Handoff — leads worktree

LEADS · D:\miltonly-leads · feat/leads

_Last rewritten 2026-09-10, after Phase 2 was built, proven on preview, and pushed for the gate._

## READ THIS FIRST

**Phase 2 is BUILT, PROVEN AND PUSHED. IT IS NOT MERGED.** The tip of `feat/leads` sits on
**`00caa57`**, a real `git merge` of `origin/main` (`73e94ea`) into the Phase 2 commits `e46ae49`,
`39bcfe1` and `0a1d08b`, with docs and one test fix on top. Preview
`miltonly-1lw66pqlc`, aliased `miltonly-git-feat-leads`, battery
**`PASS · 10 checks · 449 pages · 67s`**. Core merges. **Main had already moved twice while this
was building** — check `git merge-base --is-ancestor origin/main HEAD` again before you touch it.

**THE ONE INGRESS IS REAL NOW.** `/api/leads` (1,201 lines, four branches),
`/api/off-market-leads` and `/api/exclusive-inquiry` are **deleted**. Every one of the twenty
submission points in `src/` reaches `/api/leads/create` through `src/lib/postLeadClient.ts`, and
`scripts/test-lead-forms.ts` walks the whole tree at prebuild and fails the build on a lead
ingress named anywhere else. **22 prebuild tests run now.**

**THE FOUR LIVE DEFECTS THE MIGRATION FOUND**, all fixed, all in
`scratchpad/reports/067-leads-phase2.md` with the evidence:

1. **`LeadCaptureForm` wrote TWO `Lead` rows per submission.** Its `PH3-DUALWRITE` block posted
   the same visitor to `/api/leads/create` a second time — harmless while that route wrote
   `ads.leads`, a duplicate the moment **Phase 1** repointed it at `public.Lead`. Two rows, two
   confirmations, two desk alerts, two CAPI events, one person. **Some of the 15 production rows
   are these pairs.**
2. **The Phase 1 ingest path dropped all six last-touch UTM fields and `firstVisitAt`**, which
   the client helper had always sent. Every lead it wrote credited the first ad click.
3. **Phase 1 dropped the Twilio SMS to Aamir** that all four monolith branches sent. Back now,
   gated on `isCountable(env)` like the ops alert.
4. **Eight surfaces rendered a confirmation over a refused submission.** `RentalsClient`'s
   `submitLead` returned `true` for a 429 and a 500.

## Where things stand

| | |
|---|---|
| branch | `feat/leads`, on the merge **`00caa57`** of `origin/main` `73e94ea`, rebuilt, pushed |
| preview | **`miltonly-1lw66pqlc`** at `39bcfe1`, alias `miltonly-git-feat-leads` |
| battery on preview | **`PASS · 10 checks · 449 pages · 67s`** |
| local build after the merge | exit 0, zero `P2024`, **22/22 prebuild**, 549 static pages |
| prebuild, lead layer | `[lead-guards] 171 assertions` · `[lead-forms] 105 assertions` |
| `public.Lead` | **15 production rows** (untouched), 25 preview |
| `SavedSearch` | 9 rows, all `env=preview`. **Production watches: 0** |
| ingress routes | **one** |
| Phase 0, 1, 2 | 0 and 1 merged. **2 built and proven, awaiting merge** |

## The new shape

```
a form  →  postLeadDetailed()  →  POST /api/leads/create  →  ingestLead()
           src/lib/postLeadClient.ts                          src/lib/lead/ingest.ts
                                                                ├─ guards.ts    honeypot, origin, rate limit
                                                                ├─ fields.ts    NEW: every form→column mapping
                                                                ├─ score.ts     NEW: the one scoring rule
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

## The rulings Phase 2 made

- **A phone-only lead is promised a call and nothing by email.** `OffMarketForm` captures no
  address, so: no confirmation, no watch, and the desk alert plus the SMS to Aamir ARE the
  delivery. Stated on the card.
- **`homepage-newsletter` leaves no watch.** `PreFooterCTA` promises a brief "Sundays at 8am"
  and the sender is Monday to Friday. Mapping it to a `brief` watch would mail five times a
  week. **See the open item below.**
- **`alert` and `new-match-alert` make `price-band` watches**, the first this codebase has ever
  produced. The band is the only criterion those surfaces capture.
- **A `brief` watch keys on the address alone**, not on its street, so a subscriber who signs up
  from two pages gets one brief. The street is still stored, because it personalises the edition.
- **Monday's brief covers the weekend.** Sending Mon–Fri and reporting a literal "yesterday"
  would mean Saturday was reported to nobody, ever.

## Traps

- **`git commit-tree` DOES NOT MERGE — it snapshots.** Two of the merges in this project were
  built with it and one clobbered another worktree's docs. Re-check
  `git merge-base --is-ancestor origin/main HEAD` after the last fetch and **STOP if it fails**;
  merge main into the branch first, then build from that tree. This handoff's `00caa57` IS a
  real `git merge`, so a fast-forward or an ordinary merge is all Core needs.
- **THE PREBUILD RATE-LIMIT TEST WAS FLAKY ON VERCEL AND IS FIXED HERE.** It asserted the
  in-memory fallback's exact "5 per window" on the belief that no Redis is configured under
  `tsx`. **The Upstash variables ARE set on a Vercel build**, so it ran against the real shared
  store, with a 10-minute sliding window and a key drawn at random from 200 addresses. Two builds
  inside ten minutes collided on one and a preview failed with `expected 5, got 3` on code that
  passed locally. This was Phase 1's assertion and it has been on `main` since. The key now
  carries per-run entropy and the assertion states what holds of both stores.
- **The rate limit is real on preview and a REFUSED call still spends a token.** 5 per IP per 10
  minutes, sliding. A twenty-surface proof took four runs and collected eleven `429`s. Wait a
  clear ten minutes with **zero** requests between batches, not five.
- **Preview writes to production data.** Rows and watches are tagged and excluded from every
  count and every send, but they are real rows in the real table.
- **`prisma migrate deploy` IS STILL BLOCKED FOR EVERYONE, AND IT IS NOT THIS BRANCH'S TO FIX.**
  `20260910120000_market_edition` is in the repo and has never been in `_prisma_migrations`,
  while the `MarketEdition` table exists — a folder renamed after it was applied. Whoever renamed
  it runs `prisma migrate resolve`. **This branch needs no migration.**
- **`DIRECT_DATABASE_URL` is `DATABASE_URL` with `-pooler` removed**
  (`ep-patient-paper-aebh7f93.c-2.us-east-2.aws.neon.tech`). Every `NEON_*` variable points at
  the sold/analytics project instead, so the obvious guess runs migrations against the wrong
  database. Run `npx prisma migrate status` and read the host it prints, every time.
- **Vercel env vars bind at deploy time.** A new variable needs a redeploy, and `vercel redeploy`
  gives a new URL.
- **`LEAD_ALERTS_ON_PREVIEW=true`** (Preview only) makes preview leads raise a prefixed ops
  alert. It cannot make a row countable.
- **`CRON_SECRET` is in Preview**, which is what let the brief be triggered there by hand. Vercel
  only schedules crons on production.
- **`scripts/migrate-*.ts` is gitignored** (`.gitignore:84`) — the place to put a throwaway
  script that needs `@prisma/client`. A script outside the repo cannot resolve it.
- **The `name-prose` prebuild guard reads string literals**, not just page copy.
- **Report numbers 062, 063 and 064 exist three times over** across the worktrees. 065 and 066
  are the hub worktree's. This one is **067**. Pick 068+ next.

## The daily brief, in one screen

Cron `15 13 * * 1-5` (9:15am ET), after `/api/sync/sold` and `compute-sold-stats` so "yesterday"
is not half-filled. Env-scoped, one email per address, `lastAlertAt` stamped so a retry cannot
repeat an edition. The real preview edition:

```
Milton yesterday · 2026-09-09

- 19 homes came to market, asking a typical $1,040,000.
- 1 home sold. Too few to publish a typical price.
- 6 listings changed price.

On Zuest Crescent: a home sold.  <street page link>
```

**The second line is the discipline.** One sale is below `K_ANON_PRICE`, so the count is
published, the price is not, and the clause says which. **"Changed price", never "dropped"** —
`lastPriceChangeAt` cannot tell a cut from a rise (DEC-PRICE-CHANGE-NOT-DROP), and the prebuild
gate fails on the word. **An edition with nothing in it is not sent**, because the signup
promised only what changed.

Proof: Resend `a9fd6b36…` / Gmail `1a08b28224921c22`, and `639e5fee…` / `1a08b3193141894c`. A
second trigger answered `sent=0 skipped=1 "already sent this edition"`. A forged unsubscribe
token got 400; the signed one got 200 and flipped `alertEnabled` to false. **All test
subscribers were deleted, including Phase 1's leftover. Brief watches: 0.**

## What is open

1. **The Sunday brief `PreFooterCTA` promises has no sender.** Either its copy becomes the daily
   brief and its source becomes `daily-brief` (homepage worktree owns the copy), or a weekly
   sender gets built. Today those subscribers get a confirmation and nothing after it.
2. **`BRIEF_UNSUBSCRIBE_SECRET` is not set anywhere.** The link falls back to `CRON_SECRET`,
   which is set in Production and Preview, so the brief works as shipped. Set the dedicated
   variable if the two should not share a key. **Nothing is needed before merge.**
3. **The brief cron will fire on the first production deploy after merge.** Production brief
   watches are **0**, so its first run sends nothing. The first real subscriber makes it live.
4. **Eight questionable `homepage-newsletter` rows** predate that surface having a honeypot.
   Still in the table, untouched.
5. **Nine preview watches** remain, matching Phase 1's posture. Tagged, so no cron reads them.
6. Still open from report 062: **G10, the street-grain valuation figure on `/sell`**, and the
   MOD-58 lead admin columns with no UI.

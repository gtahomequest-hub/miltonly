# Handoff, portal worktree

PORTAL · D:\miltonly-portal · feat/portal

_Last rewritten 2026-09-20: MP-002c, the User-Agent guard on the door, gated locally at `f7813c1`; MP-002b (the password) is on the same branch beneath it; both NOT merged. MP-002 (the door) was merged by Core as `706ce07` on 2026-09-18._

## READ THIS FIRST

**MP-002c IS ON THIS BRANCH AT `f7813c1` (app code), GATED LOCALLY, AWAITING CORE'S MERGE BY
SHA, WITH MP-002b (`98d2cd7`) BENEATH IT.** `requestSignIn()` runs ML-005's `checkUserAgent`
after the honeypot and before the origin check: a missing or quoted User-Agent answers 200 with
the success words, writes nothing, sends nothing, spends no limiter token; the refused value is
logged as `detail`. **`src/lib/lead/guards.ts` on this branch is `origin/feat/leads @ 064c5b6`
verbatim** (ML-005, unmerged): `checkUserAgent`, `emailLimitKey`, the daily windows, the
injectable store. Whichever branch Core merges first, that file merges clean; `main`'s
`test-lead-guards` passes against it. Battery on localhost at `f7813c1`: `PASS · 21 checks ·
646 pages`. A 61-agent adversarial review confirmed 19 findings; six were fixed in `f7813c1`,
the rest are in the report's Open list, the first two being **`/api/auth/verify` has no guard
at all** (pre-existing, proposed MP-002d). Record:
`scratchpad/reports/MP-002c-user-agent-guard.md`.

**VERCEL WAS PAUSED ON 2026-09-19 AND ANSWERS 200 AGAIN ON THE 20TH.** MP-002b and MP-002c were
both gated locally: `pnpm build` then `next start -p <port>` with
`VERCEL_GIT_COMMIT_SHA=$(git rev-parse HEAD)` so `/api/build` serves the local SHA, the battery
with `EXPECT_SHA=<sha> BASE=http://localhost:<port>`. **Drop the `db2` and `db3` tags through
`/api/revalidate` first**: a local `next start` serves the on-disk Data Cache from earlier runs.
**Do not run the battery while a workflow's agents are busy on the same machine**: the run at
`0ac988d` reported 20 pages "not a 200" that answered in 18 ms afterwards. `scratchpad/mp002/
run-battery-local.sh <ref> <base> <log>` is the detached runner. MP-002b's preview proof
(`miltonly-g8swlwol7`, 2026-09-18) stands; MP-002c has had no preview, by the task's word.

**MP-002b, BENEATH, IS UNCHANGED SINCE ITS REPORT** (`scratchpad/reports/MP-002b-the-password.md`):
the email is the username, the password is set on the card, the returning sign-in is email +
password with the link as fallback, no VOW record without a password
(`src/lib/vow-access.ts`, seven surfaces).

**TWO MIGRATIONS ARE ALREADY APPLIED**, both through `prisma migrate deploy` against the shared
database: `20260917120000_portal_door` (MP-002, merged) and `20260918120000_portal_password`
(`passwordHash`, `passwordSetAt`). Ledger clean, 31 migrations. Prisma CLI reads `.env`, not
`.env.local`: `. scratchpad/mp001/env.sh` exports `DATABASE_URL` and `DIRECT_DATABASE_URL`.

**`User` HOLDS TWO ROWS**, both Aamir's: `gtahomequest@gmail.com` (verified, acknowledged on
text version 3, password set, `homeStreetSlug: farmstead-drive-milton`) and
`gtahomequest+mc028@gmail.com` (Core's MC-028 check: verified, no acknowledgement, no
password; its next link sign-in meets the full card). The 162 bot rows were purged in MP-002.

**THE VOW TEXT IS VERSION 3** ("My username is my email address and my password is mine
alone..."). Version 2 (passwordless) was on no production row. `/terms` "Signing in and sold
data" says R-805, the username, the password, the link as fallback, the 90 days, the 180-day
records.

**TWO STREET FILES CARRY ONE PORTAL EDIT EACH, DELIBERATELY.** `v2/SoldRecordsIsland.tsx`
(MP-002: renders the card when the route answers `needsAcknowledgement`, `id="sold-records"`,
the redirect anchor) and `NeighbourhoodSoldBlock.tsx` (MP-002b: one line, the gate goes through
`canSeeVowRecords()`; the component is rendered nowhere in v2 today). Both flagged in the file
headers; Home and Core should know. Everything else is portal-owned.

## What this worktree owns

Sign-in (`src/app/signin/**`, `src/app/api/auth/*`, `src/lib/auth.ts`, `src/lib/email-user.ts`),
the door (`src/lib/portal/door.ts`, `consent.ts`), the VOW components (`src/components/vow/*`,
`src/lib/vow-acknowledgement.ts`), `/api/streets/[slug]/sold-records`, the account (`/saved`
today, `/account` from MP-003), the `User` model and the portal's own tables. It reads the one
lead path and `SavedSearch`, and never edits a street, hub, homepage or nav file (the one
exceptions above). A nav change is a request to Home.

## Where things stand

| | |
|---|---|
| branch | `feat/portal`, app code `f7813c1` (on the merge of `origin/main` `e087209`), docs commit on top |
| merged | MP-001 and MP-002 (`706ce07`); MP-002b and MP-002c await Core |
| preview | none for MP-002c (gated locally); MP-002b's `miltonly-g8swlwol7` stands |
| `User` | 1 row (Aamir's), 0 bot |
| `SavedSearch` | 9 rows, all preview, 0 with a userId |
| migrations | `portal_door`, `portal_password` applied, ledger clean, 31 |
| prebuild | 38 tests; `[portal-door] PASS: 155 assertions` |
| `guards.ts` | identical to `origin/feat/leads @ 064c5b6` (ML-005) |
| next | MP-002d (guards on `/api/auth/verify` and `/login`) or MP-003 (the account), on a prompt |

## The shape that shipped

```
/signin?redirect=<path>          SignInForm: email -> password step -> "Sign in"
  |-> POST /api/auth/login       origin -> own rate limit -> bcrypt compare (dummy hash when no
  |                              row or no password, one message) -> 90-day session -> redirect
  '-> "Email me a link instead"  POST /api/auth/signup: honeypot -> user agent -> origin -> rate
                                 limit (all src/lib/lead/guards.ts, ML-005's file) -> upsert
                                 secret (code + sha256(token), 15 min, attempts 0) -> email
     -> /signin/link?t=&r=       LinkLanding POSTs the token (a scanner's GET spends nothing)
     -> POST /api/auth/verify    judgeToken / judgeCode: expiry, five-attempt lock,
                                 timingSafeEqual; clears both shapes; 90-day session
  -> window.location = redirect  the street page; island asks /sold-records
  -> canSeeVowRecords() false    VowAcknowledgementPrompt inline; asks /me for the parts owed:
                                 name + street + VOW text v3 + tick, and/or password x 2
  -> POST /api/auth/acknowledge-vow   judgePassword before anything; four VOW fields +
                                 consentText/Timestamp + firstName + homeStreetSlug + bcrypt
  -> island refetches            rows (verified AND acknowledged AND passwordHash)
```

## Traps

- **Preview writes to production data and sends real email.** A test sign-in on a preview is
  a real `User` row and a real Resend send. Use an address you own; `scratchpad/mp002/
  inspect-user.mjs <email> [--reset-ack]` shows the row and can reset the acknowledgement
  for a re-proof.
- **The signup rate limit is the lead layer's bucket** (`lead:ip`, `lead:email`): 5 per IP per
  10 min, 3 per address per hour, shared with the forms. A refused request spends nothing;
  a proof batch spends one per email. Wait ten clear minutes between batches. **The login
  limit is its own** (`auth:login:ip` 10 per 10 min, `auth:login:email` 10 per 15 min).
- **`scratchpad/mp002/null-password.mjs <email>`** clears a row's password and keeps its
  acknowledgement, for proving the password-only card; `inspect-user.mjs --reset-ack` clears
  the acknowledgement, consent and street and KEEPS the password (so the card comes back
  acknowledgement-only). Null the password too for the full card.
- **`/api/build` says `commit: unknown` on a CLI deploy.** Match the preview by its URL from
  the deploy output, not by commit.
- **The street theme's `.street-v2 *` reset lands after Tailwind and beats its utilities.**
  Anything portal-owned that renders inside a street page needs its own sheet with
  `section[data-…]`-grade selectors; `vow-card.css` is the pattern.
- **`scratchpad/mp002/probe-door.mjs`** is the phone proof (`request`, then `link` with the password; `login` and `wrong` for MP-002b;
  with the URL read from the inbox). Chrome is at `C:/Program Files/Google/Chrome/…`;
  puppeteer's own cache is empty.
- **Reports are `scratchpad/reports/<TASK-ID>-<slug>.md`**, first line `# <TASK-ID>`, then the
  worktree and branch line, tracked in git. Portal tasks are `MP-`.

## What is open

1. **MP-002d, the guards on `/api/auth/verify` and `/api/auth/login`.** verify has no origin
   check, no User-Agent guard, no rate limit, and its five-attempt lock is check-then-increment:
   five wrong codes against any address while its code is pending lock it, concurrently. login
   accepts a missing or quoted User-Agent and keys its email bucket on the raw address. Both are
   the portal's files; proposed as one slice, with `updateMany where verifyAttempts < MAX`.
2. MP-003, the account: `/account` replacing `/saved`, the first-screen card on
   `homeStreetSlug`, watches with toggles, the brief, sold records scoped to my streets,
   `VowAccessLog`, **change my password**.
3. `guards.ts` cites RFC 9110 for "no quotes in a User-Agent"; the grammar allows them and the
   rule is empirical. Leads' wording; any change must land identically on both branches.
4. The street page's sold table clips at 390 (pre-existing island layout; Home's).
5. `/rentals` sends `?next=`; the form reads both.

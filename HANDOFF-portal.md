# Handoff, portal worktree

PORTAL · D:\miltonly-portal · feat/portal

_Last rewritten 2026-09-19: MP-002b, the password, gated locally at `f7ddf4b` while Vercel is paused (402 everywhere); the preview proof of the 18th stands; NOT merged. MP-002 (the door) was merged by Core as `706ce07` on 2026-09-18._

## READ THIS FIRST

**VERCEL IS PAUSED (2026-09-19, about seven hours): every deployment answers 402.** No `npx
vercel` deploys; gate with `pnpm build` then `next start -p <port>` with
`VERCEL_GIT_COMMIT_SHA=$(git rev-parse HEAD)` so `/api/build` serves the local SHA, and run the
battery with `EXPECT_SHA=<sha> BASE=http://localhost:<port>`. **Drop the `db2` and `db3` tags
through `/api/revalidate` first**: a local `next start` serves the on-disk Data Cache from
earlier runs, and the first battery of the 19th reported yesterday's figures on two hubs
(`scratchpad/reports/MP-002b-the-password.md`, last section). `scratchpad/mp002/
run-battery-local.sh <ref> <base> <log>` is the detached runner. Merges to `main` can be
prepared, not pushed, until production answers 200.

**MP-002b IS ON THIS BRANCH AT `98d2cd7` (app code, head `f7ddf4b` with docs), GATED LOCALLY
(build exit 0, battery `PASS · 20 checks · 626 pages` on localhost, the four phone flows
repeated on localhost), AWAITING CORE'S MERGE BY SHA.** The broker
of record ruled under TRREB R-805(c): a username and a password per consumer. The email is the
username; the password (12+ characters, not the email, bcrypt cost 12) is set on the card after
the link or code verifies the email; the returning sign-in is email + password with "Email me a
link instead" as the fallback; **no VOW record is served until the password exists**
(`src/lib/vow-access.ts` `canSeeVowRecords()`, called by all seven VOW surfaces). Preview
`miltonly-g8swlwol7` is the proof, four flows at 390 x 844: first sign-in by link then the full
card (12 rows at 4.7 s), returning sign-in by password (no card, 12 rows at 3.0 s), a wrong
password refused, and an acknowledged row without a password meeting the password-only card.
Record: `scratchpad/reports/MP-002b-the-password.md`. Local build exit 0 on Node 22, `P2024` 0,
prebuild 38 tests, `[portal-door] PASS: 120 assertions`.

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
| branch | `feat/portal`, app code `98d2cd7` (on the merge of `origin/main` `e606d8b`), docs commit on top |
| merged | MP-001 and MP-002 (`706ce07`); MP-002b awaits Core |
| preview | `miltonly-g8swlwol7-gtahomequest-hubs-projects.vercel.app` |
| `User` | 2 rows (Aamir's), 0 bot |
| `SavedSearch` | 9 rows, all preview, 0 with a userId |
| migrations | `portal_door`, `portal_password` applied, ledger clean, 31 |
| prebuild | 38 tests; `[portal-door] PASS: 120 assertions` |
| next | MP-003, the account, on a prompt (the change-password surface goes there) |

## The shape that shipped

```
/signin?redirect=<path>          SignInForm: email -> password step -> "Sign in"
  |-> POST /api/auth/login       origin -> own rate limit -> bcrypt compare (dummy hash when no
  |                              row or no password, one message) -> 90-day session -> redirect
  '-> "Email me a link instead"  POST /api/auth/signup: honeypot -> origin -> rate limit -> upsert
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

1. MP-003, the account: `/account` replacing `/saved`, the first-screen card on
   `homeStreetSlug`, watches with toggles, the brief, sold records scoped to my streets,
   `VowAccessLog`, **change my password** (the link path resets nothing; the card only asks
   when the row has no password). The CASL footer and unsubscribe landed in ML-004.
2. The street page's sold table clips at 390 (pre-existing island layout; Home's).
3. `/rentals` sends `?next=`; the form reads both, so it works, but the site should settle on
   `redirect`.

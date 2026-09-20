# Handoff, portal worktree

PORTAL · D:\miltonly-portal · feat/portal

_Last rewritten 2026-09-17 after MP-002, the door: built, previewed, proven on a phone viewport, NOT merged._

## READ THIS FIRST

**MP-002 IS ON THIS BRANCH AT `86d5f9f` (app code), AWAITING CORE'S MERGE BY SHA.** Preview
`miltonly-438g01i85` is the proof: street page → "Sign in free to unlock" → email in 13 s →
link → back on that street's sold records with the card inline → 12 rows, 4.0 s from link tap
to rows, at 390 × 844 with an iPhone UA. Record and every number in
`scratchpad/reports/MP-002-the-door.md`. Local build exit 0 on Node 22, `P2024` 0, prebuild
37 tests including `scripts/test-portal-door.ts` (76 assertions; 100 honeypot signups send 0
emails).

**THE MIGRATION IS ALREADY APPLIED.** `20260917120000_portal_door` (five columns on `User`,
one index) went through `prisma migrate deploy` against the shared database, ledger clean, 30
migrations. The preview needed the columns to exist; the merge carries the folder and
`migrate status` will report up to date. Prisma CLI reads `.env`, not `.env.local`:
`. scratchpad/mp001/env.sh` exports `DATABASE_URL` and `DIRECT_DATABASE_URL` for a shell.

**THE BOT ROWS ARE GONE.** `scripts/purge-bot-users.ts --apply` deleted 162 (dry run first, 0
kept). `User` holds one row: `gtahomequest@gmail.com`, Aamir's own, verified and acknowledged
from the proof, `homeStreetSlug: farmstead-drive-milton`. Leave or delete as he prefers.

**THE ONE RULING STILL OPEN: PASSWORDLESS.** The TRREB VOW Policy says "username and a
password", up to 90 days then reconfirmed. MP-002 ships the reading from MP-001: the email is
the username, the one-time link or code the credential, the session a fixed 90 days
(`SESSION_MAX_DAYS`). It is written into `VOW_ACKNOWLEDGEMENT_TEXT` (version 2) and `/terms`
says it stands pending the broker of record. If the ruling is "a password", add an optional
password to the same account and make the text version 3; nothing else moves.

**ONE STREET FILE WAS EDITED, DELIBERATELY.** `src/components/street/v2/SoldRecordsIsland.tsx`:
the island renders `VowAcknowledgementPrompt` when the route answers `needsAcknowledgement`,
refetches on done, carries `id="sold-records"` and sends `redirect=<path>#sold-records`. The
card had to appear on the page that needed it. Flagged in the file header; Home and Core
should know. Everything else the slice touched is portal-owned.

## What this worktree owns

Sign-in (`src/app/signin/**`, `src/app/api/auth/*`, `src/lib/auth.ts`, `src/lib/email-user.ts`),
the door (`src/lib/portal/door.ts`, `consent.ts`), the VOW components (`src/components/vow/*`,
`src/lib/vow-acknowledgement.ts`), `/api/streets/[slug]/sold-records`, the account (`/saved`
today, `/account` from MP-003), the `User` model and the portal's own tables. It reads the one
lead path and `SavedSearch`, and never edits a street, hub, homepage or nav file (the one
exception above). A nav change is a request to Home.

## Where things stand

| | |
|---|---|
| branch | `feat/portal`, app code `86d5f9f`, docs commit on top |
| merged | nothing yet; MP-001 (docs) and MP-002 both await Core |
| preview | `miltonly-438g01i85-gtahomequest-hubs-projects.vercel.app` |
| `User` | 1 row (Aamir's), 0 bot |
| `SavedSearch` | 9 rows, all preview, 0 with a userId |
| migration | `20260917120000_portal_door` applied, ledger clean |
| prebuild | 37 tests; `[portal-door] PASS: 76 assertions` |
| next | MP-003, the account, on a prompt |

## The shape that shipped

```
/signin?redirect=<path>          SignInForm: email + honeypot, consent sentence shown
  → POST /api/auth/signup        requestSignIn(): honeypot → origin → rate limit → upsert
                                 secret (code + sha256(token), 15 min, attempts 0) → email
  → email: link + code           sendSignInEmail(), link opens the host that served the form
  → /signin/link?t=&r=           LinkLanding POSTs the token (a scanner's GET spends nothing)
  → POST /api/auth/verify        judgeToken / judgeCode: expiry, five-attempt lock,
                                 timingSafeEqual; clears both shapes; 90-day session
  → window.location = redirect   the street page; island asks /sold-records
  → needsAcknowledgement         VowAcknowledgementPrompt inline: name, street (registry
                                 autocomplete), one tick over VOW text + consent sentence
  → POST /api/auth/acknowledge-vow   four VOW fields + consentText/Timestamp + firstName +
                                 homeStreetSlug (refused unless ResidentialStreet has it)
  → island refetches             rows
```

## Traps

- **Preview writes to production data and sends real email.** A test sign-in on a preview is
  a real `User` row and a real Resend send. Use an address you own; `scratchpad/mp002/
  inspect-user.mjs <email> [--reset-ack]` shows the row and can reset the acknowledgement
  for a re-proof.
- **The signup rate limit is the lead layer's bucket** (`lead:ip`, `lead:email`): 5 per IP per
  10 min, 3 per address per hour, shared with the forms. A refused request spends nothing;
  a proof batch spends one per email. Wait ten clear minutes between batches.
- **`/api/build` says `commit: unknown` on a CLI deploy.** Match the preview by its URL from
  the deploy output, not by commit.
- **The street theme's `.street-v2 *` reset lands after Tailwind and beats its utilities.**
  Anything portal-owned that renders inside a street page needs its own sheet with
  `section[data-…]`-grade selectors; `vow-card.css` is the pattern.
- **`scratchpad/mp002/probe-door.mjs`** is the two-phase phone proof (`request`, then `link`
  with the URL read from the inbox). Chrome is at `C:/Program Files/Google/Chrome/…`;
  puppeteer's own cache is empty.
- **Reports are `scratchpad/reports/<TASK-ID>-<slug>.md`**, first line `# <TASK-ID>`, then the
  worktree and branch line, tracked in git. Portal tasks are `MP-`.

## What is open

1. The broker of record's ruling on passwordless (above).
2. MP-003, the account: `/account` replacing `/saved`, the first-screen card on
   `homeStreetSlug`, watches with toggles, the brief, sold records scoped to my streets,
   `VowAccessLog`, the CASL fixes (`sendDealAlertEmail` unsubscribe, mailing address footer).
3. The street page's sold table clips at 390 (pre-existing island layout; Home's).
4. `/rentals` sends `?next=`; the form reads both, so it works, but the site should settle on
   `redirect`.

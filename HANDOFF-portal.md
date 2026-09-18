# Handoff, portal worktree

PORTAL · D:\miltonly-portal · feat/portal

_Created 2026-09-17 by MP-001, the Gate A recon. No code on this branch yet._

## READ THIS FIRST

**MP-001 IS RECON ONLY AND IT STOPPED WHERE IT WAS TOLD TO.** The report is
`scratchpad/reports/MP-001-portal-recon.md`: what exists, the compliance table (TRREB VOW, PIPEDA,
CASL), the portal in one page, and three slices (MP-002 the door, MP-003 the account, MP-004 the
loop back). Nothing starts until a prompt names a slice.

**THE ONE DECISION THAT GATES SLICE 1.** The TRREB VOW Policy says a consumer "must supply a
username and a password", valid up to 90 days then reconfirmed, and the datafeed agreement
defines a VOW as "password-protected". The brief says never ask for a password. The report's
reading is that an emailed one-time link or code is the consumer's private, expiring credential
and the email address is the username, with a 90-day hard ceiling on the session. That reading
needs Aamir and the broker of record to accept it, in writing, before MP-002 ships. If they say
"password", MP-002 adds an optional password to the same account and nothing else moves.

**THE `User` TABLE IS 162 BOT ROWS AND NOTHING ELSE.** 0 verified, 0 acknowledged, 0 saved, no
login ever. Dotted-Gmail aliases, one UA, the same addresses posted 64 `sale-detail` leads
between 2026-09-11 and 09-16. `/api/auth/signup` has no honeypot, no rate limit, and sends a
Resend email on every hit. Core and Leads were told in the report; the fix is slice 1's.

## What this worktree owns

Sign-in (`src/app/signin`, `src/app/api/auth/*`, `src/lib/auth.ts`, `src/lib/email-user.ts`),
the account (`/saved` today, `/account` from MP-003), the VOW components
(`src/components/vow/*`, `src/lib/vow-acknowledgement.ts`), the `User` model and the portal's own
tables (proposed: `VowAccessLog`). It reads the one lead path (`/api/leads/create`,
`src/lib/lead/*`) and `SavedSearch`, and never edits a street, hub, homepage or nav file. A nav
change (the signed-in word in the bar) is a request to Home. A migration is written here and
applied by Core.

## Where things stand

| | |
|---|---|
| branch | `feat/portal` at `origin/main` `10de234` plus this handoff |
| code on the branch | none |
| `User` | 162 rows, all bot, 0 verified |
| `SavedSearch` | 9 rows, all preview, 0 with a userId |
| production watches | 0 |
| `JWT_SECRET` | set on Production (`vercel env ls`); local uses the dev fallback |
| next | MP-002 on a prompt, after the password ruling |

## Facts the report established (so the next session need not re-derive them)

- `/signin` ignores `redirect`, `intent`, `street`, `neighbourhood`; six surfaces send them.
  After verify it always lands on `/saved`.
- The acknowledgement prompt is reachable on `/sold` only. `NeighbourhoodSoldBlock`, the one
  other `VowGate` caller, is rendered nowhere in street v2. A signed-in, unacknowledged user
  sees "Sign in free to unlock" on every street page.
- Every VOW record fetcher in `src/lib/sold-data.ts` checks session and acknowledgement first;
  `days` is a parameter (default 90), `MAX_CONSUMER_RECORDS` is 100. The 90-day window is a
  default, not a rule in either TRREB document.
- `sendDealAlertEmail` has no unsubscribe and no mailing address. The brief has both. No email
  the site sends carries a mailing address.
- No mounted lead surface sends `consentText`: 0 of 79 production leads carry one.
- Nothing in the nav reads `useUser`. `User.leadId` is written nowhere.

## Traps

- **Pull before you branch or push.** The nightly audit commits to `main` without a human.
- **Preview writes to production data.** A test sign-in on a preview creates a real `User`
  row and a real Resend send. Use a tagged address and delete the row after.
- **The `User` purge in slice 1 must exclude any row with `verified=true` or a session**, even
  though today there are none.
- **Reports are `scratchpad/reports/<TASK-ID>-<slug>.md`**, first line `# <TASK-ID>`, then the
  worktree and branch line, tracked in git. Portal tasks are `MP-`.

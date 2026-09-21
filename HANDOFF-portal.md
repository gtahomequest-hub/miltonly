# Handoff, portal worktree

PORTAL · D:\miltonly-portal · feat/portal

_Last rewritten 2026-09-21: MP-006, the PropTx VOW Best Practices, at `fd65058`, gated locally, one preview, proven on a phone; MP-002c is beneath it on the branch; both NOT merged. MP-002 (`706ce07`) and MP-002b (`c1caac8`) are merged._

## READ THIS FIRST

**MP-006 IS ON THIS BRANCH AT `fd65058` (app code), AWAITING CORE'S MERGE BY SHA, WITH MP-002c
(`f7813c1`) BENEATH IT.** Aamir's PropTx deadline is about 2026-10-01. The slice: the 90-day
password with renewal (R-8.06), the 60-minute inactivity timeout (R-8.13), the 180-day
credential-record rule (Appendix B(b)), the nine Terms of Use clauses at version 4 with
re-consent and a VowConsent history (Appendix B(c)), the VowAccessLog audit trail on eight
surfaces with an admin export (VOW Policy 19), the registrant question and the review-only
suspicious-activity tracking (R-8.09(b)), and how PropTx gets the trail. Record, with the
clause-by-clause audit of version 3 and every gap left open:
`scratchpad/reports/MP-006-vow-best-practices.md`. Gates: build exit 0, battery `PASS · 22
checks · 690 pages` on localhost at `fd65058`, preview `miltonly-rl47fc9cp`, the phone proof
at 390. Prebuild: `[vow-best-practices] PASS: 202 assertions`, `[portal-door] PASS: 161`.

**THREE THINGS CORE MUST KNOW BEFORE MERGING.**
1. **Every existing session signs out at deploy** (the token gained an `act` claim; old tokens
   are judged invalid) and **every existing row owes a re-consent to version 4 and the
   registrant answer** before any record shows. Two rows exist, both the desk's, both made
   current on 2026-09-21. Nothing else is affected.
2. **The production battery's `vow-fields` check signs in as the desk's row** (the most
   recently acknowledged real consumer). It passes only while that row is current: it is now;
   its password expires **2026-12-19** and the check cannot renew it (Core's script). Before
   that date the desk renews on the card, or Core gives the battery its own account
   (`gtahomequest+mp006@gmail.com` exists, with a password the desk can set).
3. **Migration `20260921120000_portal_vow_best_practices` is applied** (VowConsent, VowAccessLog,
   five User columns; ledger clean, 32).

**THE ONE POLICY QUESTION FOR AAMIR AND PROPTX.** Appendix B(b) says the Member keeps "the
username and current password". We keep a bcrypt hash, never plaintext, and nothing in this
slice weakens that. The report (item 3) says what we can produce and what to ask PropTx.

**THE 204-AGENT REVIEW** confirmed 64 findings; 30 were fixed in `7b9d307` (the grid and
saved-listings had no trail row, the clock did not wind on soft navigation, a first-time
registrant "yes" was refused, re-consent lost the prior agreement, the list had no numbers, and
the tests were string reads); the rest are the report's Open list, each with its owner.

## What this worktree owns

Sign-in (`src/app/signin/**`, `src/app/api/auth/*`, `src/lib/auth.ts`, `src/lib/email-user.ts`),
the door (`src/lib/portal/door.ts`, `consent.ts`, `password.ts`, `passwordRule.ts`,
`acknowledge.ts`), the VOW rule and trail (`src/lib/vow-access.ts`, `vow-audit.ts`,
`vow-audit-rules.ts`, `vow-acknowledgement.ts`, `src/components/vow/*`), the record routes'
gate and trail lines (`/api/streets/[slug]/sold-records`, `/api/sold`, `/api/sold-stats`,
`/api/listings/[mlsNumber]/vow`), the admin export (`/api/admin/vow-access`,
`scripts/export-vow-access-log.ts`), the account (`/saved` today, `/account` from MP-003), the
`User`, `VowConsent` and `VowAccessLog` models. It reads the one lead path and `SavedSearch`,
and never edits a street, hub, homepage or nav file. Files touched outside that with one line
each, all flagged in their headers: `src/components/UserProvider.tsx` (the /me refetch on
navigation), `src/app/listings/page.tsx` and `src/app/sold/page.tsx` (the trail write),
`src/components/street/v2/SoldRecordsIsland.tsx` and `NeighbourhoodSoldBlock.tsx` (MP-002,
MP-002b), `/privacy` and `/terms` (the required sentences).

## Where things stand

| | |
|---|---|
| branch | `feat/portal`, app code `fd65058` (on the merge of `origin/main` `2166975`), docs commit on top |
| merged | MP-001, MP-002 (`706ce07`), MP-002b (`c1caac8`); MP-002c and MP-006 await Core |
| preview | `miltonly-rl47fc9cp-gtahomequest-hubs-projects.vercel.app` (MP-006) |
| `User` | 2 rows (the desk's: `gtahomequest@gmail.com` current on v4, `+mp006` the proof row), 0 bot |
| `VowConsent` / `VowAccessLog` | the proofs' rows; the export scripts read them |
| migrations | 32, `portal_vow_best_practices` applied, ledger clean |
| prebuild | 39 tests; `[vow-best-practices] PASS: 202`, `[portal-door] PASS: 161` |
| next | MP-003, the account (change password, delete/anonymise, the first screen), on a prompt |

## The shape that shipped

```
session      one cookie, one JWT: exp = sign-in + 90 d (fixed), act = last touch + 60 min.
             getSession() judges both; touchSession() re-issues act only, from /api/auth/me
             (UserProvider: on mount and on every client navigation) and every auth route.
records      canSeeVowRecords(): verified AND terms at VOW_TERMS_VERSION AND password set AND
             younger than 90 d AND registrant answered no AND no "registrant" flag.
             Every surface that gates writes VowAccessLog after the gate (8 surfaces; the
             prebuild walks src for any that does not).
the card     asks /api/auth/me for the parts owed (vowStepsLeft): re-consent | first agreement
             (name, street, terms x10 numbered, ix bold, tick) | registrant yes/no | password
             set | password renewal (same = reconfirm, new = replace).
             POST /api/auth/acknowledge-vow -> planAcknowledgement() (pure, tested) -> one write
             (+ VowConsent rows: the prior agreement once, then the new one).
review       flagIfSuspicious(): > 40 scopes or > 400 reads a day sets "suspicious-access",
             which refuses nothing; a registrant "yes" sets "registrant", which does; a person
             clears either (scratchpad/mp002/mp006-state.mjs <email> registrant false).
export       /api/admin/vow-access?from&to&format=csv | ?view=suspicious ; the shell script.
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
- **`scratchpad/mp002/mp006-state.mjs <email> <op>`** is the proof switchboard: `show`,
  `version 3`, `password-age 91`, `registrant null|true|false`, `reset-all`, `trail`,
  `consents`, `delete-unset` (refuses a row with a password). `forge-session.ts <userId>
  fresh|idle|ceiling` mints a token with `auth.ts`'s signer for the inactivity proof on
  localhost (the dev secret; a preview's secret is Vercel's).
- **The desk's row's password is Core's** (set by MC-031 for the battery's
  `VERIFY_PORTAL_PASSWORD`); do not replace it in a proof. Use the `+mp006` row for anything
  that changes a password.
- **The inbox rate limit collapses `gtahomequest+anything@gmail.com` into one inbox** (ML-005:
  3 an hour, 6 a day): a proof that needs four sign-in emails in an hour waits.
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

1. **MP-003, the account:** `/account` replacing `/saved`, the first-screen card on
   `homeStreetSlug`, watches with toggles, the brief, sold records scoped to my streets,
   **change my password** (proving the old one), **delete my account** (anonymise, keep the
   180-day records; `VowConsent` and `VowAccessLog` cascade today), a forgot-password path
   before day 90.
2. **The battery's account** (Core): its own row, its card completed by the check, so the
   desk's row is not the battery's and the 2026-12-19 expiry cannot fail production.
3. **The "current password" question** to PropTx (the report, item 3).
4. **Aamir reads the ten clauses against the PropTx document once** before 2026-10-01; a
   change is a version bump, the hash in `test-vow-best-practices.ts`, and a re-consent.
5. The street page's sold table clips at 390 (pre-existing island layout; Home's).
6. `/rentals` sends `?next=`; the form reads both.

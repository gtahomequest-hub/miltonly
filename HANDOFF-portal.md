# Handoff, portal worktree

PORTAL · D:\miltonly-portal · feat/portal

_Last rewritten 2026-09-27: MP-007, the VOW brought to the PropTx standard, at `cd2eed1`, on the
merge of `origin/main` `b62fcf7` (`bbf4187`). Gated (build exit 0, prebuild 304 + 161 + 111, one
preview `miltonly-pa11oubpl`, five proofs at 390). NOT merged; Core merges by SHA `cd2eed1`.
MP-006 (`601c64a`) is on `main` and live. Record `scratchpad/reports/MP-007-proptx-standard.md`._

## READ THIS FIRST

**MP-007 IS ON THIS BRANCH AT `cd2eed1` (app code), AWAITING CORE'S MERGE BY SHA.** The docs
commit on top is the branch head. It brings the VOW to the PropTx standard TRREB held Homesly to,
read against the actual rule text in `D:\homesly\docs\compliance` (not a summary):

1. **Terms v5.** The nine clauses read word-for-word against Appendix B(c); four departed and are
   fixed (iv "Listing Information", v "the validity of PropTx's proprietary rights", vi "directly
   or indirectly"/"to another individual or entity", viii "or their duly authorized
   representatives"). Added: the two Rule 8.09(d)/(e) AI sentences, Rule 8.09(g) ownership naming
   TRREB and PropTx, and the account-sharing prohibition. `VOW_TERMS_VERSION = 5`, 12 clauses, SHA
   re-pinned in the test.
2. **Reviewer path (R-8.21).** A third declaration answer holds the account (`reviewFlag`
   `reviewer-hold`, no records), emails the owner, and is cleared from `/admin/vow`; the account
   then sees what a consumer sees. Published notices on the sign-in, terms and account pages.
3. **Hard throttle (R-8.13)** on all eight VOW surfaces: 120/h and 600/day per consumer, 300/h per
   IP; 429 and one `VowThrottle` audit row per consumer/limit/window; MP-006's review flag stays.
4. **Per-consumer export** aligned column-for-column to Homesly's `audit-report.ts`.
5. **Erasure** anonymises rather than cascade-deletes and keeps the 180-day record (Appendix B(b)),
   with a purge past the window; `/privacy` says so and names TRESA not REBBA.
6. MP-006's open items from MC-044: the session clock winds on a search-param change (SEO-safe),
   the renewal kicker is fixed, the registrant wall uses `contactEmail()`.

**FOUR THINGS CORE MUST KNOW BEFORE MERGING.**

1. **At the v5 bump every row owes a re-consent** and every live session signs out (as at every
   version bump). The prior agreement is carried into `VowConsent`. The primary desk row
   (`gtahomequest@gmail.com`) was made current on v5 by the card, **password untouched**; do the
   same on production before the prod battery, or `vow-fields` fails as it did on MP-006. There is
   no `VERIFY_PORTAL_PASSWORD`/`VERIFY_PORTAL_EMAIL` on this worktree's `.env.local`, so
   `vow-fields` signs in by link (signup+verify) as the most-recently-acknowledged row; keep that
   row current on v5.
2. **Migration `20260927120000_portal_vow_reviewer_throttle_erasure` is applied** (the
   `User.erasureRequestedAt` column and the `VowThrottle` table; the reviewer path uses
   `reviewFlag` values, no column). `prisma migrate status` lists three older street migrations as
   unapplied (`street_video`, `street_adjacency`, `street_generation_input_json`) — pre-existing
   ledger drift owned by other tiers, DB effects already present, untouched here.
3. **`@vercel/analytics` had to be installed** (`pnpm install`) in this worktree: the
   `origin/main` merge added it to `package.json` (MH-009) but not to `node_modules`. No tracked
   file changed; `pnpm-lock.yaml` was already in sync.
4. **`CONTACT_EMAIL` is unset here**, so the registrant wall and the reviewer notice render the
   contact-page fallback, not an address. Set it on the deployment to light the address up.

**THE LOCAL BATTERY, AND WHY IT IS NOT A DEFECT.** The full local battery flagged `tiles` and
`hub-page` only: one sub-k 12-month tile and 29 ladder rows to non-200 streets. Two local
conditions, neither MP-007 (no street/hub/ladder/k-anon/stats code touched): the on-disk Data
Cache was not purged before the run (purge `db2`/`db3`/`listings` first), and the local build
prerendered 690 of 719 published streets so 29 ladder targets 404 on `next start` (a build-timing
gap a rebuild closes). **Production PASSES the same two checks on 719 pages** (`PASS · 2 checks ·
719 pages`), clean on the exact assertions — so neither is real, and the preview ISRs streets so
the gap cannot arise there.

**THE "CURRENT PASSWORD" QUESTION** stands from MP-006: we hold a bcrypt hash, never plaintext;
the export produces the password record (scheme, set date, expiry, that the consumer proved it),
not the plaintext. If PropTx insists on plaintext, that is a separate decision (reversible
encryption under a brokerage key), not this slice.

## What this worktree owns

Sign-in (`src/app/signin/**`, `src/app/api/auth/*`, `src/lib/auth.ts`, `src/lib/email-user.ts`),
the door (`src/lib/portal/door.ts`, `consent.ts`, `password.ts`, `passwordRule.ts`,
`acknowledge.ts`, `erasure.ts`), the VOW rule, trail, reviewer path and throttle
(`src/lib/vow-access.ts`, `vow-audit.ts`, `vow-audit-rules.ts`, `vow-acknowledgement.ts`,
`src/lib/vow/{reviewer,hold,throttle,consumer-report,consumer-report-db}.ts`,
`src/components/vow/*`), the record routes' gate/trail/throttle
(`/api/streets/[slug]/sold-records`, `/api/sold`, `/api/sold-stats`,
`/api/listings/[mlsNumber]/vow`, `/api/auth/saved-listings`), the two page surfaces' trail/throttle
(`/listings`, `/sold`), the admin export and desk (`/api/admin/vow-access`, `/admin/vow/**`,
`scripts/export-vow-access-log.ts`, `scripts/vow-erasure.ts`), the `User`, `VowConsent`,
`VowAccessLog` and `VowThrottle` models, and `src/lib/compliance/contact.ts` (mirrors MC-047's
helper; if MC-047 lands the same file, the content is identical). Files touched with one line
each, flagged in their headers: `src/components/UserProvider.tsx` (the search-param touch),
`/privacy`, `/terms`, `/saved`, `/signin` (the reviewer notice and the retention copy).

## Where things stand

| | |
|---|---|
| branch | `feat/portal`, app code `cd2eed1` (on `bbf4187`, the merge of `origin/main` `b62fcf7`), docs commit on top |
| merged | MP-001, MP-002 (`706ce07`), MP-002b (`c1caac8`), MP-002c + MP-006 (`601c64a`, MC-044); MP-007 awaits Core |
| preview | `miltonly-pa11oubpl-gtahomequest-hubs-projects.vercel.app` (MP-007; `/api/build` says `commit: unknown` on a CLI deploy, match by URL) |
| migrations | 33, `portal_vow_reviewer_throttle_erasure` applied |
| prebuild | `[vow-best-practices] 304`, `[portal-door] 161`, `[vow-fields] 111` |
| next | MP-003, the account: change password (proving the old one), a forgot path before day 90, `/account` on `homeStreetSlug` |

## Traps

- **Preview writes to production data and sends real email.** Use `+`-tagged addresses you own.
  `scratchpad/mp007/state.mjs <email> <op>` (show, reviewer-hold, reviewer-clear, reset-all,
  reset-trail, counts, version) and `scratchpad/mp007/proof.mjs` are the proof switchboard.
- **The inbox rate limit collapses `gtahomequest+anything@gmail.com`** (ML-005: 3/hour, 6/day for
  signups). A proof needing several sign-in emails in an hour waits. Logins are a separate bucket.
- **The desk row's password is Core's** (`VERIFY_PORTAL_PASSWORD`); re-consent only, never replace
  it. Use a `+mp007…` row for anything that sets a password.
- **The local `next start` battery** must drop `db2`/`db3`/`listings` first (`/api/revalidate`
  with `REVALIDATION_SECRET`), or the on-disk Data Cache serves yesterday's rows.
- **Reports are `scratchpad/reports/<TASK-ID>-<slug>.md`**, first line `# <TASK-ID>`, then the
  worktree/branch line, tracked in git. Evidence in `scratchpad/mp007/` stays untracked.

## What is open

1. **MP-003, the account:** change my password (proving the old one), a forgot-password path
   before day 90, `/account` replacing `/saved` on `homeStreetSlug`. Called out by MC-044; not in
   MP-007's scope.
2. **The "current password" question** to PropTx (above; MP-006 item 3).
3. **`CONTACT_EMAIL`** to set on the deployment (a config action) so the reviewer/registrant copy
   names an address rather than the contact page.
4. **`email_verified_at`** is blank in the per-consumer export because the portal does not
   timestamp email verification; a possible follow-up (never fabricated).
5. **The three older street migrations** `migrate status` lists are pre-existing ledger drift, not
   MP-007's; the audit/content tiers own them.

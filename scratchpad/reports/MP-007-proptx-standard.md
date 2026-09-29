# MP-007

PORTAL · D:\miltonly-portal · feat/portal

The VOW brought to the PropTx standard TRREB held Homesly to, read against the actual rule text
in `D:\homesly\docs\compliance` (the three PDFs), not a summary. App code at **`cd2eed1`**, on
the merge of `origin/main` `b62fcf7` into the branch (`bbf4187`). The docs commit on top is the
branch head, named in the reply. **Gated: `pnpm build` exit 0 (841 static pages); prebuild
304 + 161 + 111 assertions; one preview (`miltonly-pa11oubpl`), all five required proofs passed
on a phone at 390.** bcrypt stays; no plaintext password is stored, logged, exported or printed.
Every MP-006 gate stays. **NOT merged; Core merges by SHA `cd2eed1`.** Aamir's PropTx deadline is
about 2026-10-01.

## 1. Terms v5, verified word-for-word against Appendix B(c)

I read Appendix B(c) and Rule 8.09 from the PDFs and checked each of the nine v4 clauses against
the document. Four departed; all four are fixed. The full table is in
`scratchpad/mp007/clause-diff.md`. The diffs:

- **(iv)** v4 said "the data or **information** provided"; the Appendix says "the data or
  **Listing Information** provided". Fixed.
- **(v)** v4 said "owns, and holds the copyright in"; the Appendix says "ownership of, and **the
  validity of PropTx's proprietary rights** and copyright in". Fixed; "the data" is now "the
  MLS® data".
- **(vi)** v4 omitted "**directly or indirectly**" and "**to another individual or entity**" and
  loosely reworded the scraping list. Restored to the Appendix's wording.
- **(viii)** v4 omitted "**or their duly authorized representatives**". Fixed.

Clauses (i), (ii), (iii), (vii), (ix) matched and are unchanged, except clause (i) now says
"Sales Representative" (the site's own title in `config.realtor.title`) rather than
"Salesperson"; the rule names only "the Member", so this is a consistency fix, not a rule
departure.

Added, verbatim from Rule 8.09:

- **The two "for greater certainty" AI sentences.** 8.09(d) rides on clause (iv) (no using any AI
  system or technology to collect, store, reorganize, analyze, summarize or manipulate Listing
  Information); 8.09(e) rides on clause (vi) (no directly or indirectly providing Listing
  Information to any AI system).
- **Rule 8.09(g),** a new clause naming the ownership and the validity of the proprietary rights
  and copyright in the MLS® Database, the MLS® System, the Listing Information "and any related
  information" of the **Toronto Regional Real Estate Board (TRREB)** and of **PropTx Innovations
  Inc.**
- **The account-sharing prohibition** (a new clause; VOW Best Practices item 39, R-8.05(c)): no
  sharing the username or password, no letting anyone else use the account, no second account,
  no third-party access through the credential.

`VOW_TERMS_VERSION` is **5**. Twelve clauses now: `i, ii, iii, iv, v, vi, vii, viii, ix, own-g,
share, signin`. Only clause (ix) is bold (Appendix B(c)(ix): "boldly"). No em-dash. The
SHA-256 of the stored text is re-pinned in the test to
`3595a8fed7e09573c3c5862b2a6d94218b3d69e4437b7d6ecc812d56d2a990ce`, so a reword without a version
bump fails the build. Every row re-acknowledges v5, and the prior agreement is carried into
`VowConsent` history as MP-006 does. The two desk rows exist; the primary desk row
(`gtahomequest@gmail.com`) was brought current to v5 by the real card flow, its password
untouched (see the battery note).

## 2. The reviewer path (Rule 8.21, item 30, Policy 12)

A third answer on the registrant declaration: "I am reviewing this VOW for PropTx or the Toronto
Regional Real Estate Board." Choosing it stores the answer alone, sets `reviewFlag` to
`reviewer-hold`, holds the account with **no records**, and emails the owner through the door's
Resend client (`sendReviewerHeldOwnerEmail`, to `ALERT_EMAIL_TO`), naming the reviewer and the
`/admin/vow` desk. The owner confirms the organization by email and **clears the hold from the
`/admin/vow` desk** (a server action behind the admin cookie; `src/lib/vow/hold.ts`
`clearReviewerHold` turns `reviewer-hold` into the cleared label `reviewer`). The account then
completes the same card a consumer does (password, terms) and sees exactly what a consumer sees;
its reads land in `VowAccessLog` like anyone's, and it is never re-flagged as suspicious. A
published notice on the sign-in, terms and account pages (`ReviewerNotice`) tells a reviewer to
choose that answer and write to the contact address from the same email, and carries the
sentence **"Administrator credentials are never shared, with a reviewer or with anyone else."**
The contact address is `contactEmail()` (MC-047's helper, mirrored here so it resolves before
that merge); with no `CONTACT_EMAIL` set the notice names the `/privacy` page instead.

## 3. The hard throttle (Rule 8.13, items 25/26)

A ceiling above MP-006's `flagIfSuspicious` (which still refuses nothing). `enforceVowThrottle`
counts the consumer's `VowAccessLog` rows: **120 an hour and 600 a day per consumer, 300 an hour
per IP**. Over the ceiling: **429**, no trail row, and **one `VowThrottle` audit row per
consumer, limit and window** (dedup by `findFirst`), so the table cannot be flooded at the
scraper's rate. It runs on **all eight** surfaces MP-006's trail covers, after the access gate
and before the records: the five record routes answer 429; the two page surfaces (`/listings`,
`/sold`) and `VowGate` cannot 429, so they withhold the VOW facts and write the throttle row.
Never throws: a count that fails allows the read (a DB hiccup must not wall every consumer), and
a failed audit-row write still refuses. A new `VowThrottle` table holds the rows (the portal's
`ComplianceLog` is a batch-check log, not an event log, so it could not carry them).

**The battery's sign-in user reads about 3 authenticated rows per run** (`vow-fields`: one
`listing-vow` via the API, one `listings-grid`, one more `listing-vow` from the island in the
browser), far under 120 an hour.

## 4. Per-consumer export, aligned to Homesly

`/api/admin/vow-access?consumer=<email|userId>[&format=csv]` (and `scripts/export-vow-access-log.ts
--consumer`) produce one consumer's record and trail. The columns are Homesly's
`src/lib/vow/audit-report.ts` header, column-for-column, so one PropTx request gets one format
from both sites: `consumer_id, email, name, created_at, email_verified_at, disabled_at, held_at,
terms_accepted_at, terms_version, password_set_at, password_expires_at, retain_until,
password_scheme, password_held_as`, then the event rows (`at, kind, detail, ip_hash, user_agent,
session_id`). The password is reported as the **record**: `password_scheme` is "bcrypt (cost 12),
128-bit salt, 184-bit hash", `password_held_as` is "A salted one-way hash only…", and the hash
bytes never appear. The site and the shell share one pure builder (`buildConsumerReport`) so the
two CSVs cannot drift. Where the portal has no equivalent of a Homesly field, the column is
present and left blank rather than dropped (`email_verified_at`, `session_id`) and is never
fabricated; the portal stores the raw IP where Homesly stores a hash, so it rides in the
`ip_hash` column and this is noted in the file header.

## 5. Deletion anonymises, it does not cascade (from MC-044)

`VowConsent` and `VowAccessLog` cascade on a `User` delete, so a naive delete inside the 180-day
window erased the trail PropTx can demand. The erasure path (`src/lib/portal/erasure.ts`,
`scripts/vow-erasure.ts`):

- **anonymise** strips the personal data the rule does not require the Member to keep (phone,
  saved listings and searches, the lead link, the home street, the marketing-consent record) and
  blocks sign-in (`verified` false, `erasureRequestedAt` set), and **keeps** the name, email,
  username, the password record (a bcrypt hash), the consent history and the access trail, because
  Appendix B(b) requires them for 180 days past the password's expiry and PropTx can ask for them.
- **purge** hard-deletes a credentialed row only once it is past `credentialRetainUntil` (180 days
  after the password expired); the trail then cascades, which is allowed.

**A note on "strip identifiers".** The rule (R-8.06, Appendix B(b)) obliges the Member to keep the
name, email, username and current-password record for the retention window, and PropTx's R-8.08
request needs them to identify the consumer. Stripping those would breach the rule the retention
exists to satisfy, so anonymise scopes "identifiers" to the non-mandated personal data and keeps
the four the rule names until the window closes, then purges in full. This is the defensible
reading; it is flagged here for Aamir and PropTx.

`/privacy` says so plainly ("we anonymise your account… but we keep that access record for 180
days as our MLS® rules require, and remove it after") and the stale "(REBBA)" is corrected to
"(TRESA)", matching the consent text's Trust in Real Estate Services Act, 2002. The desk
instruction in `src/lib/privacy/request.ts` now carries the anonymise-not-delete exception.

## 6. MP-006's open items from MC-044

- **Query-only navigations** now wind the session clock: a Suspense-wrapped `RouteActivity` child
  in `UserProvider` keys `/api/auth/me` on `useSearchParams()` as well as the pathname, so
  browsing the `/sold` chips or `/listings` filters keeps the session alive. It is isolated in
  its own Suspense boundary so no page under the provider is forced to client-render (the three
  rules: best-in-class SEO).
- **The renewal kicker** is "Password renewal", not "One-time setup".
- **The registrant wall** uses `contactEmail()` and renders no address when it is unset.
- **Password change proving the old password, and a forgot path before day 90** remain **MP-003**,
  as MC-044 filed them. They are a distinct feature (reset tokens, a change surface, the UI) not in
  MP-007's proof scope; noted so nobody reads their absence as a gap MP-007 left. Recommended next.

## Gates

- `pnpm build` on Node 22: **exit 0**, 841 static pages, `P2024` 0. `tsc --noEmit` clean (after
  `pnpm install` brought in `@vercel/analytics`, which the `origin/main` merge added to
  `package.json` but not to this worktree's `node_modules`; no tracked file changed).
- Prebuild: `[vow-best-practices] PASS: 304`, `[portal-door] PASS: 161`, `[vow-fields] PASS: 111`.
  The 304 cover v5 (the corrected clauses, the AI sentences, the SHA), the reviewer path, the
  throttle (`overLimit`, the eight surfaces, the table), the aligned export, and the anonymising
  erasure.
- Migration `20260927120000_portal_vow_reviewer_throttle_erasure` applied (the `erasureRequestedAt`
  column and the `VowThrottle` table; the reviewer path needs no column, it uses `reviewFlag`
  values). `prisma migrate status` shows my migration recorded; the three older street migrations
  it lists as unapplied (`street_video`, `street_adjacency`, `street_generation_input_json`) are
  pre-existing ledger drift owned by other tiers, their DB effects already present, untouched here.
- **Local battery** (`next start` at `cd2eed1`, `EXPECT_SHA` matched): every check passed except
  `tiles` and `hub-page`, which flagged one sub-k 12-month figure and the hub ladder (a sub-k
  tile, and ladder rows to streets that were not 200). Diagnosed as two known local conditions,
  neither MP-007 (no street, hub, ladder, k-anon or stats code was touched): the on-disk Data
  Cache was not purged before the run (a documented local gotcha; I then purged `db2`/`db3`/
  `listings`), and the local build prerendered 690 of the 719 published streets, so the ladder's
  29 targets outside that set were 404 on `next start` (a build-timing gap a rebuild closes; ~29
  streets published since the build). **Confirmed against production: the same two checks PASS on
  719 pages** (`PASS · 2 checks · 719 pages · 392s`), clean on the exact assertions that failed
  locally, so neither is a defect. Production's full-corpus crawl carries neither, and the preview
  ISRs streets on demand, so the ladder gap cannot arise there.
- **One preview**, `npx vercel deploy --yes` after the local gate and battery:
  **`https://miltonly-pa11oubpl-gtahomequest-hubs-projects.vercel.app`** (`/api/build` says
  `commit: unknown` on a CLI deploy; matched by the URL from the deploy output, per HANDOFF).

## The proof on the preview, iPhone UA at 390 (`scratchpad/mp007/proof.mjs`, shots in `scratchpad/mp007/shots/`)

One test row (`gtahomequest+mp007a@gmail.com`), one sign-in. Every value below is the script's
output:

1. **Reviewer registration held then cleared.** The reviewer answer → `acknowledge` 200,
   `me.reviewerHeld` true, the gated route `canSee` false, DB `reviewFlag` `reviewer-hold`. The
   owner-desk shows the held reviewer; clicking Clear hold → DB `reviewFlag` `reviewer`. The
   cleared account completes the card → `canSee` true, **12 rows**. (`10-desk-held.png`,
   `11-desk-cleared.png`.)
2. **v5 rendering all clauses with the AI sentences.** The card at 390: version 5, **12 clauses**
   in order `i,ii,iii,iv,v,vi,vii,viii,ix,own-g,share,signin`, clause (ix) bold, both "for greater
   certainty" AI sentences present, the TRREB ownership present, the account-sharing clause
   present. (`20-v5-card.png`.)
3. **The throttle firing at 121.** 200 on the first 120, **429 on the 121st**, exactly **120**
   access rows logged, exactly **one** `VowThrottle` row (`consumerHour 120/120`).
4. **The export for one consumer in the aligned format.** 200; the CSV opens with Homesly's
   consumer header; `password_scheme` "bcrypt (cost 12)…", `password_expires_at` at +90 days,
   `retain_until` at +90+180; no hash bytes. Saved to `scratchpad/mp007/consumer-export.csv`.
5. **Anonymised deletion leaving the trail intact.** After anonymise: `verified` false,
   `erasureRequestedAt` set, the name and password record **kept**, the phone stripped, the trail
   **intact (120 rows before and after)**, sign-in blocked (`/me` null), and the per-consumer
   export still produces the record.

## Open items and notes

1. **The "current password" question for PropTx** stands from MP-006: Appendix B(b) says "current
   password"; we hold a bcrypt hash, never plaintext, and the export produces the password
   *record* (scheme, set date, expiry, that the consumer proved it), not the plaintext. If PropTx
   insists on plaintext, that is reversible encryption under a brokerage-held key with the
   trade-off stated, not this slice. Nothing here weakens the hash.
2. **`CONTACT_EMAIL` is unset on this worktree**, so the registrant wall and the reviewer notice
   render the contact-page fallback rather than an address. Set `CONTACT_EMAIL` on the deployment
   to light the address up (a config action, not code).
3. **At the v5 bump every row owes a re-consent** and every live session signs out, as at every
   version bump. The primary desk row was made current on v5 by the card, password untouched; the
   `+mp007a` proof row was anonymised at the end of the proof and is kept under the 180-day rule.
4. **The reviewer path is self-attestation**, like the registrant answer: a reviewer who does not
   choose the reviewer option is a consumer to this code. The hold and the owner's confirmation
   are the control.
5. **The three older street migrations** `migrate status` lists as unapplied are pre-existing
   ledger drift, not MP-007's; the audit/content tiers own them.
6. **`email_verified_at` is blank in the export** because the portal does not timestamp email
   verification (a possible follow-up); it is never fabricated.

## Addendum, 2026-09-28: re-verified against the in-repo PDF

The canonical `docs/compliance/PROPTX_VOW_Best_Practices.pdf` is present in the worktree, tracked
since MC-036 (`1cb431e`, blob `c4258bb5`, on `main` and this branch); the copy in the worktree is
byte-identical (`cmp` clean, `git status` no change), so I did not commit it (Core owns it on
`main`). It is byte-identical to the Homesly copy I originally built v5 from, so v5 was built
against the exact canonical source. Re-reading Appendix B(c) from this PDF, all nine clauses match
the shipped v5 text word-for-word (first person aside), and the four fixes are confirmed against
the document: (iv) "data or **Listing Information** provided … purchase, sale, or lease of an
individual property"; (v) "ownership of, and the **validity of PropTx's proprietary rights** and
copyright in the MLS® database, MLS® data, PropTx's MLS® System, and Listing Information"; (vi)
"**directly or indirectly** … **to another individual or entity** … 'scraping' … 'data mining'";
(viii) "PropTx, and other PropTx Members or **their duly authorized representatives**". The
additions are confirmed against their sources too: item 39 grounds the account-sharing clause,
item 35 the anonymise-and-advise erasure, items 28/30 the audit trail and monitoring. **No clause
change is needed; v5 stands as shipped at `cd2eed1`.**

Report: scratchpad/reports/MP-007-proptx-standard.md

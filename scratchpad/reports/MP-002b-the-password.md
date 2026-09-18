# MP-002b

PORTAL · D:\miltonly-portal · feat/portal

The password, under TRREB R-805(c). App code at **`98d2cd7`** (on top of `b1a0c83`, the merge of `origin/main` `e606d8b` into the branch, one `QUEUE.md` conflict resolved by keeping both notes); the docs commit on top is the branch head, named in the reply. Previewed and proven, NOT merged; Core merges by SHA.

## What was done

**The username is the email.** `User.email` is unique, lowercased and trimmed by `normalizeEmail()`, so one address is exactly one username and there is nothing separate to choose. The card and the sign-in form say so in words ("your username is your email, x@y").

**The password.** `src/lib/portal/password.ts`: twelve characters or more, at most 200, not the email address, not the part before the `@`, not containing the address; bcrypt at cost 12 (`bcryptjs` 3.0.3 added, its own types; the stub `@types` package refused). `verifyPassword` compares against a per-instance dummy hash when the row has no password, so a wrong password, an unknown address and a not-yet-set password cost the same time. Two columns, `passwordHash` and `passwordSetAt`, migration `20260918120000_portal_password`, applied through the ledger (31 migrations, clean).

**First sign-in, unchanged, then the card asks.** Link or code verifies the email as before. `VowAcknowledgementPrompt` asks `/api/auth/me` which parts are owed (`needsAcknowledgement`, `needsPassword`, from `vowStepsLeft()`) and renders name + street + VOW text + tick for the acknowledgement, and "Choose a password" + "Type it again" for the password, either or both. `/api/auth/acknowledge-vow` judges the password before it hashes or writes anything, requires it whenever the row has none, and stores the hash with the acknowledgement (or alone, for a row acknowledged before the password existed).

**Returning sign-in.** `/signin` is email → password → "Sign in", with **"Email me a link instead"** under it (first visit, forgotten password, password not yet set); the link path still ends at the card, which asks for the password before any record shows. `POST /api/auth/login`: origin check, its own Upstash buckets (`auth:login:ip` 10 per 10 min, `auth:login:email` 10 per 15 min, so a mistyped password does not spend the lead layer's tokens), one bcrypt compare, one message for every failure ("That email and password do not match. Try again, or email yourself a sign-in link."), `lastLoginAt`, the 90-day session, `redirect` honoured.

**No record without a password.** `src/lib/vow-access.ts` `canSeeVowRecords(user)` = verified AND acknowledged AND `passwordHash`. Every VOW surface calls it and nothing else: `sold-data.ts` (the fetchers), `/api/sold`, `/api/sold-stats`, `/api/streets/[slug]/sold-records`, `VowGate.tsx`, `/sold`, and `NeighbourhoodSoldBlock.tsx` (a street component, rendered nowhere in v2 today; a one-line change so the rule holds there too, flagged here for Home). The prebuild test reads all seven files for the call and for the absence of a bare `vowAcknowledgedAt` check.

**Session.** Unchanged: `SESSION_MAX_DAYS = 90`, fixed expiry, no sliding window; the login route uses the same `createSession`.

**The words.** `VOW_ACKNOWLEDGEMENT_TEXT` is **version 3**: "My username is my email address and my password is mine alone; I will not share them. Each sign-in lasts at most 90 days, after which I sign in again." Stored verbatim on every acknowledgement from now; version 2 stays on the rows that agreed to it (none in production: the two rows were reset or never acknowledged). `/terms` "Signing in and sold data" now states R-805, the username, the twelve-character password, the link as the fallback, and that no record shows until the password is set. The sign-in page copy: "Your email and your password."

**Prebuild.** `scripts/test-portal-door.ts` is at **120 assertions** (from 76): the rule (twelve pass, eleven fail, the address, the local part, a password containing the address, 201 characters), the hash (`$2…$12$`, right verifies, wrong does not, no hash never, salted), the gate table (each of the three conditions alone fails, all three pass, `vowStepsLeft` on an acknowledged row without a password), the seven surfaces on `canSeeVowRecords`, the login route (compares even with no row, rate limit and origin, one message), the card route (judges before hashing), the words (v3 names username and password, `/terms` names R-805), the form (a password step, the link instead, posts to `/api/auth/login`), the card (new-password fields, asks `/me`).

## Gates

- Local build on Node 22 at `98d2cd7`: **exit 0**, `P2024` 0, prebuild 38 tests.
- `tsc --noEmit` clean; `next lint` clean on the touched directories.
- Preview `npx vercel deploy --yes`: **`miltonly-g8swlwol7`**.

## The proof, on `miltonly-g8swlwol7`, iPhone UA, 390 × 844 (`scratchpad/mp002/probe-door.mjs`, four modes; shots in `scratchpad/mp002/shots/`, not committed)

Test row `gtahomequest@gmail.com` reset first (no acknowledgement, no password).

1. **First sign-in.** Street page → "Sign in free to unlock" → `/signin?redirect=…#sold-records` (2.8 s) → email → Continue → the password step (3.2 s) → "Email me a link instead" → code step (3.9 s). Email arrived in 12 s.
2. **The link → the card asks for everything.** Landed on `/streets/farmstead-drive-milton#sold-records` (2.4 s); "card shows 2 text fields and 2 password fields"; name, street (autocomplete "Farmstead Drive"), password twice, tick → **12 rows** at 4.7 s. `/me`: `needsAcknowledgement: false, needsPassword: false`. Row: hash `$2b$12$`, 60 chars, `passwordSetAt` set, acknowledgement text version 3.
3. **Returning sign-in by password**, fresh browser: street → gate → email → Continue → password → Sign in → landed on the street's `#sold-records` at 3.0 s, **no card, 12 rows**.
4. **Wrong password**: refused on the same page with "That email and password do not match…", still on `/signin`.
5. **Acknowledged but no password** (password nulled by script, acknowledgement kept): password login → 401 same message; link → the card shows **0 text fields and 2 password fields** ("Choose a password to finish"), password twice → 12 rows at 3.9 s.
6. With curl: login with no origin 403; unknown address 401 with the same message as a wrong password; right password 200.

## Open

- `NeighbourhoodSoldBlock.tsx` is the second street file the portal has touched (one line, the gate rule). Home should know.
- The `+mc028` test row Core made on 2026-09-18 (`gtahomequest+mc028@gmail.com`, verified, no acknowledgement, no password) is still in `User`; the next link sign-in on it meets the full card.
- A "change my password" surface does not exist yet; the link path resets nothing and the card only asks when the row has no password. MP-003 (the account) is the place: set a new password from the account page, and "forgot" = link → account → change.
- `/rentals` still sends `?next=`; the form reads both.

Report: scratchpad/reports/MP-002b-the-password.md

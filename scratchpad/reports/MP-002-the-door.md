# MP-002

PORTAL · D:\miltonly-portal · feat/portal

Slice 1, the door. App code at **`86d5f9f`** (`9961ec9` the door, `86d5f9f` the card's stylesheet); the docs commit on top is the branch head, named in the reply. Previewed and proven, NOT merged; Core merges by SHA.

## What was done

**The purge.** `scripts/purge-bot-users.ts`, dry run by default. Rule: unverified, never logged in, no acknowledgement, no watch. Dry run: 162 candidates of 162 rows, 0 kept, created 2026-05-21 to 2026-09-16. `--apply` deleted 162; rerun finds 0. The table now holds one row, Aamir's own account from the proof.

**The migration.** `20260917120000_portal_door`: five columns on `User` (`verifyTokenHash`, `verifyAttempts`, `consentText`, `consentTimestamp`, `homeStreetSlug`) and one index. Applied through the ledger with `prisma migrate deploy` (Prisma reads `.env`, not `.env.local`; `scratchpad/mp001/env.sh` exports the two URLs). `migrate status`: 30 migrations, up to date. The diff also showed pre-existing drift I did not touch (`ads.leads` defaults, a `ResidentialStreet` index); Core's.

**The guards.** `src/lib/portal/door.ts` `requestSignIn()`: the lead layer's `checkHoneypot`, `checkOrigin`, `checkRateLimit` (Upstash, 5 per IP per 10 min, 3 per email per hour), in that order, before a row or an email. Honeypot answers 200 with the success body. `/api/auth/signup` is the Prisma upsert and the Resend call around it.

**One secret, two shapes.** The email carries a link (`/signin/link?t=…&r=…`) and a 6-digit code; both expire in 15 minutes, share one attempt counter (five, then 429 "Too many tries"), and either consumes both. The code is `randomInt`, compared with `timingSafeEqual`; the link token is 24 random bytes, stored as a sha256 hash. `/signin/link` consumes the token by POST from the browser, so a mail scanner's GET cannot spend it.

**Redirect honoured.** `safeRedirect()` accepts a same-origin path only (`//`, `https://`, `/signin…`, `/api/…` fall back to `/saved`). The street island's gate link carries `redirect=/streets/<slug>#sold-records`; the form and the link both land there with a full navigation.

**The card, inline.** `/api/streets/[slug]/sold-records` now answers `needsAcknowledgement: true` for a signed-in, unacknowledged person, and `v2/SoldRecordsIsland.tsx` renders `VowAcknowledgementPrompt` in place of the sign-in gate and refetches on done. **That is the one street file this slice edits** (four lines of logic, one `id`), because the card had to appear on the page that needed it; flagged in the file's header for Home and Core. The card asks name (required), home street (registry autocomplete over `/api/autocomplete?type=street`, server-checked against `ResidentialStreet`, optional) and one tick over the VOW text and the consent sentence. The route stores the four VOW fields, `consentText` + `consentTimestamp` (`src/lib/portal/consent.ts`), `firstName`, `homeStreetSlug`. The card has its own stylesheet (`vow-card.css`) because `.street-v2 *` zeroes margins after Tailwind; the first preview showed the card flattened, the second shows it right.

**90-day ceiling.** `SESSION_MAX_DAYS = 90` in `src/lib/auth.ts`, a fixed JWT expiry, no sliding window; the prebuild test reads the source for it.

**Passwordless, noted.** `VOW_ACKNOWLEDGEMENT_TEXT` is version 2: "My email address is my username and the one-time code or link sent to it is my credential; each sign-in lasts at most 90 days, after which I confirm my email again." `/terms` gained "Signing in and sold data", which says the method stands pending the broker of record's confirmation against the TRREB VOW Policy.

**The prebuild test.** `scripts/test-portal-door.ts`, 76 assertions, in `package.json` prebuild: 100 honeypot signups send 0 emails and write 0 rows and all answer 200; 100 no-origin signups send 0 and answer 403; 100 from one IP send at most 5; 100 for one address at most 3; the judges (expiry, lock, match, shared lock on the link); `safeRedirect`; the ceiling; the words; the wiring (guard order, constant-time compare, no `Math.random`, the island renders the card, the link page POSTs).

## Gates

- Local build on Node 22: **exit 0** twice (`9961ec9`, `86d5f9f`), `P2024` 0. Prebuild 37 tests including the new one.
- `tsc --noEmit` clean; `next lint` clean on the touched directories.
- Previews from `npx vercel deploy --yes`: `miltonly-lfjcpltrv` (first, card flattened), **`miltonly-438g01i85`** (the proof). `/api/build` reports `commit: unknown` on a CLI deploy.

## The proof, on `miltonly-438g01i85`, iPhone UA, 390 × 844 (`scratchpad/mp002/probe-door.mjs`, shots in `scratchpad/mp002/shots/`, not committed)

1. `/streets/farmstead-drive-milton` (12 sales in 90 days), tap "Sign in free to unlock →" → `/signin?redirect=%2Fstreets%2Ffarmstead-drive-milton%23sold-records&intent=sold&street=…` in 3.4 s.
2. Type `gtahomequest@gmail.com`, submit → code step in 0.6 s: "Sent to … Check your email. Tap the link, or type the code. It works for 15 minutes."
3. The email (from `aamir@mail.miltonly.com`, subject "584132 is your Miltonly sign-in code") arrived within 13 s carrying the preview's own link and the code; read through the Gmail connector.
4. Tap the link → `/streets/farmstead-drive-milton#sold-records` in 2.1 s, the card inline under "Recent closed sales, Farmstead Drive".
5. Type "Aamir", type "Farmstead" → autocomplete's first hit "Farmstead Drive" in 0.9 s; pick it, tick, "Agree and see sold prices" → **12 rows** in 1.0 s, first `2026-09-04 · 610 Farmstead Drive 524 · 1 · $463K · 94% · 84d · Royal LePage Real Estate Associates`, no `s-gated` class, `/api/auth/me` returns the user. Link tap to records: **4.0 s**.
6. The row afterwards: `verified`, `lastLoginAt`, `homeStreetSlug: farmstead-drive-milton`, `vowAcknowledgedAt`, IP, UA, `consentText` verbatim, `consentTimestamp`, secret cleared, attempts 0.

Also on the preview with curl: no origin 403; `Origin: evil.example` 403; honeypot 200 with the success body and no row (count stayed 1); five wrong codes 400 then the sixth and seventh **429 "Too many tries"** with `verifyAttempts: 5`; a fresh request reset it to 0; the superseded code failed; the used link failed on reuse. Every guard was exercised against the running deployment, not only in the test.

## Open

- **The broker of record's ruling** on passwordless (MP-001 part 2). If "a password", it is added to the same account; the text goes to version 3.
- The sold table on the street page clips at 390 (pre-existing island layout, Home's).
- `/rentals` still sends `?next=`; the form reads both.
- `sendDealAlertEmail` still has no unsubscribe (MP-003).
- The test account `gtahomequest@gmail.com` is the one `User` row, acknowledged; leave or delete as Aamir prefers.

Report: scratchpad/reports/MP-002-the-door.md

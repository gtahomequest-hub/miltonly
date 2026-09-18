# MP-001

PORTAL · D:\miltonly-portal · feat/portal (at `10de234`, fast-forwarded to `origin/main` before this commit)

Gate A recon for the subscriber portal. No code. Four parts: what exists, compliance, the portal in one page, the build order. Every count below was read from the shared database on 2026-09-17 with `scratchpad/mp001/counts*.mjs`.

## 1. What exists

### The sign-in and session

| Piece | File | State |
|---|---|---|
| Sign-in page | `src/app/signin/page.tsx`, `SignInForm.tsx` | Two steps: name + email, then a 6-digit code. No password. `noindex`. Lands on `/saved` after verify, always. |
| Signup / code send | `src/app/api/auth/signup/route.ts` | Upserts `User`, writes a 15-minute code, sends it through Resend. **No honeypot, no rate limit, no origin check.** |
| Verify | `src/app/api/auth/verify/route.ts` | Compares the code, sets `verified`, `lastLoginAt`, creates the session. **No attempt limit** on a 6-digit code in a 15-minute window. |
| Session | `src/lib/auth.ts` | HS256 JWT in `miltonly_session`, httpOnly, 30 days. `getSession()` reads `User` on every call and returns null unless `verified`. `JWT_SECRET` is set on Production; local falls back to a dev string. |
| Me / logout / save-listing / saved-listings / saved-searches | `src/app/api/auth/*` | Thin CRUD over `User.savedListings[]` and `SavedSearch`. Nothing else reads them. |
| VOW acknowledgement | `src/app/api/auth/acknowledge-vow/route.ts`, `src/lib/vow-acknowledgement.ts`, `src/components/vow/VowAcknowledgementPrompt.tsx` | Records timestamp, literal text, IP, user agent on `User`. Idempotent, first acknowledgement wins. The prompt renders on `/sold` and inside `VowGate`. |
| VOW gate | `src/components/vow/VowGate.tsx` (server), `src/lib/sold-data.ts` `canServeRecordsToThisRequest()`, `/api/sold`, `/api/sold-stats`, `/api/streets/[slug]/sold-records` | Three states: anonymous teaser, signed in without acknowledgement, signed in and acknowledged. Every record fetcher checks session and acknowledgement before any DB or Redis touch. 100-record cap, 90-day default window (`days` is a parameter). |
| Client user state | `src/components/UserProvider.tsx` (mounted in `src/app/layout.tsx`) | `user`, `saveListing`, `unsaveListing`, `isListingSaved`. The nav does not read it: **nothing in the chrome changes when signed in.** |

### Tables (all `public` schema, DB1)

- `User` (id, email unique, firstName, phone, verifyCode, verifyExpiry, verified, savedListings[], leadId, lastLoginAt, the four `vowAcknowledgement*` fields). `leadId` is written nowhere.
- `SavedSearch` (userId or email, leadId, kind `listing|street|hub|price-band|brief`, env, criteria, alertEnabled, alertFrequency, lastAlertAt, lastMatchCount). Two writers: `/api/auth/saved-searches` (userId) and `src/lib/lead/savedSearch.ts` `createWatchForLead` (email). Two readers: `/api/alerts/match` (cron `0 14 * * *`, every kind but brief, mails `sendDealAlertEmail`) and `/api/brief/send` (cron `15 13 * * 1-5`, kind brief, signed one-click unsubscribe, `List-Unsubscribe` headers).
- `Lead` (79 production rows, 30 preview). `consentText`, `consentTimestamp`, `yourHomeAddress`, `street`, `mlsNumber`, `source`, `env`, MOD-58 admin columns. Written only by `src/lib/lead/ingest.ts` behind `/api/leads/create`.
- `LeadActivity`, `VisitorProfile` (cookie-keyed browsing profile, not tied to `User`), `ComplianceLog` (nightly booleans, `consentCheck` among them).

### What the numbers say

- **162 `User` rows, 0 verified, 0 acknowledged, 0 with a saved listing, no `lastLoginAt` ever.** Nobody has completed the sign-in since it shipped.
- Every one of the 162 emails matches the dotted-Gmail-alias pattern (`d.e.bor.ah..k...nic.o.d.e.m.u.s@gmail.com`), 36 in May, 46 in July, 80 in September. The same addresses posted 64 `sale-detail` leads between 2026-09-11 and 09-16, one UA string, one lead per IP, gibberish names, each within 30 seconds of the `User` row. A bot walks `/signin` and the listing-detail form together. **Each `/signin` hit sent a Resend verification email to a throwaway address**: the signup route is a spam amplifier and a sender-reputation risk today.
- `SavedSearch`: 9 rows, all `env=preview`, none with a `userId`. Production watches 0 (matches `HANDOFF-leads.md`).
- 0 of 79 production leads carry `consentText`. The lead path stores it when a surface sends it; no mounted surface does.

### Every page that changes when signed in

| Surface | Signed-in behaviour |
|---|---|
| `/saved` | The only account page. Two tabs, saved listings and search alerts, a manual "new search" form, sign out. Reads DB1 listings only. **Shows nothing a visitor cannot see elsewhere.** |
| `/sold` | Acknowledged: 90-day records table with filters. Signed in, not acknowledged: the acknowledgement prompt. Anonymous: hero totals and a gate. |
| Street page `#sold` | `v2/SoldRecordsIsland.tsx` fetches `/api/streets/[slug]/sold-records`. Acknowledged: up to 20 sales, 90 days, address, price, vs ask, DOM, brokerage. **Anyone else, including a signed-in user who has not acknowledged, sees "Sign in free to unlock", which sends them to `/signin`, which lands on `/saved`.** The acknowledgement prompt is unreachable from a street page: `NeighbourhoodSoldBlock` (the only `VowGate` caller besides `/sold`) is rendered nowhere in v2. |
| Listing detail, `/listings`, listings v2, `/rentals` | The heart. Anonymous tap redirects to `/signin?redirect=…` (`/rentals` uses `?next=`, which nothing reads). |
| `SaveSearchStrip` on `/listings` | Signed in: POST a `SavedSearch` with kind `listing`. |
| `/signin` | Ignores `redirect`, `intent`, `street`, `neighbourhood`. Six surfaces build those params (`VowGate`, both sold islands, `SoldOnMyStreet`, `MlsExplore`, `LockedStat`). |

### Gaps, in one list

1. Sign-in never returns the person to where they were, and never shows the acknowledgement on the page that needed it.
2. A signed-in, unacknowledged user is told to sign in again on every street page.
3. Signup has no bot defence and emails on every hit; verify has no attempt limit.
4. `User` knows no street and no address. `SavedSearch` (email-keyed) and `Lead` (`yourHomeAddress`, `street`) know them, and neither links to `User` except by email string.
5. `sendDealAlertEmail` (the street, hub and price-band alerts) has no unsubscribe link and no sender mailing address. The street alert card promises "listed or sold" and the cron matches new listings only.
6. No audit trail of which consumer viewed which VOW records.
7. `/saved` is the destination and it is empty for a new subscriber.
8. Nothing in the nav says you are signed in.

## 2. Compliance

Sources read for this section: the PropTx VOW Datafeed Agreement (`webapp.proptx.ca/.../TREB_VOW_Datafeed_Agreement_Sept_2014.pdf`, text extracted to `scratchpad/mp001/vow-agreement.txt`, kept out of git; the four count scripts beside it are committed), the TRREB VOW Policy as reported at `realestatemagazine.ca/treb-releases-proposed-vow-policy/`, PIPEDA and CASL as I know them. The TRREB policy wording below is quoted from the second source, not from the policy PDF itself, which I could not fetch; verify the exact clause numbers against the brokerage's copy before Gate B.

### TRREB VOW, for a registered consumer

| Requirement | Site today | Portal must add |
|---|---|---|
| Consumer provides name and a valid email; access only after the Member verifies the email and the consumer has agreed to Terms of Use. | Email verified by code. Name optional. Terms of Use: the acknowledgement text is shown after sign-in, on `/sold` only, and agreement is recorded with text, time, IP, UA. | Make the acknowledgement part of the first sign-in, before any VOW record, on whichever page started it. Require the name. |
| "The Consumer must supply a username and a password, the combination of which must be different from those of all other Consumers"; passwords valid up to 90 days, then renewed or reconfirmed. The datafeed agreement defines a VOW as a "secure password-protected internet website". | Email is the unique username; the credential is a one-time code; the session is 30 days. | **This is the one policy question the passwordless design must answer, and it is a decision for Aamir and the broker of record, not for the build.** My reading: the consumer-selected credential the policy wants is a unique, private, expiring secret; a one-time emailed code or link is that, held in the consumer's inbox, and the 30-day session with a fresh link at expiry reconfirms it inside the 90-day limit. Zolo and HouseSigma both take passwords; neither is the authority. Write the interpretation into the VOW terms, cap the session at 90 days as a hard ceiling, and put the question to the brokerage's VOW contact with the Schedule B form when the portal URL is registered. If the answer is "a password", slice 1 adds an optional password to the same account and nothing else changes. |
| Records: name, email, username, password kept not less than 180 days after the password expires. | `User` rows are never deleted. | A retention rule: no hard delete of a `User` inside 180 days of session expiry; a PIPEDA deletion request anonymises after that window. Document it in the privacy page. |
| Audit trail of consumer activity on the VOW, available to TREB on request (Agreement 5.4). | None. | A `VowAccessLog` row per gated read: userId, path, scope (street, hub, city), record count, at, IP. Read-only admin view. |
| Prominent bona fide notice on every VOW page (6.3(k)). | The acknowledgement text carries it; the `/sold` footer says "must only be used by consumers…"; the street island says "TREB VOW · Registered access". | The notice on every portal page that shows a record, in one component. |
| 100 listings per inquiry (6.3(b)). | `MAX_CONSUMER_RECORDS = 100`. | Keep; the portal reads through the same fetchers. |
| Listing brokerage displayed with each listing, same font and size (6.3(c)). | Sold tables carry `list_office_name`. | Keep on every portal record row, including the "latest sale on your street" card. |
| Data refreshed at least every 24 hours (6.3(h)); "deemed reliable but not guaranteed" notice (6.3(i)); no claim of full MLS access (6.3(j)). | The sold sync is nightly; the notice is in the footer copy. | Repeat the notice on the portal. |
| Data for consumers with a bona fide interest only, no commercial use (Purpose, 6.3(k)). | In the acknowledgement text. | Add to the account terms; add a "not a licensee" question or the existing `isAgent` flag to the profile. |
| URL pre-approved by the Broker of Record (6.3(g), Schedule B / F). | `miltonly.com` presumably registered. | `/account` is a feature of the same URL; confirm no new form is needed. |

The 90-day sold window in `sold-data.ts` is a default, not a rule I found in either document. The portal can read 12 months for the subscriber's own street through the same fetcher, still under the 100 cap.

### PIPEDA

| Requirement | Site today | Portal must add |
|---|---|---|
| Meaningful consent, purposes stated at collection. | `/privacy` names PIPEDA, lists purposes, cookie banner. Lead surfaces carry fine print; `consentText` is stored when sent (never sent today). | One consent sentence on the sign-in form, stored on `User` (text, time) the way `Lead` stores it. |
| Access and correction. | `/privacy` promises it; no mechanism. | The account page IS the mechanism: show every field held, let the person edit name, phone, street, and download their data (a JSON export is enough). |
| Withdrawal of consent. | Brief: one-click. Alerts: none. Account: none. | Per-watch toggles and a "delete my account" that honours the 180-day VOW retention by anonymising the email and clearing everything else. |
| Retention limits. | `/privacy` says "as long as reasonably necessary". | State the 180-day VOW rule and the alert retention in the policy. |
| Safeguards. | JWT httpOnly, server-only fetchers. | Rate limit and honeypot on signup, attempt limit on verify, constant-time compare. |

### CASL, for the emails the portal triggers

| Message | Consent basis | Identification (name, mailing address, contact) | Unsubscribe |
|---|---|---|---|
| Verification code | Not a CEM (no commercial content). | Sender name only, no mailing address. | Not required. |
| Lead confirmation (`notify.ts`) | Response to an inquiry (implied, 6 months) or exempt as a reply. | Name and brokerage, **no mailing address**. | None. Add the brokerage address; an unsubscribe is cheap and removes the argument. |
| Daily brief (`brief/compose.ts`) | Express, fine print stored as `consentText` on the lead. | Name and brokerage, **no mailing address**. | Signed one-click, `List-Unsubscribe`, `List-Unsubscribe-Post`. Good. |
| Deal alerts (`email-user.ts` `sendDealAlertEmail`) | Express at the alert card; text not stored. | Name only, **no mailing address**. | **None.** Not compliant the day the first production watch matches. |
| Portal emails to come (welcome, sign-in link, "your street changed") | Sign-in link is transactional. Anything recurring needs the express consent recorded at sign-in. | Add the brokerage mailing address to one shared footer. | Every recurring message signed one-click, reusing `brief/unsubscribe.ts` generalised to any watch kind. |

Records of consent must be kept for as long as the consent is relied on: `consentText` and `consentTimestamp` exist on `Lead`; the portal puts the same two on `User`.

## 3. The portal, in one page

**Sign-in.** One field: email. Submit sends a link (and the same 6-digit code under it, for the phone-to-laptop case). The link opens the page you were on, signed in, with the acknowledgement card inline the first time and never again. Name is asked once, on the acknowledgement card, because the policy wants it, not on the sign-in form. Ten seconds: type, tap, tap the link. No password, ever, unless the brokerage rules otherwise (part 2). A homeowner trusts it because the email says who Aamir is, what brokerage, that the link expires in 15 minutes, and that nothing is sent unless they asked.

**First screen, `/account`.** The header names the subscriber's street and shows one thing a visitor cannot: the latest closed sale on that street, address, sold price, sold-to-ask, date, listing brokerage, from the VOW read the acknowledgement just unlocked, at up to 12 months (a visitor sees the typical price at k5 and a count; the record itself is gated). The street comes from, in order: the `street` on the sign-in link (a street page started it), the person's own answer on the acknowledgement card ("Which street do you live on?", autocomplete over the registry), or a `Lead`/`SavedSearch` row on the same email. Streets with no sale in 12 months say so, in a sentence, and show the hub's latest sale instead. This is the whole reason to sign in, and it is the first thing on the page.

Then five blocks, each one a query the site already answers:

1. **My streets.** The home street plus any street watched. Per street: count of sales 12 months, typical price at k5, a link to the page, the latest sale row. "Watch another street" is the registry autocomplete.
2. **My watches.** Every `SavedSearch` on this userId or email, by kind, with an on/off toggle each (a paused watch keeps its row, `alertEnabled=false`, which is what the unsubscribe route already does). The "listed or sold" promise on the street card gets honoured here: a street watch sends both, with sold records only to acknowledged subscribers.
3. **My brief.** The daily brief as a watch with a street attached, so the personal line in the edition names their street. On, off, which street.
4. **My valuation requests.** Every `Lead` on this email with a valuation source (`sell-page`, `sold-home-valuation`, `doorhanger-valuation`, `homepage-valuation`, `sales-ads-home-valuation`): date, address, status from `leadStatus` in plain words ("Aamir has it", "Contacted", "Booked"). One button: "Ask Aamir what it is worth now", which posts a `sell-page` lead prefilled with the home street.
5. **Sold records I can see.** The `/sold` table scoped to my streets and my hub, 100 rows, with the VOW notice and the brokerage on every row.

Footer of the page: what we hold about you, edit it, download it, delete the account (with the 180-day sentence), the VOW notice, the brokerage mailing address.

**What a subscriber gets that a visitor does not.** Individual sold records on any Milton street (VOW), the 12-month window instead of 90 days on their own streets, sold alerts as well as listing alerts, a brief that names their street, the status of their own valuation request, and one place to switch every email off. A visitor keeps everything on the public pages: typical prices, counts, ranges at k10, the brief signup, every form.

**How it feeds leads back to Aamir.** Three paths, all through the one lead route, none new:
- Every sign-in from a street page writes the street to `User` and, with express consent, a `street` watch; the weekly leads digest (`/api/digest/leads`) gets a "new subscribers by street" section.
- A subscriber who watches two or more streets, or opens their own street's sold records three times in 30 days (the `VowAccessLog` says so), is a seller signal: the digest lists them, and the account page shows them the valuation button first.
- "Ask Aamir what it is worth now" is a `sell-page` lead with `yourHomeAddress` prefilled and `leadId` linked to the `User`, so the desk alert reads "subscriber since <date>, watches <streets>, viewed sold records N times".

**Benchmark.** Zolo: password or social sign-in, saved homes and searches, alerts, a home value estimate, sold history behind the wall. HouseSigma: account with a watchlist of properties and communities, alerts for new, sold, terminated and price changes, an AI estimate, sold history behind an email sign-up, restrictions for non-bona-fide users. Rightmove: My Rightmove, saved properties and searches, instant alerts, sold prices public in England so no wall. Ours does four things none of them do: the account opens on a fact about your own street rather than a search box; the street, not the listing, is the unit you watch; a valuation request has a visible status and a named person behind it; and the compliance record (acknowledgement, consent, access log, retention) is shown to the subscriber, not hidden from them.

## 4. Build order, three slices

**Slice 1: the door (MP-002).** Magic link plus code, `redirect` honoured, the acknowledgement inline on the page that started it, name and street asked there, consent sentence stored on `User`. Honeypot, rate limit and origin check on signup (reuse `src/lib/lead/guards.ts`), five attempts per code on verify, constant-time compare. Purge the 162 bot rows (all unverified, none with a session) and add a prebuild test for the signup guards. `/signin` keeps its URL. Done when a street page's "Sign in free to unlock" returns the person to that street's sold records, acknowledged, in under ten seconds on a phone, and a bot run of 100 signups sends zero emails.

**Slice 2: the account (MP-003).** `/account` replaces `/saved` (301). The first-screen card, my streets, my watches with toggles, my brief, sold records I can see. `User.homeStreetSlug`, `User.consentText`, `User.consentTimestamp`, and the `VowAccessLog` table: one migration, Core applies it. Nav shows the signed-in state (one word in the bar; Home owns the nav files, so this is a request to Home, not an edit here). The CASL fixes that the portal's own emails need: shared footer with the mailing address, `sendDealAlertEmail` gets the signed unsubscribe. Done when a new subscriber's first screen names their street and its latest sale, every watch can be switched off from the page, and every email the portal sends carries the address and an unsubscribe.

**Slice 3: the loop back (MP-004).** My valuation requests with `leadStatus` in words, "Ask Aamir" prefilled and linked to the `User`, `User.leadId` written on the first lead from a signed-in session, sold alerts on street watches (acknowledged subscribers only), the digest's subscriber section, the seller signal, the data export and account deletion with the 180-day rule, the privacy page sentences. Done when a subscriber's valuation request shows on their page within a minute of posting, and the Monday digest lists the week's new subscribers by street.

Left out of all three, deliberately: a home value estimate (the site says "typical", never a number for one house, and the VOW terms say no individual figure to a visitor), social sign-in (nothing to add over the link), and a mobile app.

## Stop

No code written. `HANDOFF-portal.md` created. `QUEUE.md` carries a one-line note. `HANDOFF.md` is Core's and is untouched. Two things outside the portal's remit that Core and Leads should hear: the bot on `/signin` and the listing-detail form (part 1), and the deal-alert email with no unsubscribe (part 2), which lands the day the first production watch matches.

Report: scratchpad/reports/MP-001-portal-recon.md

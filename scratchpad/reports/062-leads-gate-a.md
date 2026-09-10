LEADS · D:\miltonly-leads · feat/leads

# 062 — Lead layer, Gate A recon

_2026-09-10. No code written. Read-only pass over every lead surface in the app._

Method: grep + line ranges only. Nothing verified against production — this worktree has no
Vercel credentials (`npx vercel env ls` opened a device-login flow and was abandoned), so every
statement about a **production** env value below is marked unverified. Local `.env.local` values
are quoted where they matter.

---

## 1. Inventory — every lead entry point today

There are **four live ingress routes**, **two lead tables**, and **one route that does not exist**.

### The routes

| Route | Table | Guards | Side effects on success | Response |
|---|---|---|---|---|
| `POST /api/leads` (1,201 lines, 4 branches) | `public.Lead` (`prisma.lead`) | honeypot (`HONEYPOT_FIELD`, default `company_website`), per-IP rate limit (`hit()`), per-branch field validation | `notifyNewLead` (Resend → `REALTOR_EMAIL`) + `notifyAamirBySMS` (Twilio) + `sendKvcoreParserEmail` (BoldTrail) + submitter auto-reply, all fire-and-forget with retry | `{success,id}`, plus `redirect` on two branches |
| `POST /api/leads/create` (282 lines) | `ads.leads` (`prisma.adsLead`) | `LEADS_API_ENABLED` flag only. **No honeypot, no rate limit, no consent capture** | Meta CAPI `Lead` event + generic confirmation email to the lead + ops alert email to `ALERT_EMAIL_TO`. **No CRM, no SMS, no GA4** | `{ok,lead_id}` |
| `POST /api/off-market-leads` (73 lines) | `public.Lead` | field + 10-digit phone check | `notifyNewLead` + SMS. **No CRM, no lead-facing email** (writes `email: ""`) | `{ok,id}` |
| `POST /api/exclusive-inquiry` (96 lines) | `public.Lead` | name + phone required | one hand-rolled Resend email to `REALTOR_EMAIL` + SMS. **No CRM, no lead-facing email** | `{ok}` |
| `POST /api/alerts/subscribe` | — | — | — | **route does not exist** |

`/api/leads`'s four branches: `intent=market-pulse-unlock|home-valuation` (CASL consent required and
snapshotted, hot/warm scoring, market-pulse returns its k-gated stats packet inline);
`intent=buyer` (timeline + pre-approval required, redirects to `/sales/thank-you?lid=`);
`source` starting `ads-rentals-lp` (renter mapping, cheat-sheet email, redirects to
`/rentals/thank-you?lid=`); and a catch-all that accepts almost anything and returns
`{success,id}` with **no redirect and no thank-you page**.

### The surfaces

**To `/api/leads` → `public.Lead`.** Confirmation is an in-place card state unless noted.

| # | Surface | `source` / `intent` | What the visitor sees | Signals fired |
|---|---|---|---|---|
| 1 | `landing/HomeValuationCard.tsx` — the /sell hero card, also `/value/[neighbourhood]` and the ads pages | `sell-page`, `doorhanger-valuation`, `sales-ads-home-valuation` / `home-valuation` | "Your request is in… written report within 24 business hours" | GA4 `generate_lead` (value 7500) |
| 2 | `landing/MarketPulseUnlockCard.tsx` | `sales-ads-market-pulse-unlock` / `market-pulse-unlock` | inline k-gated stats reveal | GA4 |
| 3 | `landing/LeadCaptureForm.tsx` | caller-supplied / `buyer` or `renter` | `router.push` → `/sales/thank-you` or `/rentals/thank-you` | GA4 + Meta Pixel, **and a dual-write to `/api/leads/create`** (PH3-DUALWRITE, 2 s abort) |
| 4 | `landing/AamirTrustCard.tsx` | `sales-ads-trust-card-message` / `buyer` | modal success state | GA4 |
| 5 | `listings/[mlsNumber]/ListingDetailClient.tsx` | `sale-detail` / `buyer` | in-place | GA4 with hashed `user_data` |
| 6 | `listings/[mlsNumber]/ListingExtras.tsx` (two forms) | `seller-listing-page`, `landlord-listing-page`, plus a renter form | in-place | GA4 |
| 7 | `listings/ListingsCardsClient.tsx` | `listing-card-book` / `buyer` | in-place | — |
| 8 | `rentals/ads/UnlockModal.tsx` | `ads-rentals-lp-modal` / `renter` | `/rentals/thank-you?lid=` | GA4 `form_submit` |
| 9 | `rentals/RentalsClient.tsx` (six sources) | `rental-quiz`, `new-match-alert`, `1hr-booking`, `listing-card-book`, `listing-card-1hr`, `alert` | in-place | — |
| 10 | `places/PlaceAlertForm.tsx` | `mosque-alert`, `school-alert` | "we'll email you when new listings appear near your preferred area" | — |
| 11 | `sections/PreFooterCTA.tsx` | `homepage-newsletter` | in-place | — |
| 12 | `sections/SoldOnMyStreet.tsx` | `homepage-sold-on-my-street` / `seller` | in-place | — |
| 13 | `sections/PersonaRouter.tsx` (three) | `homepage-persona-{first-time-buyer,newcomer,move-up}` | in-place | — |
| 14 | `street/CornerWidget.tsx` | native `<form method="POST" action="/api/leads">`, no JS handler | **broken** — see gap G1 | — |

**To `/api/leads/create` → `ads.leads`.**

| # | Surface | `source` / `intent` | What the visitor sees | Signals fired |
|---|---|---|---|---|
| 15 | `street/v2/StreetAlertCTA.tsx`, id `#street-alert`, on **every** published street page (both `StreetPage` and `StreetMinimalPage`) | `street-alert` / `buyer` | "Done, you're on the list. We'll email you the moment a home on X is listed or sold." | Meta CAPI server-side only |
| 16 | `condo/CondoCTAs.tsx` | `condo-building-alert`, `condo-building-contact` / `buyer` | in-panel | CAPI only |
| 17 | `sold/SoldValuationCTA.tsx` | `sold-home-valuation` / `sell` | in-place | CAPI only |

**Other.**

| # | Surface | Route | Notes |
|---|---|---|---|
| 18 | `sections/OffMarketForm.tsx` | `/api/off-market-leads` | `homepage-exclusive`; phone only, no email captured |
| 19 | `exclusive/[slug]/InquiryForm.tsx` | `/api/exclusive-inquiry` | "Aamir will reach out within 15 minutes during business hours" |
| 20 | `street/ExitIntent.tsx` | `/api/alerts/subscribe` | native POST to a route that **does not exist** — see G1 |
| 21 | `signin/SignInForm.tsx` | `/api/auth/signup` | creates a `User` + 6-digit code. **Writes no `Lead` row at all.** `User.leadId` exists and is never populated. Feeds `SavedSearch`, the only recurring-alert machinery in the app |

**The two ladder CTAs (QUEUE item 3's own card).** Both work as links.

| # | Surface | Target |
|---|---|---|
| 22 | `AddressLadder.tsx:256` | `/sell?street=<resolved street name>#valuation`. `/sell` has `id="valuation"` at `page.tsx:64`; `HomeValuationCard:90` reads `?street=` once as the address field's initial value. The resolved name travels, nothing else |
| 23 | `AddressLadder.tsx:266` | `#street-alert` → surface 15, same page, present on both shells |

**Emails that exist.** `notifyNewLead` (realtor, `REALTOR_EMAIL`), `notifyAamirBySMS` (Twilio),
`sendKvcoreParserEmail` (BoldTrail parser inbox), four submitter auto-reply variants in
`/api/leads` (renter / sales / market-pulse / home-valuation, all behind `ENABLE_AUTO_REPLY`), one
generic confirmation in `/api/leads/create`, `sendVerificationEmail` and `sendDealAlertEmail` in
`email-user.ts`.

**CRM handoff.** One mechanism only: `src/lib/notifications/kvcore.ts` emails the BoldTrail parser
inbox at `KVCORE_LEAD_PARSE_EMAIL`. That variable is **absent from `.env.local`** and the file
documents "empty → silent no-op". Called from three of `/api/leads`'s four branches. Never called
from `/api/leads/create`, `/api/off-market-leads`, or `/api/exclusive-inquiry`.

---

## 2. Gaps

**G1 — Two forms are broken, both on street pages.**
`ExitIntent.tsx:87` posts natively to `/api/alerts/subscribe`; `src/app/api/alerts/` contains only
`match`. The visitor's browser navigates to a 404. `CornerWidget.tsx:111` posts natively to
`/api/leads`, which calls `request.json()` — a form-encoded body throws, the route returns 500
`{"error":"Failed to create lead"}`, and the browser renders that JSON. Both capture nothing, and
both are the same no-dead-buttons class the street alert CTA was written to close.

**G2 — Every alert promise in the app is unkept.** Five surfaces promise recurring email
(`street-alert`, `condo-building-alert`, `PlaceAlertForm`, `homepage-newsletter`,
`new-match-alert`/`alert`). Nothing reads those rows. The only alert sender is
`/api/alerts/match`, it reads `SavedSearch` (account-holders only, which no lead surface creates),
**and it has no entry in `vercel.json`** — thirteen crons are registered and that is not one of
them. So the sole alert job has never run on a schedule either. "We'll email you the moment a home
on X is listed or sold" is currently false on 445 street pages.

**G3 — `ads.leads` is write-only, and may notify nobody.** The three street/condo/sold surfaces
write to `ads.leads`, whose only side effects are Meta CAPI, a confirmation to the lead, and an ops
alert **gated on `ALERT_EMAIL_TO`**, which is `""` in `.env.local` (production unverified). No
`notifyNewLead`, no SMS, no BoldTrail. Nothing in `src/` reads `prisma.adsLead` — only
`scripts/verify-ads-leads.ts` and `scripts/verify-leads-pipeline.ts`. If `ALERT_EMAIL_TO` is unset
in production, a `#street-alert` signup produces a DB row nobody is told about and nobody looks at.
**Check this first; it is the cheapest possible fix and the largest current loss.**

**G4 — Two lead models with no relation.** `public.Lead` (85 columns, consent fields, scoring,
`LeadActivity` log, 7 admin indexes) and `ads.leads` (21 columns, no consent, no score, no
activity). A single visitor who uses the street alert and then the /sell form becomes two rows in
two schemas with no join key. `LeadCaptureForm` deliberately writes both. The `Lead` model's
`savedListings`/`comparisonsMade` and the `User` table are a third and fourth identity for the same
person.

**G5 — No lead dashboard.** `Lead` carries `leadStatus`, `qualificationReason`, `isQualified`,
`leadTemperatureAtSubmit` and seven composite indexes labelled "(MOD-58) Lead admin UI" — and
`src/app/admin/` contains `exclusive`, `review`, `seo` and nothing else. The admin UI those columns
were indexed for does not exist. Aamir's only view of a lead is the notification email or SMS.

**G6 — Confirmation states that lie.** `PlaceAlertForm.tsx:42` and `RentalsClient.tsx:182` set the
success state without checking `res.ok`; a 400 or 500 renders "You're in". `/api/leads/create`'s
confirmation email says "Thanks for getting in touch — I'll personally review your request and
reply within the hour" to someone who ticked a street-alert box and expects nothing but listings.
`/api/leads`'s catch-all branch returns no `redirect`, so ten of the surfaces above have no
thank-you page and no shareable confirmation URL.

**G7 — No consent record on the newer path.** `/api/leads` requires and snapshots CASL consent text
+ timestamp for the two lead-magnet intents; `ads.leads` has no consent column and
`/api/leads/create` asks for none, so `street-alert`, `condo-building-alert` and
`sold-home-valuation` create an email-marketing relationship with no audit trail. Same defect class
as the VOW acknowledgement fields on `User`, which were added precisely because a timestamp alone
is not provable.

**G8 — No street prefill except on the ladder.** `?street=` is read in exactly one place
(`HomeValuationCard:90`) and written in exactly one (`AddressLadder:256`). The `/sell` page's own
hero CTA (`page.tsx:154` → `#valuation`) carries nothing. `SoldValuationCTA`, `SoldOnMyStreet`,
`PreFooterCTA` and `PersonaRouter` capture no street. `Lead.street` exists; the street surfaces
write the street into `property_address` and `notes` on the other table instead.

**G9 — Leads per page is not readable by anything.** `ads.leads.meta` does carry
`event_source_url` (the street CTA sends `window.location.href`) and `referer`, so a per-page count
is *derivable* — but it is a JSONB blob with no index, there is no reader, and nothing exposes it.
On the `Lead` side, `landingPage`/`referrer`/`firstPage` are populated only by
`attributionPayload()`, which the street, condo and sold CTAs never call. There is no page-view
denominator anywhere either, so even a correct count could not become a conversion rate. The
9-check production battery (`scripts/verify/run.mjs`) contains no lead check of any kind.

**G10 — No valuation figure in the valuation flow.** `/sell` asks for an address and offers nothing
back. The k-gated street typical already exists and is already served unauthenticated on street
pages — `buildStreetEnrichment` → `graduate()` → `PriceBasis{typical,count,window}` +
`windowDisclosure()`, floor `K_TYPICAL`, 12-month window preferred and a ~2-year fallback, `null`
when sub-k. `/value/[neighbourhood]` already does the neighbourhood-grain version of exactly this
sentence. The street-grain version is unbuilt, and `ValueLanding.tsx:9` says so in a comment.

**G11 — No daily brief exists.** Zero matches for `daily.brief` in `src/`. The nearest thing is
`PreFooterCTA`'s `homepage-newsletter` source, which is a `Lead` row and nothing else.

---

## 3. Proposal — the lead layer

**One lead model.** `public.Lead` is the survivor: it has the consent columns, the scoring, the
activity log and the indexes. `ads.leads` becomes a projection, not a peer — keep writing it for as
long as Meta CAPI attribution needs its shape, but write it *from* the one path, carrying
`Lead.id` in `meta.leadId` so the two are finally joinable. Add nothing to `Lead` that can be
derived: street belongs in the existing `Lead.street`, page in the existing `landingPage`, and the
consent columns already exist. One new column only if measurement proves derivation insufficient,
and not before.

**One submission path.** A single `submitLead()` client helper and a single server function behind
the existing `POST /api/leads`. Every surface calls it with `{ source, intent, contact, street?,
page, consent? }`. It always: writes one `Lead`, always applies the honeypot and the IP rate limit
(which `/api/leads/create` has never had), always captures the consent text when the surface
promises email, always fires the realtor notification **and** the SMS **and** the BoldTrail parser
email, always projects to `ads.leads` + CAPI + Pixel + GA4 with one shared `event_id`, and always
returns `{ id, redirect }`. `/api/leads/create` stays mounted as a thin adapter so the FB webhook
and the dual-write keep working, then is retired. The four fan-out branches inside the current
route collapse into per-intent validators; nothing about the ads or rentals contracts changes.

**Confirmation emails.** Three templates, chosen by what the surface promised rather than by which
route was hit: *valuation* ("a written report within 24 business hours" — the promise /sell already
makes), *alert* ("we will email you when a home on X is listed or sold, and nothing else"), and
*inquiry* ("Aamir replies within the hour during business hours"). The generic
"Thanks for getting in touch" goes away. `ENABLE_AUTO_REPLY` is retired as a flag — a confirmation
for a promise the page made is not optional. Every one names the street when the lead has one.

**CRM handoff.** `sendKvcoreParserEmail` on **every** path, not three of four branches, with the
street and the page in the body. It is already written, already env-gated, and already a silent
no-op while `KVCORE_LEAD_PARSE_EMAIL` is unset — so wiring it costs one call per path and changes
nothing in production until that variable is set. Setting it is a decision for Aamir, not a build
step.

**Leads per page, readable by the Brain.** `Lead.landingPage` is populated on every submission by
the shared path (today only `attributionPayload()` callers set it), and `Lead.street` carries the
resolved street name from `resolveStreetName` — never `shortName`, never a raw MLS string. That
makes the count a plain indexed group-by, exposed as one authenticated read
(`GET /api/leads/by-page`, admin-guarded like `/api/admin/*`) returning
`[{ path, streetSlug, source, leads7d, leads30d, firstAt, lastAt }]`. No new table and no new
column: `landingPage` and `street` already exist. The denominator is out of scope for this
worktree and is stated as such — the figure is leads per page, not a conversion rate, and no
surface may imply otherwise.

**The valuation flow.** `/sell` gains a street-grain read as the owner types. On each debounced
change the client resolves the typed Milton address against the existing street identity data
(`src/data/streetAddresses.ts`, 901 identities / 40,826 civic addresses — the same projection the
ladder uses) and asks one new read-only route for that street's published basis. The route reuses
`graduate()`/`PriceBasis` verbatim — it does not compute a second typical — and renders exactly:

> **Bronte Street South: typical $X across N sales in the last 12 months**

with `windowDisclosure()` supplying the tail, so a full-window basis says "in the last ~2 years"
and cannot be mistaken for a 12-month figure. Below k it renders **nothing at all** — not a zero,
not "data unavailable", not a city figure standing in for a street one. It is a street figure, it
is the same number the street page publishes, and the page states plainly that it is not an
estimate of the visitor's own address. No sold price for a single address, at any k, ever, which is
what makes the flow safe: the owner types 262 Pine Street and is shown what Pine Street did, never
what 262 did.

**What this worktree will not touch:** street page rendering, generation, the homepage, the header
and footer. The valuation route reads shared lib functions; it does not modify them.

**Sequence, if approved.** (1) `ALERT_EMAIL_TO` in production, verified — the one-variable fix for
G3. (2) Fix G1's two broken forms and G6's two false confirmations; both are small and both are
live defects. (3) The one submission path, the three confirmation templates, CRM on every path.
(4) `Lead.landingPage`/`street` on every submission, and the by-page read. (5) The street-grain
valuation figure on /sell. (6) The alert job the alert promises depend on — a real decision, a real
cron entry and its own gate, because sending recurring mail to 445 pages' worth of subscribers is
not a build step.

**Stop. No code until this is approved.**

# 2026-04-28 — Google Ads Launch Prep + Attribution Architecture

> **Purpose.** Single-source snapshot of the ~14-hour launch-prep session that brought the Miltonly Google Ads rental campaign launch-ready. The codebase carries the commits, but the meta-context — strategy decisions, Google Ads UI configuration, defensive playbook, 3-model consultation outcomes, and the post-launch backlog — was not captured in any of the four canonical docs (`AI-BRIEFING.md`, `ADVISOR-BRIEFING.md`, `CHANGELOG-DECISIONS.md`, `DO-NOT-REPEAT.md`). This file is the source of truth for the Notion-ready docs generation step that follows.
>
> **Status at end of session.** Campaign created and **paused**. All instrumentation (attribution persistence, Enhanced Conversions, auto-reply email) verified end-to-end on production. Pre-unpause checklist clear.

---

## Part A — Commits shipped today

Seven commits, in chronological order. All on `main`. Each entry lists files touched and the why behind the change.

### `ce5cf64` — Listing detail forms fire `generate_lead` inline

- **Files:** `src/app/listings/[mlsNumber]/ListingExtras.tsx` (`RentalBookingCard`, `AudienceCTA`), `src/app/listings/[mlsNumber]/ListingDetailClient.tsx` (`submitLead`)
- **Pattern:** New `fireGenerateLead` helper called after `/api/leads` returns `lead.id`; uses cold-cache poll for gtag.
- **Why:** Four lead-capture forms on listing-detail pages were creating Lead rows in Neon but never firing the `generate_lead` GA4 event. Google Ads couldn't see ~30% of conversions originating from clicks that traversed `/rentals/ads → /listings/[mls] → submit`.

### `7a13f5a` — GCLID 3-layer attribution persistence

- **Files:**
  - `src/lib/attribution.ts` (new)
  - `src/components/AttributionCapture.tsx` (new — mounted in root layout, re-runs on URL change via `useSearchParams`)
  - `src/app/layout.tsx` (mount)
  - `src/app/api/leads/route.ts` (accept + persist new fields on both ads and general paths)
  - 12 form files wired to spread `attributionPayload()` into their `/api/leads` body
  - `prisma/schema.prisma` + migration `prisma/migrations/20260428223142_add_lead_attribution_persistence/migration.sql` (applied to Neon)
- **Pattern:**
  - `captureAttribution()` runs on every page load. If URL contains `gclid` or any `utm_*`, persist payload in **both** `localStorage` and a 90-day first-party cookie.
  - `localStorage.attribution` = first-touch (never overwritten).
  - `localStorage.attribution_last` = last-touch (overwritten each new ad click).
  - `cookie attribution` = first-touch backup, `max-age=7776000`, `SameSite=Lax`, `path=/`.
  - `getAttribution()` and `attributionPayload()` are read by form submit handlers to flatten first + last into the `/api/leads` body.
- **Schema additions** (all optional):
  - `gclidLast`, `utmSourceLast`, `utmMediumLast`, `utmCampaignLast`, `utmTermLast`, `utmContentLast`
  - `firstVisitAt`, `landingPage`
  - Existing `gclid` + `utmSource/utmMedium/utmCampaign/utmKeyword/utmContent` are now first-touch (no rename — backwards compatible).
- **Why:** Without persistence, `gclid` was lost the moment the user navigated from `/rentals/ads` to `/listings/[mls]`. Listing-detail submit got attribution-free leads, breaking Ads attribution. First-touch is what Google Ads imports; last-touch is for our own multi-touch analytics.

### `e0c119a` — Enhanced Conversions manual mode (sha256 user_data)

- **Files:**
  - `src/lib/hash.ts` (new — `sha256()` + `hashUserData()` returning `{ sha256_email_address, sha256_phone_number }` from lower-cased email + E.164 phone)
  - `src/app/rentals/thank-you/page.tsx` (server fetches lead by `lid` and passes `email` + `phone` as props)
  - `src/app/rentals/thank-you/ThankYouClient.tsx` (hashes client-side, passes `user_data`)
  - `fireGenerateLead` in `ListingExtras.tsx` and `submitLead` in `ListingDetailClient.tsx` updated similarly
- **Pattern (initial):** `hashUserData()` runs client-side, returns `{ sha256_email_address, sha256_phone_number }`. Initial implementation passed `user_data` **inside** the gtag event params object (AW- pattern). This was wrong for GA4 — corrected in `ed43e49`.
- **Privacy:** PII flows from server to client only so the client can SHA-256 it before any network call. Hash leaves the browser; raw email/phone never reach our telemetry or any third-party endpoint.
- **Why:** Auto-detect Enhanced Conversions on Next.js multi-step forms reports near-zero match rate per Google's diagnostics. Manual hashing typically lifts match rate to 50%+.

### `3a189d8` — Resend auto-reply within 30s of submit

- **Files:** `src/app/api/leads/route.ts` (added `sendAutoReply` function and call sites on both ads + general lead-creation paths)
- **Pattern:** Fire-and-forget `resend.emails.send()` after `prisma.lead.create()` succeeds. Returns immediately so `/api/leads` response stays fast. Errors caught + logged; never propagated to the client.
- **Email config:**
  - **FROM:** `Aamir from Miltonly <onboarding@resend.dev>` (hardcoded — `miltonly.com` domain not yet verified in Resend)
  - **Reply-To:** `process.env.AAMIR_EMAIL || REALTOR_EMAIL || "aamir@miltonly.com"`
  - **TO:** `lead.email` (skip when missing or honeypot)
- **Body content:** Greeting, RE/MAX Hall of Fame trust line, "you pay me nothing — landlord covers my fee" trust signal, signature.
- **Note:** Brokerage name initially shipped as `RE/MAX Real Estate Centre Inc.` — **wrong** under RECO. Corrected in `908cacf`.
- **Why:** Empirical data (Harvard study + real-estate-specific benchmarks): leads contacted within 5 minutes are 8–10× more likely to convert than leads contacted within 60+ minutes. Email auto-reply within 30 seconds doesn't replace the call but bridges the gap.

### `ed43e49` — Fix Enhanced Conversions: switch user_data to gtag('set') pattern

- **Files:** `ThankYouClient.tsx`, `fireGenerateLead` in `ListingExtras.tsx`, `submitLead` in `ListingDetailClient.tsx` (three call sites — same fix)
- **Diagnosis:** AW-style **inline** `user_data` property on `gtag('event', …)` was silently dropped by the GA4 measurement protocol. GA4 has no inline event-param slot for nested `user_data`; it serializes only scalars to `ep.*` / `epn.*`. Inline `user_data` is the **AW- (Google Ads native conversion) pattern**, not the GA4 pattern.
- **Fix:** All three call sites now use the canonical GA4 EC for Leads pattern — back-to-back `gtag("set", "user_data", userData)` followed by `gtag("event", "generate_lead", {...})`, both synchronous after `hashUserData()` resolves. The "race condition" warning about `gtag('set')` only applies when the `set` is far separated in time from the event; back-to-back in the same tick the queue is FIFO and there's no race.
- **Verification (post-deploy):** `/g/collect` payload now contains `up.em` and `up.ph` (the GA4 wire-format for hashed user-provided data).

### `41d9c5a` — Debug logs added (later stripped)

- **Files:** `src/app/rentals/thank-you/page.tsx`, `src/app/rentals/thank-you/ThankYouClient.tsx` — five `[EC-DEBUG]` `console.log` checkpoints (1 server, 4 client) to diagnose why `user_data` still wasn't appearing in `/g/collect` after `ed43e49`.
- **Diagnosis revealed:** The code chain was correct; **the GA4 property had "User-provided data collection" toggled OFF at the Admin level**. GA4 was ignoring the gtag `set` call because the property hadn't acknowledged it was allowed to collect user-provided data.
- **Fix path:** Aamir flipped GA4 Admin → Data collection → User-provided data collection **ON**, plus Google signals data collection **ON** (and granular location/device data **ON** for completeness).
- **Logs stripped in `908cacf`** once verified.

### `908cacf` — Brokerage compliance fix + signature replacement + `[EC-DEBUG]` strip

- **Files:** `src/app/api/leads/route.ts`, `.env.example`, `src/app/rentals/thank-you/page.tsx`, `src/app/rentals/thank-you/ThankYouClient.tsx`
- **RECO compliance fix:** Auto-reply body brokerage line corrected — `RE/MAX Real Estate Centre Inc.` → `RE/MAX Realty Specialists Inc., Brokerage`. Every realtor communication must accurately identify the brokerage; the original was a RECO violation.
- **Signature replacement:** Old 4-line plain-text closer replaced with structured HTML `<table>` signature (RE/MAX Hall of Fame designation, brokerage compliance line, 14-year/150-families trust stat, clickable phone, mailto). Plain-text version mirrors HTML.
- **Email address:** Hardcoded `gtahomequest@gmail.com` in the visible signature (Aamir's Gmail) — `aamir@miltonly.com` mailbox not yet created. SMTP `Reply-To:` header still pulls from `AAMIR_EMAIL` env so updating the env updates routing without a redeploy.
- **Google Reviews row:** Intentionally omitted — no URL provided yet. Add when URL exists.
- **`AAMIR_EMAIL` default in `.env.example`** updated to `gtahomequest@gmail.com`.
- **EC-DEBUG cleanup:** All five `[EC-DEBUG]` `console.log` statements removed from `src/`.

---

## Part B — Google Ads campaign config (configured in UI, not in code)

Live in the Google Ads UI; not version-controlled. Recorded here so the configuration is reproducible.

**Account:** 577-063-8511 (Miltonly)
**Linked GA4 property:** 534572717

### Campaign — `Milton Rental - Search`

- **Status at end of session:** PAUSED (not yet unpaused)
- **Budget:** $30 CAD/day, Standard delivery
- **Bidding:** Manual CPC (held for 45–60 days, **not** 30 — won't hit the Smart Bidding 30-conversion threshold at this volume)
- **Networks:** Google Search Network only (no Display, no Search Partners)
- **Locations:** Milton ON only, **Presence** (not interest)
- **Languages:** English, Hindi, Urdu, Punjabi
- **AI Max for Search:** OFF
- **Dynamic Search Ads:** OFF (verified domain field empty)
- **Auto-applied recommendations:** OFF (verified 0/7 Maintain, 0/14 Grow)
- **Customer data terms:** Accepted
- **Enhanced Conversions:** ON, Google Tag method, manual `user_data` via code (auto-detect leaves toggle off — **code path is authoritative**)

### Ad groups (4) — all paused, tiered max CPCs

| Ad group              | Landing page                                          | Max CPC    | Keywords |
|-----------------------|-------------------------------------------------------|------------|----------|
| Condo Rentals         | `/rentals/ads?type=condo&beds=2&max=3000`             | CA$3.00    | 7        |
| Townhouse Rentals     | `/rentals/ads?type=townhouse&beds=3&max=3500`         | CA$3.50    | 8        |
| Semi-Detached Rentals | `/rentals/ads?type=semi&beds=3&max=3500`              | CA$3.50    | 7        |
| Detached Rentals      | `/rentals/ads?type=detached&beds=4&max=4500`          | CA$5.00    | 8        |

Each ad group:

- 1 Responsive Search Ad
- 15 headlines, **Position 1 PINNED** to "Milton [Type] Rentals"
- 4 descriptions
- DKI in **Headline 14 (unpinned)** — 130+ negatives serve as a fence

### Campaign-level

- **207 negative keywords** (130 originals + 44 added today: basement, builder, rural Milton, student, landmarks, etc.)
- **7 sitelinks:** All Milton Rentals, Condo, Townhouse, Semi, Detached, Free Lease Review, Call Aamir
- **8 callouts:** Free Lease Negotiation · Replies in Under 60 Min · RE/MAX Hall of Fame Agent · 14 Years Focused Milton · No Bots No Call Centres · 5.0 Stars on Google · Same-Day Showings · 300+ Active Rentals
- **Call extension at account level:** (647) 839-9090
- **Tracking template:**
  ```
  {lpurl}?utm_source=google&utm_medium=cpc&utm_campaign={campaignid}&utm_term={keyword}&utm_content={adgroupid}_{matchtype}_{device}&network={network}
  ```

### Conversions configured

- **Primary — `Rental Lead — generate_lead`** — GA4 source · Count: One · 30-day click window · $300 default value · Data-driven attribution · Enhanced Conversions ON
- **Secondary — `Lead form - Submit`** — Google hosted, demoted
- **Secondary — `manual_event_SUBMIT_LEAD_FORM`** — GA4, demoted

### GA4 property settings (configured at session end)

- User-provided data collection: **ON** (acknowledged 2026-04-28; auto-detect OFF — manual via code)
- Google signals data collection: **ON**
- Granular location and device data: **ON**

---

## Part C — Strategy decisions locked (3-model consultation outcomes)

Three rounds of cross-model consultation: **Gemini + ChatGPT Pro + this Claude session**. Locked positions below — do not re-debate without explicit reopen.

### Geo

- **Phase 1: Milton-only.** LP message-match wins over volume at this scale.
- **Phase 2: Wider geo intent capture campaign at 20–30km radius.**

### Match types

- **Phrase + Exact only.** No broad match — would burn the $30/day budget at this stage.

### Conversion model

- **Phase 1:** single `generate_lead` event with $300 default value.
- **Within 7 days post-launch:** ship `qualified_lead` Secondary conversion (NOT Day 1 — needs Lead admin UI first).

### Speed-to-contact

- **Day 1:** Resend email auto-reply within 30 seconds — LIVE.
- **Pending (~3 days):** Twilio SMS — A2P 10DLC registration.

### Bidding

- **Manual CPC for 45–60 days.** Won't hit the 30-conversion Smart Bidding threshold at $30/day. Switch to Maximize Conversions only after the threshold is cleared.

### Ad copy cadence

- **Day 1:** 1 RSA per ad group.
- **Week 5:** add second variant.
- **Pin Position 1 only.** Position 2/3 unpinned so Google can test.

### Scope

- **Skip basement** as a 5th ad group — different audience tier; revisit Phase 2.

### 7-day post-launch builds

1. Lead admin UI in Powerhouse for status toggling (New / Contacted / Qualified / Junk / Booked / Closed / Lost) + notes
2. Schema additions: `leadStatus`, `firstPage`, `internalReferrer`, `qualificationReason`, `isQualified`, `leadTemperatureAtSubmit`
3. Weekly CSV upload to Google Ads (gclid + qualified status + close info)
4. `qualified_lead` Secondary conversion in Google Ads
5. Twilio SMS activation (post A2P 10DLC clearance)
6. Resend domain verification: `miltonly.com` → switch FROM from `onboarding@resend.dev` to `leads@miltonly.com`

### Defensive playbook

- **If clicks > 30–50 AND conversions = 0 by Day 14** → pause that ad group.
- **If overall performance stagnant by Day 14** → pause Semi + Townhouse, funnel all $30 into Condo + Detached.
- **Don't kill an ad group on impressions alone** — clicks are the signal that matters.

### Phase 2 (Month 2–3)

- Parallel `Milton Landlord - Search` campaign at $10/day
- Wider geo (20–30km) intent capture campaign
- Server-side tracking via Measurement Protocol
- Display + YouTube remarketing
- Dynamic conversion value tiers ($50 / $150 / $400 / $1000)
- Powerhouse Marketing Performance dashboard

---

## Part D — Infrastructure state

### Stack

- **Next.js 14** (App Router)
- **Vercel** (production deployment)
- **Neon Postgres** (production app DB — separate from `miltonly-analytics` which holds TREB sold data)
- **Prisma ORM**
- **Resend** (transactional email)
- **Twilio** (SMS stub; A2P 10DLC pending — ~3-day approval)
- **Google Analytics 4 (GA4)**
- **Google Ads**
- **gtag.js**

### Production env vars (relevant subset)

- `DATABASE_URL` — Neon main app DB
- `DIRECT_URL` — Neon direct connection (Prisma migrations)
- `RESEND_API_KEY`
- `AAMIR_EMAIL = gtahomequest@gmail.com` — lead reply destination until `aamir@miltonly.com` mailbox exists
- `NEXT_PUBLIC_GA_MEASUREMENT_ID = G-5G7486M9M9`
- Plus Twilio stub vars, Google OAuth, etc.

### Email infrastructure status

- **Resend:** Working. Both agent notification and lead-facing auto-reply firing.
- **`onboarding@resend.dev`:** Temporary FROM (Resend's sandbox sender). Replace once `miltonly.com` is verified in Resend.
- **`aamir@miltonly.com` mailbox:** **Not yet created.** Hosted at SiteGround. Two paths: free email forwarder (≈2 min) or full mailbox via cPanel. Aamir to handle.

---

## Part E — Outstanding items / known gaps

### Pre-unpause

- **None remaining.** All instrumentation verified working at end of session.

### Within 7 days post-launch

- Lead admin UI in Powerhouse: status toggling (New / Contacted / Qualified / Junk / Booked / Closed / Lost) + notes
- Schema additions: `leadStatus`, `qualificationReason`, `firstPage`, `internalReferrer`, `isQualified`, `leadTemperatureAtSubmit`
- Weekly CSV upload workflow for offline conversions to Google Ads (gclid + qualified status + close info)
- Create `qualified_lead` Secondary conversion in Google Ads
- Activate Twilio SMS once A2P 10DLC clears
- Resend domain verification: `miltonly.com` → switch FROM_EMAIL from `onboarding@resend.dev` to `leads@miltonly.com`
- Set up `aamir@miltonly.com` mailbox at SiteGround (forwarder or full)
- Add Google Reviews URL to email signature (currently removed pending URL)
- Fix `/icon-192x192.png` 404 (PWA manifest)

### Phase 2 (Month 2–3)

See Part C — Phase 2 list.

### Known gaps (low priority)

- **`CornerWidget` form on street pages** uses native HTML POST, not `fetch`. Not in attribution wiring. Low priority — not in the ad funnel.
- **Other forms across the site** (hero, seller tool, buyer alert, investor report) — only the 4 listing-detail forms were audited and patched today. Hero and others may or may not fire `generate_lead`. Audit Phase 2.

---

## Cross-references

- **Canonical context docs** (the four):
  - `AI-BRIEFING.md` — current state, phase status, last-15-commits log
  - `ADVISOR-BRIEFING.md` — strategy context, locked decisions, open questions
  - `CHANGELOG-DECISIONS.md` — strategic + technical decision log (newest at top)
  - `DO-NOT-REPEAT.md` — settled rules
- **This file (`docs/launch-prep-2026-04-28.md`)** is the launch-prep snapshot meant for Notion-doc generation. It does not replace the canonical four.
- **Commits referenced above** are all on `main`: `ce5cf64`, `7a13f5a`, `e0c119a`, `3a189d8`, `ed43e49`, `41d9c5a`, `908cacf`.

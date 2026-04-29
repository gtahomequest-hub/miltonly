# AI-BRIEFING.md — Claude Code Session Context

> **Last updated:** April 28, 2026
> **Auto-update this file** after every deployment and every phase completion.

---

## Where we are (2026-04-28)

**Site is live** at https://www.miltonly.com. Maintenance gate has been off since 2026-04-17.

**Paid acquisition stack is shipped (rentals/ads funnel).** `/rentals/ads` is the SKAG-friendly paid-traffic landing page; `/rentals/thank-you` is the post-submit page that fires the Google Ads conversion. All three rentals/ads phases are live as of 2026-04-26:

- **Phase 1 (commit `e032110`, 2026-04-25)** — 2-step form (chips → contact), `/rentals/thank-you` server page, Google Ads `gtag` conversion firing once on mount with `transaction_id=lead.id`, `gclid` + UTM persistence on `Lead`, additive Prisma migration `add_lead_ads_tracking_fields`, honeypot routing to `lid=spam`, in-memory rate limit (5 req / 60s per IP), Twilio stub (live SMS commented out until A2P 10DLC is registered), strict validation scoped to `source="ads-rentals-lp"`. `/api/leads` preserved for all 11 other callers.
- **Phase 2 (commit `6b04165`, 2026-04-26)** — top trust strip, speed-to-lead badge, 4-column comparison block, live TREB listings filter (client-side, propertyType + bedrooms + budget AND-logic), JSON-LD `@graph` (RealEstateAgent + LocalBusiness + WebPage + aggregateRating), hybrid H1 (URL params → SKAG dynamic; no params → static + amber " — Before Someone Else Does." suffix).
- **Phase 2.1 (commit `d6c1294`, 2026-04-26)** — Under $4K and Under $5K chips added to BUDGET_OPTIONS, new `mapMaxToChip()` helper snaps any URL `?max=` to the smallest chip ≥ value (so URL hydration always lands on a real chip), `buildDynamicHeadline` boundary fix (`max <= 5000` instead of `<`).

**GA4 is fully installed and firing in production.** `NEXT_PUBLIC_GA_ID = G-5G7486M9M9`. Verified live 2026-04-25 after redeploy (`a444c51`).

**Google Ads account created for Miltonly.** One **paused** Search campaign — "Milton Rental - Search". Manual CPC, $30/day, Milton-only, languages English/Hindi/Urdu/Punjabi, 1 ad group, 8 phrase-match keywords, RSA with 15 headlines + 4 descriptions, 7 sitelinks + call extension at the campaign level. **Conversion tracking is wired to placeholder `AW-` ID/label values** — the campaign cannot be unpaused until the real conversion ID and label are dropped into `NEXT_PUBLIC_AW_CONVERSION_ID` / `NEXT_PUBLIC_AW_CONVERSION_LABEL` (Vercel env). Real values land 2026-04-29.

**Phase 1 — 4-DB architecture** is shipped and operational: DB1 (Prisma), DB2 (`sold` schema on Neon), DB3 (`analytics` schema on Neon), Redis (Upstash). DB2 holds 7,001+ closed transactions across sales and leases. Sync and stats compute crons running nightly.

**Phase 2 + 2.5 + 2.6 — VOW compliance** is shipped. SSR VowGate with k=10 k-anonymity on MIN/MAX aggregate teasers, per-record listing Brokerage display (VOW §6.3(c)), bona-fide-interest acknowledgement quartet (TRESA 2002 + VOW §6.3(k)), DB1 sold-derived fields nullified, public render tree free of sold-derived data. Tier 1 + Tier 1.5 teaser-language audit complete as of 2026-04-18 — 14 public-facing "sold prices" phrasings neutralized across commits `fc73715`, `2e9f5ed`, `df47b74`.

**Phase 4.1 — 8-section AI street descriptions** is in backfill. Identity-keyed slug architecture + directional H2-subsection prompt handling shipped through Step 13m-4 (commits `9fa14c9`, `9cf5c3f`, `032b6ee`). 24 succeeded slugs regenerated under the new input shape. 301 middleware redirects siblings to canonical. Backlog clearing on the cron — `~3 days` to clear automatically per project_pending_catchup memory.

**Active pipeline:** `/api/sync/sold` populates `sold.sold_records` on schedule. `/api/sync/generate` every 4h regenerates StreetContent rows. Street pipeline auto-retry + VIP hub cron + catch-up endpoint all wired per commit `74b5ed6`. `skip_current` null-hash bug fixed 2026-04-18 (`77f5215`) — rows with `marketDataHash = NULL` no longer silently skipped.

---

## Phase 1 — 4-database architecture (2026-04-16 → 2026-04-18)

**Status:** Live. DB2 has ~7,001 closed transactions with `list_office_name` backfilled (2026-04-17). Migrations 001, 002, 003 applied. VOW agreement #1848370 active. Both sync and stats-compute crons running.

Four data stores, strict one-way flow, VOW compliance enforced at read path not at storage.

- **DB1 — operational** (Prisma, `DATABASE_URL`). Listings, leads, users, auth, compliance. Unchanged.
- **DB2 — sold** (Neon, `SOLD_DATABASE_URL`, schema `sold`). Closed VOW transactions — both **sales and leases** differentiated by `transaction_type` column (migration 002). Never deleted; historical rows are the DB4 training set.
- **DB3 — analytics** (Neon, `ANALYTICS_DATABASE_URL`, schema `analytics`). Pre-computed street/neighbourhood stats, monthly aggregates, listing scores. Sale stats and lease stats stored in separate columns to enforce "no lease data in ML" at the column level.
- **DB4 — Milton Intelligence DB** (ClickHouse, deferred to Month 3). **Owner private use only — never consumer-facing.** Rules locked 2026-04-16 in `DO-NOT-REPEAT.md`: sold records only (no leases, no active), append-only (never delete — full historical value), fed from DB2 not TREB directly, schema forward-only, features versioned. Derived predictions and scores can be shown to consumers; raw DB4 records cannot. Imports from `computeStreetSaleStats` only — lease compute function is physically separate so "no lease data in ML" is enforced at the data-layer boundary.
- **Redis** (Upstash, `UPSTASH_REDIS_KV_REST_API_URL/TOKEN` — Vercel Marketplace injected names). Caches reads from DB3 and DB1; never writes source data.

DB2 and DB3 today point at the same Neon instance — separate named schemas, splittable into two Neon instances later with zero table rework. `public` schema is intentionally empty.

**Data flow rules** (enforced in `src/lib/db.ts` comment block and every file that touches the data):
- DB2 → DB3: nightly compute job only (`src/lib/sold-stats.ts` via `/api/jobs/compute-sold-stats` at 11:30 UTC).
- DB2 → Claude API: **never.** Individual sold records never enter any AI prompt.
- DB3 → Claude API: aggregated stats only.
- DB2 → DB1: **never.** Sold data never enters the operational database.
- Lease data → prediction engine: **never.** Only sale rows feed DB4 features.
- Redis caches DB3 and DB1 reads; never writes source data.

**Key files:**
- `src/lib/db.ts` — single import point for `operationalDb`, `soldDb`, `analyticsDb`. Graceful on missing env vars.
- `src/lib/db-types.ts` — TypeScript row types for all `sold.*` and `analytics.*` tables.
- `src/lib/cache.ts` — Upstash Redis client, `cached()` helper with stampede protection + graceful degradation.
- `src/lib/sold-stats.ts` — compute engine. After migration 002: two functions — `computeStreetSaleStats` (sale rows only) and `computeStreetLeaseStats` (lease rows only) with bed-count breakdown.
- `migrations/sold/` and `migrations/analytics/` — numbered SQL migrations, applied via `POST /api/admin/migrate` (advisory-locked, lock key `12345`).
- `src/app/api/sync/sold/route.ts` — VOW sync via `VOW_TOKEN`. Backfill on empty, incremental by `ModificationTimestamp` thereafter (not `CloseDate` — not allowed in AMPRE `$filter`). Never deletes.
- `src/app/api/sync/sold/test/route.ts` — multi-probe diagnostic endpoint. Always returns HTTP 200 with `ok`/`amprerror` in body; runs 4 parallel AMPRE probes to identify correct filter + `TransactionType` strings.
- `src/app/api/sold/route.ts` — authed-only read path. Rate-limited (60/min user, 30/min IP), Redis-cached, graceful on outage. Accepts `?type=sale|lease|all` (default `sale`).
- `src/components/vow/VowGate.tsx` — SSR-only compliance gate. Anon → aggregate teaser from analytics schema only. Authed → full children. Zero individual records reach unauthenticated browsers.

**Cron schedules** (Vercel injects `Authorization: Bearer <CRON_SECRET>` automatically):
- `0 11 * * *` — `/api/sync/sold` — sync new/changed closed transactions from TREB VOW.
- `30 11 * * *` — `/api/jobs/compute-sold-stats` — recompute street + neighbourhood stats (sale + lease separately).

**Required env vars:**
- `DATABASE_URL` — DB1 Prisma (Supabase, unchanged)
- `SOLD_DATABASE_URL` — DB2 Neon connection (points to same Neon as analytics; schema `sold`)
- `ANALYTICS_DATABASE_URL` — DB3 Neon connection (same instance; schema `analytics`)
- `UPSTASH_REDIS_KV_REST_API_URL` — Upstash Redis REST URL (Vercel Marketplace name)
- `UPSTASH_REDIS_KV_REST_API_TOKEN` — Upstash Redis REST token (Vercel Marketplace name)
- `TREB_API_TOKEN` — **IDX-scoped** token, active listings only. Used by `detect/route.ts`.
- `VOW_TOKEN` — **VOW-scoped** token (agreement #1848370), covers closed sales + leases. Used by `sold/route.ts` and `sold/test/route.ts`. All TREB env vars are `.trim()`'d at import — Vercel-stored values carry trailing whitespace that corrupts query strings and auth headers.

**Runbook — first-time setup** (once after Neon + Upstash provisioned via Vercel Marketplace + VOW token in env):
1. Confirm `TREB_API_TOKEN` (IDX), `VOW_TOKEN` (VOW), `SOLD_DATABASE_URL`, `ANALYTICS_DATABASE_URL`, and Upstash keys are set in Vercel project env. All pulled into `.env.local` via `vercel env pull`.
2. `POST /api/admin/migrate` with `Authorization: Bearer <CRON_SECRET>` — creates `sold` and `analytics` schemas + all tables up to the latest migration file.
3. Verify AMPRE filter + `TransactionType` values: `GET /api/sync/sold/test?secret=$CRON_SECRET` (substitute the env value [REDACTED — see local notes]) — inspect `.summary.uniqueTransactionTypesAcrossProbes` before running migration 002.
4. `POST /api/sync/sold` once — triggers backfill of all Milton closed history (may take several minutes; 400-page cap as safety).
5. `POST /api/jobs/compute-sold-stats` once — populates street + neighbourhood stats.
6. Verify: street and neighbourhood pages render aggregate teasers for anon users; authed users see full sold data.

---

## Maintenance Gate — DISABLED (site is live)

`MAINTENANCE_MODE = false` in `src/middleware.ts` since commit `d773804`. Site serves real content to all visitors. Preview bypass cookie still works but is no longer needed. To re-enable the gate if compliance state demands it: flip the constant back to `true` and redeploy.

---

## What Is Miltonly

Milton, Ontario's only dedicated real estate intelligence site. Street-level data, AI-generated content, and TREB/PropTx MLS listings via IDX Agreement #1809031. Not a portal — a hyperlocal data layer targeting every deep Milton search query with zero competition from any dedicated site.

**Live URL:** https://www.miltonly.com
**Project folder:** `C:\Users\inpse\miltonly`
**GitHub:** github.com/gtahomequest-hub/miltonly
**Vercel:** gtahomequest-hubs-projects/miltonly (auto-deploys from `main`)
**Owner:** Aamir Yaqoob (licensed Realtor, RE/MAX Realty Specialists Inc.)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14.2.35 (App Router) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS 3.4 |
| ORM | Prisma 5.22 |
| Database | PostgreSQL (Supabase) |
| Hosting | Vercel (auto-deploy from main) |
| Email | Resend |
| SMS | Twilio |
| File storage | Vercel Blob |
| AI | Anthropic Claude API (claude-sonnet-4-20250514) |
| Auth | Passwordless (email + 6-digit code, 30-day JWT via jose) |
| Analytics | Google Analytics 4 (`NEXT_PUBLIC_GA_ID = G-5G7486M9M9`, live 2026-04-25) |
| Paid acquisition | Google Ads `gtag` conversion via `NEXT_PUBLIC_AW_CONVERSION_ID` + `_LABEL` (placeholder until 2026-04-29) |
| Live chat | Crisp |

---

## Database Models (DB1 / Prisma)

Listing, Lead, VisitorProfile, StreetData, CondoBuilding, StreetContent, StreetQueue, Partner, ExclusiveListing, ComplianceLog, User, SavedSearch.

**User** carries the Phase 2.5 acknowledgement quartet: `vowAcknowledgedAt`, `vowAcknowledgementText`, `vowAcknowledgementIp`, `vowAcknowledgementUserAgent` (TRESA 2002 + VOW §6.3(k) audit). **Listing.soldPrice** and **Listing.soldDate** are nullable and permanently nulled — sold data lives exclusively in DB2 (`sold.sold_records`) and is gated by VowGate.

Schema: `prisma/schema.prisma` (DB1 only). DB2/DB3 SQL migrations live in `migrations/sold/` and `migrations/analytics/`; types in `src/lib/db-types.ts`.

---

## Pages (26 routes)

**Public:** `/` `/listings` `/listings/[mlsNumber]` `/streets` `/streets/[slug]` `/neighbourhoods` `/neighbourhoods/[slug]` `/schools` `/schools/[slug]` `/mosques` `/mosques/[slug]` `/condos` `/compare` `/map` `/rentals` `/rentals/ads` `/rentals/thank-you` `/rent` `/exclusive` `/exclusive/[slug]` `/sell` `/book` `/blog` `/about` `/coming-soon`
**Auth:** `/signin` `/saved`
**Admin:** `/admin/review` `/admin/exclusive`

---

## API Endpoints

**Auth:** signup, verify, me, logout, save-listing, saved-listings, saved-searches, **acknowledge-vow** (Phase 2.5 bona-fide-interest capture — idempotent POST; records timestamp, text, IP, user-agent)
**Sync pipeline:** sync, detect, generate, regenerate, backfill, expire, vip-hubs, **sold, sold/test** (VOW feed)
**Stats compute:** jobs/compute-sold-stats (nightly at 11:30 UTC)
**Sold read path:** `/api/sold` (authed-only, rate-limited 60/min user + 30/min IP, Redis-cached with stampede protection, accepts `?type=sale|lease|all`)
**Admin:** auth, publish, reject, upload, exclusive, migrate, **force-regenerate** (single-slug bypass of `makeStreetDecision` for compliance cleanup runs)
**Data:** autocomplete, street-stats, **leads** (extended 2026-04-25 — honeypot, rate-limit 5 req/60s per IP, strict path for `source="ads-rentals-lp"`, captures `gclid` + UTMs + referrer + UA + IP), exclusive-inquiry
**System:** monitor/queue, compliance/check, revalidate, alerts/match

---

## MLS Pipeline (nightly cron)

`sync → detect → generate → expire → compliance check`

### Cron Jobs (vercel.json)

| Job | Schedule (UTC) | Endpoint |
|-----|---------------|----------|
| Detect new streets | 10:00 daily | `/api/sync/detect` |
| Generate content | 10:05 daily | `/api/sync/generate` |
| Regenerate stale | 12:00 Sunday | `/api/sync/regenerate` |
| Queue monitor | Hourly | `/api/monitor/queue` |
| Expire listings | 11:30 daily | `/api/sync/expire` |
| Compliance check | 05:00 daily | `/api/compliance/check` |

**Missing from vercel.json:** VIP Hub detection (`/api/sync/vip-hubs`) and Deal alert matching (`/api/alerts/match`) — both built but not yet scheduled.

---

## Phase Status

### Phase 1 — COMPLETE (2026-04-12)

- Database schema (11 models incl. ComplianceLog)
- MLS pipeline (daily TREB sync + AI street content + expiry + monitoring)
- Homepage (live stats, featured listings, trust bar, SEO link grid)
- 700+ street pages (live data, AI descriptions, FAQs, schema markup)
- Listing pages (browse with filters + detail pages)
- 20+ neighbourhood pages (live data, top streets, price by type, FAQs)
- Broken links fixed (15 URLs removed from sitemap, SeoLinkGrid, QuickSearchPills, etc.)
- Mobile responsive (all pages)
- SEO foundation (meta, schema, OG, sitemap, robots, canonical)
- Section 13 compliance (all 6 items complete)

### Phase 2 — LIVE (maintenance gate lifted 2026-04-17, commit `d773804`)

- Passwordless auth (email + 6-digit code, 30-day JWT)
- Saved listings and saved searches
- Deal alert matching (cron `/api/alerts/match`)
- VIP Hub system (auto-detects streets with 5+ active listings, enhanced content + VIP cron 2026-04-17)
- School zone pages (`/schools` hub + 23 individual pages)
- Mosque pages (`/mosques` hub + 7 individual pages)
- `/sold` hub + `/sold/[streetSlug]` pages (authed-only, VOW-compliant)
- Listing detail overhaul — proximity intelligence, commute times, investment analysis, VOW teaser, save/share, urgency, mobile bar, SEO (commit `f7f517f`)

### Phase 2.5 — VOW compliance hardening (2026-04-17)

- SSR VowGate (no client-side blur) with three-state flow: anon → aggregate teaser; authed-not-acknowledged → acknowledgement prompt; authed+acknowledged → full records
- k=10 k-anonymity guard on MIN/MAX aggregate teasers (commit `61fe7f0`)
- Per-record Brokerage display (VOW §6.3(c)) — `list_office_name` column on `sold_records`, populated by sync + backfilled 2026-04-17
- Bona-fide-interest acknowledgement quartet on User (timestamp, text, IP, user-agent) — TRESA 2002 + VOW §6.3(k)
- `canServeRecordsToThisRequest()` guard pushed to fetcher-level (commit `699f848`)
- `/api/sold` refactored to delegate to gated fetchers (commit `421096d`)

### Phase 2.6 — source-level data-flow cleanup (2026-04-17 → 2026-04-18)

- DB1 `Listing.soldPrice` and `soldDate` permanently nulled (`migrations/db1/2026-04-17-null-sold-fields.sql`, 0 rows affected — sync paths never wrote them; committed as guard)
- `streetDecision.ts` / `streetUtils.ts` rewritten at source — no more `avgSoldPrice` labels on active-listing data (commits `8e77e9d`, `641f644`)
- Homepage FAQ relabel "sold price" → "list price" (`49babcf`)
- 77 stored StreetContent rows marked stale + regenerated (`audit-stored-sold-language.mjs`, `mark-stored-sold-language-stale.mjs`)
- 14 public-facing "sold prices" teaser phrasings neutralized across Tier 1 + Tier 1.5 (commits `fc73715`, `2e9f5ed`, `df47b74`)
- `skip_current` null-hash bug fixed (`77f5215`) — rows with `marketDataHash = NULL` now correctly flow to `regenerate`

### Phase 4.1 — 8-section AI street descriptions (in progress, 2026-04-19 → ongoing)

- Phase 4.1 docs in `docs/phase-4.1/` (system prompt, kickoff, parking lot)
- Identity-keyed slug architecture + directional H2-subsection prompt handling (commits `9fa14c9`, `9cf5c3f`, `032b6ee` — Steps 13m-3, 13m-4a, 13m-4b)
- 24 succeeded slugs regenerated under the new input shape; 301 middleware in place for sibling-to-canonical redirects
- Backfill clearing on cron — auto-clears in ~3 days per project_pending_catchup memory; optional `curl` available to accelerate

### Paid acquisition / Ads funnel — LIVE (2026-04-25 → 2026-04-26)

- `/rentals/ads` paid-traffic landing page (commit `87a8a39`, expanded through `e032110`, `6b04165`, `d6c1294`)
- 2-step form: chips (homeType / bedrooms / budget / moveIn) → contact (firstName / phone / email + honeypot)
- `Lead` extended with `gclid`, `utmContent`, `referrer`, `userAgent`, `ip`; `email` made nullable; `@@index([gclid])` (additive Prisma migration `add_lead_ads_tracking_fields`)
- `/api/leads` extended without breaking 11 existing callers — strict validation scoped to `source="ads-rentals-lp"`, score branch (phone present → warm/50, email-only → cold/25), honeypot routes silently to `lid=spam` with no DB/Twilio/Resend write, in-memory rate limit 5 req / 60s per IP (`src/lib/rateLimit.ts`)
- `/rentals/thank-you` server page (force-dynamic) — reads `?lid=`, queries Prisma, hands sanitized lead + `isSpam` + `cheatsheetEnabled` + Google Ads env to `ThankYouClient`
- `ThankYouClient` fires `gtag` Google Ads conversion exactly once on mount with `transaction_id=lead.id`, polls for `gtag` every 200ms up to 5s, suppresses on `isSpam=true`
- Phase 2 additions: `<TrustStrip />`, `<SpeedToLeadBadge />`, `<ComparisonTable />`, JSON-LD `@graph` (RealEstateAgent + LocalBusiness + WebPage + aggregateRating), client-side `filteredListings` over the 60-newest live TREB lease listings
- Phase 2.1 additions: BUDGET_OPTIONS extended with $4K and $5K chips, `mapMaxToChip()` helper for URL hydration, `buildDynamicHeadline` boundary fix at `max <= 5000`
- GA4 (`G-5G7486M9M9`) firing in production
- Google Ads "Milton Rental - Search" campaign created and **paused**; cannot launch until real `AW-` conversion ID/label replace placeholder values (expected 2026-04-29)

### Current Priorities

1. **Drop real `AW-` conversion ID + label into Vercel env (expected 2026-04-29)** — `NEXT_PUBLIC_AW_CONVERSION_ID` and `NEXT_PUBLIC_AW_CONVERSION_LABEL` are placeholder values. The "Milton Rental - Search" campaign cannot be unpaused until these are real, otherwise spend will run against a conversion `gtag` that fires to nothing and the optimization signal will be invisible to Google Ads.
2. **Unpause "Milton Rental - Search" campaign** — gated on (1). Once real conversion values are in production, fire one test submission against `/rentals/ads`, confirm conversion lands in Google Ads conversions screen, then unpause the $30/day campaign.
3. **A2P 10DLC registration for Twilio** — the SMS pipeline is stubbed in `src/lib/twilio.ts` with the live send commented out. Once 10DLC is approved, uncomment and verify in production with one real submission.
4. **Tier 2 consolidation debt — fold `street-content.ts` into `generateStreet.ts`** — two parallel Claude-generation paths with different signatures, validator thresholds, and prompt templates write to the same `StreetContent` table. `metaTitle` column can flip between them depending on which path last ran. TODO pinned at top of `street-content.ts`. Options: (a) refactor render-time fallback to call `generateStreetContent` from `generateStreet.ts` with a compatible signature, (b) delete `street-content.ts` and handle the first-visit case in the street page component directly (read-only with "content generating" stub if no row). Until resolved, any Phase N.X compliance change must touch both files.
5. **Run full force-regen to verify `skip_current` fix clears the remaining stale rows** — `77f5215` fixed the null-hash bug; next cron pass (or manual `/api/sync/generate` trigger) should now see the ~70+ rows still flagged stale and regenerate them. If any remain after one full pass, investigate.
6. **Monitor production for the 26 regenerated streets' `faqJson` latent leak** — rows carry pre-fix template text in `faqJson` but status=`draft` means they don't render as JSON-LD today. If any get flipped to `published` by admin review, the leak would surface. Either regenerate proactively after `skip_current` fix takes effect, or flag them stale manually.
7. Set real alert email in compliance check (currently placeholder)
8. 90+ PageSpeed audit (now matters more — paid traffic lands on `/rentals/ads`)
9. Home-valuation tool — VOW data + 4-DB analytics now enable instant estimates; highest-ROI seller lead magnet per prior advisor audit
10. Remove the early-launch lead-count safeguard on `/rentals/ads` — `page.tsx` floors the "X Milton renters got matched this week" counter at 12 when real count < 5. TODO already in place to remove after week 4 of paid traffic.
11. If Google Rich Results Test rejects the JSON-LD `aggregateRating` block (the 4-review threshold), drop only that nested block in a 1-line follow-up — keep the rest of the `@graph` intact.
12. Watch Vercel logs for any AMPRE sync failures on `sold` route — the pipeline is handling many edge cases (ES clause limits, OData v4.0 constraints, redirect auth stripping) that weren't obvious pre-2026-04-17

---

## Section 13 Compliance — COMPLETE

| Item | Location | Status |
|------|----------|--------|
| AI gatekeeper | `src/lib/ai/compliance.ts` | Live |
| Display gate (permAdvertise/displayAddress) | `src/lib/listings/display-gate.ts` | Live |
| Listing expiry | `/api/sync/expire` (daily cron) | Live |
| PIPEDA consent banner | `src/components/consent/ConsentBanner.tsx` | Live |
| Daily compliance check | `/api/compliance/check` (daily cron) | Live |
| ComplianceLog table | `prisma/schema.prisma` | Live |

---

## PropTx Agreements

| Agreement | Number | Status |
|-----------|--------|--------|
| DLA | #1809028 | Active |
| IDX | #1809031 | **Active with URL approval — miltonly.com cleared 2026-04-17, gate lifted** |
| VOW | #1848370 | **Active as of 2026-04-16** — `VOW_TOKEN` provisioned; covers closed sales + leases |

---

## Key Rules — Never Break

- Never call Claude API outside `src/lib/ai/compliance.ts`
- Never show listings where `permAdvertise = false`
- Never retain listings past 60 days
- Never expose raw MLS data to Claude prompts
- No placeholder pages — if not ready, it does not exist
- No broken links — ever — fix immediately
- Never change the design system (navy #0A1628, brand #2563EB, typography, shadows)
- Mobile test on iPhone before every deployment
- 90+ PageSpeed before public launch
- Always run `npx next build` before git push (not just `tsc`)

---

## Design System (locked)

| Token | Value | Use |
|-------|-------|-----|
| navy | #0A1628 | Primary dark backgrounds |
| brand | #2563EB | CTAs, links, active states |
| accent | #16A34A | Success, positive indicators |
| gold | #F59E0B | Highlights, badges |
| Font | Geist Sans | All text |
| Shadows | card / card-hover / glow-brand / glow-accent | Cards and interactive elements |

---

## Last 15 Commits

```
d6c1294 feat(rentals/ads): add Under $4K and Under $5K chips, fix max boundary and add chip rounding helper
6b04165 feat(rentals/ads): Phase 2 — trust strip, speed-to-lead, comparison block, live listings filter, JSON-LD
e032110 feat(rentals/ads): 2-step form + thank-you page with Google Ads conversion + gclid tracking
a444c51 trigger redeploy for GA env var
375d8f5 chore: delete audit test leads + fix listings/count param parsing
17911cb Remove orphan AgentStrip — duplicates content already in the new FooterSection
2097854 Footer rebuild + pre-footer newsletter CTA
bf6e79d Lighten SEO grid micro-CTA strips: amber-50 tint + dark-on-resting links
48bfc88 SEO link grid: persona-routing card, micro-CTA strips, heading hierarchy
f956549 Sold on My Street section — aggregate stats + VOW-compliant CMA gate
fa98763 Add Milton mortgage calculator section
d03d5c5 Add homepage-exclusive source label
050bd64 Off-market exclusives — copy upgrade + lead-capture form
052cf45 Bust featured-listings cache + parse TREB "< X" sqft notation
3b6eaed TREB sync: parse LivingAreaRange into Listing.sqft (was hardcoded null)
```

---

## One-off scripts (in `scripts/`)

| Script | Purpose |
|---|---|
| `backfill-list-office-name.mjs` | Populate `list_office_name` on historical sold_records. Re-run only if table is ever bulk-populated without it again. `--dry-run` / `--log-url` flags. |
| `force-regenerate-streets.mjs` | POSTs `/api/admin/force-regenerate` for a hardcoded slug list, bypasses `makeStreetDecision`, 2s delay between calls. `--slugs-from-file` override. |
| `template-no-stats-descriptions.mjs` | DB-only rewrite for rows leaking "sold price"/"sold for" on streets with zero active listings. Idempotent. `--dry-run` flag. |
| `audit-stored-sold-language.mjs` | Read-only audit of description/rawAiOutput/faqJson for leak phrases. |
| `mark-stored-sold-language-stale.mjs` | Nulls marketDataHash + backdates generatedAt to force regen cycle pickup. |
| `regen-spot-check.mjs` | 3-slug before/after verifier with `--verify` flag. |
| `run-db1-null-sold-migration.mjs` | One-off runner for the Phase 2.6 DB1 null migration. |

## Critical URL + auth guardrails (learned the hard way 2026-04-17)

- **Always target `https://www.miltonly.com` directly in authenticated scripts.** Bare `miltonly.com` 307-redirects to `www` and `fetch()` drops the `Authorization` header on cross-origin redirects. Same rule for `homesly.ca`. Use `?secret=` query param as auth belt-and-suspenders so the secret rides the URL (survives any redirect).
- **`.env.local` may contain literal `\n` inside double-quoted values** — loaders must interpret `\n`/`\r`/`\t`/`\"`/`\\` inside `"..."` (standard dotenv behavior) before `.trim()` can strip the resulting whitespace.
- **AMPRE OData v4.0** — no `in` operator. Use `or`-chain of `eq`. Keep chains ≤ 10 terms to stay under ES `max_clause_count`.
- **`null === null` is `true`** — guard staleness comparisons explicitly (`stored !== null && current === stored`).

---

## Data Sources

| Data | Source | Count |
|------|--------|-------|
| Listings | TREB/Ampre OData API (nightly sync) | Dynamic |
| Street content | AI-generated via compliance gatekeeper | 700+ pages |
| Schools | Hardcoded in `src/lib/schools.ts` | 23 schools |
| Mosques | Hardcoded in `src/lib/mosques.ts` | 7 mosques |
| Neighbourhoods | Computed from Listing table | 20+ pages |
| Exclusive listings | Manual via admin panel | Dynamic |

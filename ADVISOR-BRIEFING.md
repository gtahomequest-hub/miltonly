# ADVISOR-BRIEFING.md — Monthly Strategy Review

> **Last updated:** April 28, 2026
> **Update monthly** or after major strategy changes.
>
> **This is the monthly strategy review document, not a session bootstrap.** Used during Aamir's strategy reviews — vision, growth strategy, locked positions, open strategic questions, where strategic advice is most valuable. **For session bootstrap, see `docs/SESSION-BOOTSTRAP.md`.**
>
> **Live operating state** (current blocker, today's One Thing, this-week roadmap) lives in **Notion · Powerhouse OS root + 🏙️ Miltonly hub page**. The most-recent launch session snapshot lives at **`docs/launch-prep-2026-04-28.md`**. Decision history lives in `CHANGELOG-DECISIONS.md` (newest at top, ~80+ entries) and the Notion **Decisions DB**.

---

## Who Is Aamir

Licensed Realtor based in Milton, Ontario. RE/MAX Realty Specialists Inc. Systems thinker. ROI focused. Ships fast, audits after. No fluff — direct advice only.

---

## What Is Miltonly

The only Milton-dedicated real estate site. Not a portal. Not an agent site. A **data intelligence layer** for Milton buyers and sellers. Every page targets a specific Milton search query with real data and zero competition from any dedicated site.

**Live URL:** https://www.miltonly.com

---

## The Vision

Become the single most useful Milton real estate resource online. Own the search results for every Milton street, neighbourhood, school zone, mosque, and market report query. No other site does this — national portals don't go deep enough, agent sites don't have the data infrastructure.

---

## What Has Been Built and Why

| Asset | Count | Why It Exists |
|-------|-------|--------------|
| Street pages | 700+ | Own every long-tail "123 Street Milton" search |
| School zone pages | 23 | Own family buyer searches ("schools near me Milton") |
| Mosque pages | 7 | Own Muslim community buyer searches (large and growing in Milton) |
| Neighbourhood pages | 20+ | Own "Milton neighbourhood" comparison searches |
| VIP Hub system | Auto | Streets with 5+ listings get premium content automatically |
| Listing pages | Dynamic | Browse and detail pages with live TREB data |
| Exclusive listings | Manual | Pre-MLS listings create urgency and direct inquiries |
| Compliance system | 6 items | PropTx IDX agreement requires all 6 before public launch |
| Passwordless auth | Live | Saved listings, saved searches, deal alerts — no passwords, low friction |
| Deal alert matching | Built | Daily email when new listings match a saved search |
| 4-DB architecture + VOW sold/lease pipeline | Phase 1 shipped 2026-04-16; operational 2026-04-18 | Unlocks sold prices, days-on-market, sold-to-ask ratio, YoY price change, rental comps by bed count — hyperlocal intelligence no competitor has |
| SSR VowGate | Shipped 2026-04-17 | Server-rendered VOW compliance gate — zero individual records reach unauthenticated browsers; anon users see aggregate teasers only (SEO-safe) |
| Bona-fide-interest acknowledgement quartet | Shipped 2026-04-17 | TRESA 2002 + VOW §6.3(k) — timestamp + text + IP + user-agent captured before any MLS sold data reaches an authenticated user |
| Per-record Brokerage display | Shipped 2026-04-17 | VOW §6.3(c) compliance — `list_office_name` column on every sold record, rendered adjacent to the transaction |
| Public teaser-language audit | Complete 2026-04-18 | 14 "sold prices" phrasings neutralized across FAQ templates, homepage prose, and JSON-LD schema — removes ambiguity under strict §6.3(k) reads |
| Paid-traffic landing page (`/rentals/ads`) | Live 2026-04-26 | SKAG-aligned page that converts paid clicks into structured leads — hybrid H1 (dynamic from URL params or static + amber suffix), 2-step form, live TREB listings filtered client-side, comparison block, speed-to-lead badge, JSON-LD rich-results stack |
| Conversion tracking (gclid + UTMs + Google Ads `gtag`) | Live 2026-04-25 | Lead-level attribution from ad click → form submit → thank-you. Lead carries gclid, UTMs, referrer, UA, IP. Conversion `gtag` fires once on `/rentals/thank-you` mount keyed on `transaction_id=lead.id`. Awaiting real `AW-` ID/label values to unpause campaign. |
| GA4 (`G-5G7486M9M9`) | Live 2026-04-25 | Site-wide event analytics firing in production. Foundation for funnel reports + audience-building once paid traffic begins. |
| Google Ads "Milton Rental - Search" campaign | Built, paused | Manual CPC, $30/day, Milton-only, EN/HI/UR/PA, 1 ad group, 8 phrase-match keywords, RSA (15 H + 4 D), 7 sitelinks + call extension. Cannot launch until real conversion ID/label replace placeholders. |

---

## Growth Strategy

**SEO moat through scale.** 800+ hyperlocal pages (streets, schools, mosques, neighbourhoods) that no competitor will replicate. Each page has lead capture. Deal alert emails convert passive browsers into active clients.

**Funnel:** Google search → street/school/neighbourhood page → save listing → sign up → deal alert email → contact Aamir → booking

**Ad strategy:** $1,000/month Google Ads targeting high-intent Milton keywords. Pages exist to convert the traffic — not just rank organically.

---

## Key Strategic Decisions Already Made

- **Milton-only focus** — own one market completely rather than compete across all of GTA
- **Street pages as primary SEO vehicle** — 700+ pages targeting individual street searches
- **AI-generated content through compliance gatekeeper only** — legal requirement, not optional
- **Passwordless auth** — reduces signup friction, no NextAuth dependency
- **School and mosque pages as community filter pages** — targeting underserved searches
- **VIP Hub system** — high-inventory streets get premium treatment automatically
- **Design system locked** — deep navy + blue, premium Zillow-like aesthetic, no changes

---

## What Is Working

- Street pages indexed by Google
- MLS pipeline running nightly (sync, detect, generate, expire)
- Listings syncing from TREB via Ampre OData
- Compliance system fully operational (6/6 items live)
- Build passes cleanly (53 pages, zero errors)
- Auth system functional (passwordless email verification)

---

## Hard Blockers — Resolved

- **✓ PropTx IDX URL approval for miltonly.com** — cleared 2026-04-17. Gate lifted.
- **✓ VOW agreement #1848370** — activated 2026-04-16. Sold data pipeline licensed.
- **✓ VOW display compliance (Phase 2.5 + 2.6)** — SSR VowGate, acknowledgement quartet, Brokerage display, DB1 sold-field nullification, public teaser-language audit all shipped.
- **✓ Paid-traffic landing page** — `/rentals/ads` live 2026-04-26. Phase 1 + 2 + 2.1 complete.
- **✓ GA4 install** — firing in production since 2026-04-25.

## Active blocker — Google Ads campaign launch

**Real `AW-` conversion ID + label** — placeholder values are in Vercel env today; the "Milton Rental - Search" campaign is paused. Cannot unpause until the real ID and label are dropped into `NEXT_PUBLIC_AW_CONVERSION_ID` / `NEXT_PUBLIC_AW_CONVERSION_LABEL` and verified with one test submission. Otherwise paid spend runs against a `gtag` that fires to nothing and Google Ads receives no optimization signal. Real values expected 2026-04-29.

## Remaining operational to-do

1. **Drop real `AW-` ID/label, fire test submission, unpause campaign** — gated above. Highest priority — this is the difference between "ad infrastructure exists" and "ads spending money productively."
2. **A2P 10DLC registration for Twilio** — SMS pipeline is stubbed (`src/lib/twilio.ts`, live send commented out). Once 10DLC is approved, uncomment and verify with one real submission. Speed-to-lead promise on `/rentals/ads` ("Aamir replies within 60 min") works without SMS but works better with it.
3. **Remove early-launch lead-count safeguard** — `/rentals/ads` floors the "X Milton renters got matched this week" counter at 12 when real lead count < 5. TODO in `page.tsx` to remove after week 4 of paid traffic.
4. **Alert email placeholder** — sender address still points at placeholder; swap in production sender before deal-alert emails go to users.
5. **Home-valuation tool** — highest-ROI seller lead magnet per prior advisor audit; VOW data + DB3 analytics now enable a real instant-estimate flow.
6. **Monthly market report generator** — Phase 2 roadmap item; deferred but increasingly warranted now that the sold pipeline is clean.
7. **Tier 2 street-content consolidation** — `street-content.ts` and `generateStreet.ts` are parallel implementations; TODO flagged in source; fold one into the other before the next Phase-level compliance pass.
8. **90+ PageSpeed audit** on the live site (now matters more — paid traffic lands on `/rentals/ads`; LCP and CLS directly affect Quality Score).

---

## Do Not Reopen

These decisions are final. Do not debate them:
- Milton-only focus (no GTA, no Halton Region)
- Design system (colours, typography, spacing)
- Compliance architecture (AI gatekeeper, display gate)
- Passwordless auth (no passwords, no Google OAuth)

---

## Open Questions Right Now

- **Day-1 paid-launch playbook** — once `AW-` values land, what's the cadence: turn campaign on Monday morning, watch for first 50 clicks, manually review the first batch of leads, then decide whether to lift the daily cap?
- **Conversion-ID handoff** — confirm the exact mechanism for getting the real `AW-` ID + label out of the Google Ads conversion screen and into Vercel env without typo risk (single character drift breaks the firing path silently)
- **Bid strategy after first 30 conversions** — Manual CPC is fine for cold start; once Google has 30+ conversions in the account, Maximize Conversions or Target CPA become viable. What threshold justifies switching?
- **SKAG variant coverage** — current campaign has 1 ad group, 8 keywords. Once volume proves out, do we expand into bedroom-specific or property-type-specific ad groups using the dynamic H1 already built?
- Realtor outreach — first wave sent yet, or still planning
- Google Business Profile — optimized for "Milton real estate" + "real estate agent Milton Ontario"
- Google review acquisition — how many reviews live today, and what's the ask plan for existing clients
- Biggest blocker to first organic booking (vs paid): ranking, conversion, or funnel gap
- Home-valuation tool sequencing — MVP now vs after monthly market reports
- Market report cadence + format — static blog posts, dynamic page, email?

---

## Where Strategic Advice Is Most Valuable

- Lead conversion strategy (page visit → saved search → deal alert → booking)
- Content prioritisation (what pages to build next for maximum SEO impact)
- Google Ads keyword strategy refinement
- Post-launch growth playbook

---

## My Priorities and Style

- **Direct advice.** No preamble, no hedging, no "it depends."
- **ROI focus.** Every recommendation needs a clear payoff.
- **Systems thinking.** Build once, run automatically. Manual processes are technical debt.
- **Ship fast, audit after.** Perfect is the enemy of launched.
- **Settled decisions stay settled.** Don't revisit what's already decided unless new evidence demands it.

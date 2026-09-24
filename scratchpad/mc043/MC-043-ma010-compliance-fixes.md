# MC-043

CORE · D:\miltonly · main

**Shipped. Production serves `5f8cdb0`, and the full battery reads `PASS · 24 checks · 719 pages · 531s`.** One build carried the four compliance fixes and MA-010, merged by SHA. Every gate passed before the push:

- local gate, exit 0 on both commits (the final one in 615 s, 841 of 841 pages, 0 `P2024`);
- local battery, `PASS · 24 checks · 719 pages · 495s`;
- one preview, `miltonly-1bax8jetq`, `PASS · 24 checks · 719 pages · 650s`.

I spot-checked every fix on production (`scratchpad/mc043/prod-spot-checks.txt`). An adversarial review of the first fix commit found three real problems. All three are fixed in `5f8cdb0` (item 6).

1. **`/about` captions.** There are now two cards and no captions: **"RE/MAX Hall of Fame"** and **"Serving Milton Since 2011"**. The year is a literal 2011, never a duration. Every adjective is gone.
   - The 100% Club card is removed.
   - **The Executive Award card is gone as well.** Your spec is exactly two blocks, so nothing else fits.
   - **Layout:** a grid of two 274 px cards side by side from 640 px, stacked at 390 px, both 72 px tall. The trophy stays on the award card only, so the tenure card doesn't read as an award.
   - **Still live and left alone, because you named `page.tsx`:**
     - `AgentContactSection.tsx:27-29` lists "RE/MAX Hall of Fame Award / Executive Award / 100% Club Award" directly under the new block on `/about`, and on about 481 pages.
     - The same three awards appear in `AdsClient.tsx:330-332` and in the `/rentals/ads` JSON-LD `award` (`page.tsx:176`).
     - They also appear in `AgentSidebar.tsx:20-22` and in `/sell` (`sell/page.tsx:108-109`, which adds an em-dash and "one of the world's largest real estate brands").
     - "over 15 years" is in `/about`'s meta and hero (`:8`, `:25`), from `yearsExperience: 15`, which is static and goes stale in 2027.
     - The h2 "Awards & Recognition" now sits over one award.
   - **Your call:** remove the 100% Club, and the Executive Award too if you want, from those surfaces as well.
2. **The "only" claim is gone from all three sources.** The replacement is "Built exclusively for Milton, Ontario". The em-dash that introduced the claim went with it, and the rest of each string is unchanged. It reads cleanly as written, so I did not hold it for Aamir.
   - `config.ts:109`: "The Milton Real Estate Encyclopedia. Built exclusively for Milton, Ontario. Search homes…"
   - `layout.tsx:15`: "Milton Real Estate Encyclopedia. Built exclusively for Milton, Ontario. Street intelligence…"
   - `schema.ts:11`: "Built exclusively for Milton, Ontario. Street intelligence, neighbourhood comparisons…"
   - **Reach:** twitter:description on 534 pages (the 09-23 count of 537 included listings that have since left); og:description on `/` and the 22 hubs; the RealEstateAgent JSON-LD on about 127 pages; the root description on `/`.
   - The homepage meta is still 226 characters, a pre-existing length finding (MA-010 #11).
   - **Other "only" claims of the same shape** live only in dead code with no importer: `sections/HeroSection.tsx:147` and `:206`, and `sections/IntelligenceCentre.tsx:133`.
   - **Live claims of a different shape, worth a compliance look:**
     - "Your Milton Real Estate Expert" and "Milton Specialist" (`AgentContactSection.tsx:13`, `:35`);
     - "Get Matched by a Local Expert" (`/rentals/ads`);
     - "world-class negotiating" (the ad landing pages, noindex);
     - "the most detailed real estate resource ever built" (`/coming-soon`, noindex).
3. **"RE/MAX Realty Specialists Inc., Brokerage" now renders in full at every site where the brokerage names itself.**
   - **Listings:**
     - the listing contact line (`ListingDetailClient.tsx:438`);
     - the separation line on five surfaces;
     - **on our own office's listings, the "Listed by" line on every card and price line**, plus the source line, the Brokerage fact row and the JSON-LD `seller`. This is one rule in `brokerageDisplayName`. There are 80 own-office listings public today (26 for sale, 54 for lease); other offices keep the feed's name.
   - **Pages:**
     - the agent strip (`AgentContactSection.tsx:21`);
     - `/exclusive` and its detail pages, which printed "Inc..";
     - `/sold`'s VOW notice;
     - `/rentals`, `/rentals/ads` and its JSON-LD `worksFor`.
   - **Elsewhere:**
     - both thank-you footers, and both vCards, whose `ORG:` now escapes the comma (vCard 3.0);
     - the `/listings` showing FAQ, where the visible copy and the JSON-LD still match. That line also lost two em-dashes.
   - **The own-office test:** `isOurBrokerage` keeps its own comparison key, because the feed spells our office "RE/MAX REALTY SPECIALISTS INC." with no descriptor. All 146 own-office rows still match.
   - **The separation line reads:**
     - own listing: "Contact Aamir Yaqoob of the listing brokerage, RE/MAX Realty Specialists Inc., Brokerage";
     - other listings: "Contact Aamir Yaqoob (RE/MAX Realty Specialists Inc., Brokerage), not the listing brokerage (…)".
   - **Left, on purpose:**
     - `vow-acknowledgement.ts:22` still says "RE/MAX Realty Specialists Inc." MP-006 (`feat/portal @ e622c96`) restores it as terms VERSION 4. Editing the text on `main` would change a stored agreement without a version bump.
     - `VowComplianceNotice`'s default is dead code.
     - The `/rentals/ads` LocalBusiness name "Aamir Yaqoob — Milton Real Estate Agent | RE/MAX" is a business name with the brand, not the brokerage name, and it carries an em-dash.
     - The nav menu card's ellipsis can visually cut the longer name.
   - About 25 other sites already printed the name in full.
4. **Homepage FAQ: removed from the schema, not rendered.**
   - **All six questions were schema-only, not one.** `FAQSection.tsx` has no importer.
   - **Every answer breaks a house rule:** an em-dash, "average", "best", "most popular", "top-ranked".
   - **They describe things the site does not have:** four features (a comparison tool, an investor report, a school-zone search, a GO filter).
   - **They contradict the page:** "$1,125,000" and "18 days" against the page's typical $927,000 and 28 days.
   - **Rendering them would fail the battery's homepage em-dash check.** FAQ rich results no longer show for a site like this one.
   - **What `/` keeps:** Organization, RealEstateAgent, WebSite with SearchAction, and BreadcrumbList.
   - **Catchment: yes, it needs a separate task,** though nothing live carries it after this change. No gate reads catchment wording in JSON-LD:
     - `catchment.mjs` reads head fields only;
     - the nightly's JSON-LD walk runs the superlative rule only.
   - The task: Audit adds the CATCHMENT patterns and an "only"/exclusivity rule to that walk. Optionally, Core has `catchment.mjs` read JSON-LD text.
5. **MA-010 is merged by SHA.** `794ef5a` landed as `60295f2`.
   - It carries MA-009 (`846f187`, `scripts/audit/lh-repeat.mjs`, audit-only) as an ancestor.
   - The branch tip `eb9089e` (MA-010's report and handoff, docs only) is **not** merged; that is Audit's to land.
   - `test-voice-rules.mjs` passes 1,032 assertions. The nightly runs it from `main` starting tonight at 03:00.
   - The `.github/workflows/` change built, as MA-010 said it would, so it rode in this same build.
6. **The review.** Four lenses, with two skeptics per finding. Three findings were upheld, and all three are fixed in `5f8cdb0`:
   - own-office listings still printed the short name;
   - my first separation line put "the listing brokerage" on the salesperson;
   - the stacked cards were 72 px and 56 px tall.
   - **Six were refuted**, including the 226-character meta, which is out of scope.
7. **For the other tiers.**
   - **Home:** I edited `AgentContactSection.tsx:21`.
   - **Leads:** I edited `RentalsClient.tsx`, `AdsClient.tsx`, both thank-you clients and `rentals/ads/page.tsx`.
   - **Portal:** `sold/page.tsx:311` changed, next to MP-006's `:310`. Expect a conflict and keep both sides.
   - **Stale branches:** `feat/about-quick-fix` and `feat/about-world-class`, both from 2026-05-19 and never merged, touch the same `/about` files.
   - **Untouched, as instructed:** own-brokerage listing remarks, the listing `<title>` template, and the nightly's link budget.

Report: scratchpad/mc043/MC-043-ma010-compliance-fixes.md

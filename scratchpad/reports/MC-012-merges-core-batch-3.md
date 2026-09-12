# MC-012
D:\miltonly · main (the batch on `fix/core-batch-3`, not merged)

## MC-012: three merges landed; core batch 3 built on `fix/core-batch-3`, preview 15/15

### 1. Three merges by SHA, full gate: done

| SHA merged | merge commit | build | package.json |
|---|---|---|---|
| `1b4ab5d` fix/judge-rulings | **`3d905a6`** | exit 0 | clean |
| `e205757` feat/leads (the weekly leads digest) | **`798f610`** | exit 0 | prebuild unioned, 30 + 1 = 31 |
| `5e7a3e3` feat/content-2 (parking and GO guides) | **`94ddc49`** | exit 0 | prebuild unioned, 31 + 1 = 32 |

Each pushed in turn; production serves `94ddc49`.

### 2. Core batch 3, `fix/core-batch-3` at head **`bf4f8b3d3f3014bbf6d98ad564ca25757a37d381`**, built exit 0, pushed, not merged

**(a) Name the board, never the family.** Both prompt docs' school rules now say it, with "for Catholic families" named as the phrase not to write; the judge read that as `religion` three times on 09-11.

**(b) The judge cannot fail a page on a finding it labels not a violation.** `parseJudgeReply` drops any finding whose class says "not a violation" / "no violation" / "not a finding"; a refusal whose findings were all such labels passes (barclay-circle's round 1); a refusal with a real finding beside a label still refuses on the real one; a refusal with no findings at all stays a refusal, fail-closed.

**(c) Hub titles and descriptions lose their em-dashes.** `hubMeta.ts` now writes `Beaty, Milton: Homes, Prices and Street Guide` and `… what they really sell for: typically $970,000, 185 sales in the last 12 months.`; the rural no-hook branch likewise. The stored `HubContent.metaTitle` had been winning as a title fallback and carried the old dash, so `hubLive.ts` now serves the live formula for the title as it already did for the description. The `hub-meta` check reads the `<title>` as well and asserts neither carries an em-dash (22 hubs, 0 on preview).

**(d) `/rentals?neighbourhood=<hub slug>`.** Resolved through the hub's `Neighbourhood.rawStrings` (`src/lib/rentalScope.ts`), scoping the 48 listings, the available count and every per-category average; the H1 and title name the hub, with a link back to all of Milton; the canonical stays `/rentals`; the town-wide `data-fig="rentals-available"` the homepage gate reads is emitted only on the unscoped page (the scoped page emits `rentals-available-in-hub`). The hub's "I'm renting" square points at `/rentals?neighbourhood=<slug>`. On preview: Beaty 88 of Milton's 1,138.

**(e) `/neighbourhoods/<slug>/streets` 301s to the hub's `#streets`** (middleware, `301`, query dropped); the route, its theme and its data module are retired (`src/lib/retired/`, `src/components/neighbourhood/retired/`); the sitemap no longer declares it; the hub's "View all streets" link now goes to `/streets`. Preview: `/neighbourhoods/beaty/streets` answers `301 …/neighbourhoods/beaty#streets`. Noted, not changed: the overflow page was the only hub-level inbound link for streets beyond the 12-row ladder; those streets now depend on `/streets`, the geometry links and the guides.

**(f) Parking and GO up-links.** A hub holding a pilot park carries the parking guide; a hub whose polygon edge lies within 1,600 m of Milton GO carries the GO guide; a street inherits its hub's answer and declares the hubs it decided from on the ledger (`data-hubs`). The two rules are the guides' own (`parking.ts`, `goTransit.ts`), computed once in `uplinks.ts` from the same layers. The `guide-links` check derives both hub sets from the guide pages' own `g-links` blocks and holds every hub and every street against them in both directions, and refuses a street that declares a hub it does not link to. On preview: 12 parking hubs, 7 GO hubs, 382 street pages with the parking guide, 221 with the GO guide, 2,084 guide anchors on 489 streets, 74 on 22 hubs.

**(g) `sources-fresh`, the 15th battery check.** Reads `src/data/sources/goGtfsMilton.ts` (feed `20260910145058`, valid 2026-09-10 to 2026-11-27) and `miltonParking.ts` (7 Town pages, fetched 2026-09-11, 90-day window) and fails when either window has closed. It will fire on 2026-11-28 and on 2026-12-11 by design; the fix then is the refetch, not the check.

**Prebuild case:** `scripts/test-core-batch-3.ts`, 57 assertions across the seven changes (pure for b, c, f, g; structural for a, d, e), in prebuild (33 guards).

**Preview `miltonly-7ww1qj1xh` at `bf4f8b3`, battery:** **`PASS · 15 checks · 489 pages · 282s`**, exit 0, `served == expected`.

### Files
- main: `3d905a6`, `798f610`, `94ddc49`, and this docs commit
- `fix/core-batch-3` (`f148c6c`, `bf4f8b3`): `docs/phase-4.1/{01,03}-*.md`, `src/lib/ai/compliance.ts`, `src/lib/ai/hub/hubMeta.ts`, `src/lib/hubLive.ts`, `src/lib/hubData.ts`, `src/lib/rentalScope.ts`, `src/app/rentals/{page,RentalsClient}.tsx`, `src/middleware.ts`, `src/app/sitemap.ts`, `src/components/hub/sections.tsx`, `src/lib/guides/uplinks.ts`, `src/components/guides/GuideUplinks.tsx`, `src/components/street/v2/{StreetPage,StreetMinimalPage}.tsx`, `src/components/hub/HubPage.tsx`, retired: `src/lib/retired/neighbourhoodStreets.ts`, `src/components/neighbourhood/retired/NeighbourhoodStreets.tsx`; battery: `scripts/verify/checks/{sources-fresh,guide-links,hub-meta}.mjs`, `run.mjs`, `README.md`; `scripts/test-core-batch-3.ts`, `package.json`
- record: `scratchpad/mc003/battery-batch3-preview.log`

### Next
Stopped. `bf4f8b3` by SHA, your call.

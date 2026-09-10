# 062 — Content tier Gate A recon

CONTENT · D:\miltonly-content · feat/content · no code written

Scope of this worktree: guides + everyday-life tier, and the Market Watch weekly
edition. Own tables, own routes, generation through `compliance.ts` under the
cheap-first rule. It never writes street, hub or condo rows, never touches
header/footer or homepage.

---

## 1. What content infrastructure exists

### 1.1 Guides — a finished layout with no data, no route, no table

`src/components/guides/` is complete and unwired:

| file | lines | what it is |
|---|---|---|
| `types.ts` | 72 | **declares itself "THE SEAM"** |
| `sections.tsx` | 244 | 8 exported sections (hero, categories, takeaways, body, faqs, related, dual CTA) |
| `guides-theme.css` | 536 | on-token: `#073126`, `#017848`, `#00ff80`, `--g-serif: 'Fraunces'` |
| `mockData.ts` | 235 | fixture only |
| `icons.tsx` | 32 | category icons |
| `GuidesIndexPage.tsx` / `GuideArticlePage.tsx` | 15 / 25 | composers |

The seam is named in the file: the data window must implement
`getGuidesIndexData(): Promise<GuidesIndexData>` and
`getGuideArticle(slug): Promise<GuideArticleData | null>`. **Neither exists.**

Routes: only `/guides-preview` and `/guide-preview`, both
`robots: { index: false, follow: false }`, both fed from `mockGuidesIndex` /
`mockGuideArticle`. There is **no `/guides` and no `/guides/[slug]`**, no sitemap
entry, no JSON-LD, no canonical.

`GuideCategoryKey` is fixed at `buying | selling | renting | living`.
**The everyday-life tier already has its slot in the type.**

**`mockData.ts` carries 16 em-dashes.** The voice rule bans them. Whatever fills
the seam must not inherit the mock's register, and the guide validator has to
carry the same punctuation ban the street prompts do.

### 1.2 Content tables — none

25 models in `prisma/schema.prisma`. Nothing for guides, articles, editions or
posts. The pattern to copy is `StreetContent` + `StreetGeneration` +
`StreetGenerationReview`: a content row, a generation audit row carrying
`inputJson`, and a fail-closed review queue.

### 1.3 Market Watch — absent

Zero hits for `market watch` / `weekly edition` / `marketwatch` across `src`,
`scripts`, `prisma`, `docs`. Nothing to extend. It is a new surface end to end,
including its layout.

### 1.4 Pages that already own content intent

This is the cannibalisation map, and it changes the guide list in section 2.

| route | in sitemap | what it already owns |
|---|---|---|
| `/sold` | yes | **"sold prices milton"** — `getMiltonSoldAggregates()`: 12-mo median + mean, p25–p75 band, avg DOM, sold-to-ask, by type, by neighbourhood, 5 quarters |
| `/condos-guide` | yes | **"condos in milton"** — its title is literally `Condos in Milton, Prices, Fees & Condo vs Freehold` |
| `/freehold`, `/potl`, `/compare`, `/compare/freehold-vs-condo` | yes | the tenure axis, all four through `getTenureHubData` |
| `/schools` + 31 school pages | yes | **"schools"** — `src/lib/schools.ts`, hardcoded |
| `/sell`, `/value/[neighbourhood]`, `/rent`, `/rentals` | partly | seller and rental intent |
| `/blog` | **no** | deliberate noindex placeholder: no posts, no MDX, no generator, no DB |

### 1.5 Generation path

- `src/lib/ai/compliance.ts`, 2,038 lines. `assertPromptSafe` is called **inside**
  `callClaude` and `callDeepSeek` — the choke sits at the transport, so a new
  caller inherits it without a new call site.
- **Cheap-first is the default, not a policy.** `resolveSimpleMode()` returns
  `deepseek` for anything unset; `AI_PROVIDER_{MARKET,AHA,EVAL}` are the opt-in to
  Claude per half. Production runs `AI_PROVIDER_MARKET="haiku"`.
- `AI_PROVIDER` must be set (`phase41_v2`); prebuild
  `test-ai-provider-failclosed.ts` guards it.
- `generatePhase41StreetContent` runs three halves in parallel through
  `runHalfWithRetry`, 5 attempts each, with zero-price, section-suppression and
  thin-data preambles prepended per branch.

### 1.6 The gate that decides the build cost

**Every rule in `validateStreetGeneration.ts` is typed on `StreetGeneratorInput`.**
`findUngroundedNumerics`, `findZeroTierPrices`, `collectGroundedFigures`,
`findSubkRangeReassembly`, `findTemporalPairings`, `findPerTradeFabrications` all
read `input.aggregates`, `input.quarterlyTrend`, `input.crossStreets`. **None of
them can validate a guide or an edition until that content carries a grounding
input of the same shape.** This, not the prose, is the work.

Rules that transfer unchanged because they read text only:
`findSalesRegisterLeak`, `findFairHousingRegister`, `findMixedPoolClaims`,
`findSpatialPrecisionClaims`, `findFuturePeriodClaims`, `findMarketTemplateParrot`,
`catchmentVocabulary`, the em-dash ban.

### 1.7 Gates and plumbing

- `pnpm build > build.log 2>&1`, exit code only. **19 prebuild tests** chained in
  `package.json`. A content surface adds the 20th.
- `/api/revalidate` reads `REVALIDATION_SECRET`, not `CRON_SECRET`.
- `vercel.json` carries **13 crons**. Weekly slots already taken:
  `sync/regenerate` Sun 12:00, `seo/sense` Sun 09:00, `seo/digest` Mon 10:30.
- Battery `scripts/verify/run.mjs` takes the **full 40-character SHA**.

### 1.8 Live data endpoints the content tier can read

- `getMiltonSoldAggregates()`, `src/lib/soldAggregates.ts`. Deterministic, no LLM,
  k-gated at `K_ANON_PRICE=5` and `K_ANON_RANGE=10`, `round5k`, upper-bounded at
  `NOW()` per DEC-SOLD-UPPER-BOUND. The aggregate **kind** matches the linked
  sibling: Milton-wide is a median, each neighbourhood row is the hub's own mean.
- `/api/content/v1/market/daily-summary` — yesterday only, America/Toronto, sales
  and leases split, by neighbourhood, `permAdvertise && displayAddress`. Its own
  header warns that only `sold` has a true close date; leased, terminated and both
  expired buckets proxy on `updatedAt`.
- `/api/content/v1/market/open-houses` — live AMPRE at request time, upcoming
  Sat to Sun via luxon, hard inner-join display gate on the local `Listing`, and
  the feed's `OpenHouseURL` is **never** returned.
- `src/lib/mortgage-math.ts` — `monthlyPayment`, `ontarioLTT`, `cmhcPremium`,
  `stressTestRate`. Deterministic given a rate. **There is no rate source in the
  repo.**

### 1.9 GSC is live and readable

`src/lib/seo/gscClient.ts`, property `sc-domain:miltonly.com`, service account,
`webmasters.readonly`. `runSense()` runs Sundays into `SeoOpportunity`
(`SEEN_NOT_CLICKED`, `STRIKING_DISTANCE`, `NO_PAGE_MATCH`, `THIN_ENTITY`),
carrying `prevImpressions`, `prevClicks` and `prevPosition` for week-over-week,
behind the `ORGANIC_LOOP_ENABLED` kill switch.

**So the eight guides below can be pinned to real impressions, position and
current `targetPage` before a line is written.** I did not query those rows this
pass. That is step one of Gate B, and it may reorder the list.

---

## 2. The first eight guide pages

Applied filters: do not cannibalise an indexable page that already owns the
query (answer a different question and link up, or do not build); every number
grounded or the page does not ship; and the three rules, SEO, conversion, and a
layout unlike industry norms.

### BUILD, 6

**G1 · How to read a Milton sold price**
Query: `sold prices milton`. Not a second `/sold`. `/sold` is the data; this is
how to read it — median against mean, sold-to-ask, DOM, and why a range needs
more sales behind it than a midpoint does.
Grounded: `getMiltonSoldAggregates()` in full, live, cited inline.
Risk: **medium-high, VOW teaser language.** The 2026-04 audit neutralised 14
public "sold prices" phrasings and `/sold` is the one surface explicitly cleared
to advertise sold data. This guide must reuse `/sold`'s register and link there
rather than re-advertise. No individual record at any n. Suppression is `null`,
never `0`.

**G2 · Is it a good time to sell in Milton**
Query: `is it a good time to sell`. Highest conversion intent of the eight;
`/sell?street=<name>#valuation` prefill already works through
`HomeValuationCard`.
Grounded: the 5-quarter median series, each row k>=5, plus avg DOM, sold-to-ask
and the active count.
Risk: **high, advice register and future claims.** `findFuturePeriodClaims`
exists for exactly this; the page describes the trailing window and refuses a
forecast. `findSalesRegisterLeak` bans "we", "our team" and "reach out", and a
page whose job is a CTA is the likeliest on the site to trip it. The CTA block
must be structural, outside any generated prose.

**G3 · What it costs to buy your first home in Milton**
Query: `first-time buyer`.
Grounded: `mortgage-math.ts` plus the k-gated typical price by type.
Risk: **medium, and it is the rate.** Every figure is deterministic *given a
rate*, and there is no rate source in the repo. Either the reader sets it or it
is a dated constant rendered with its date. A stale stress-test rate is a wrong
number on a money page. Ontario LTT needs the provincial rebate only; Milton is
not Toronto and the Toronto municipal LTT must not appear.

**G4 · Milton condo fees, parking and lockers**
Queries: `condos in milton` plus `parking`. Deliberately the fee-and-parking
half, because `/condos-guide` already owns the decision half. Links down to
`/condos/<slug>`.
Grounded: `CondoBuilding.parking / garage / locker / maintenanceFee`,
`Listing.parking / garageType / locker / rentIncludes`; 65 buildings, 59
published.
Risk: **medium.** Building names go through `src/lib/condoName.ts`; item 4's rule
extends here. **Open ruling needed:** a per-building fee is a population of one
*building*, not one sale, and `kAnon.ts` has no threshold for it. Either publish
fees only as a town-wide banded distribution, or get the ruling first.

**G5 · Milton schools, and what a school page can honestly tell you**
Query: `schools`.
Grounded: `src/lib/schools.ts`, 31 entries carrying board, level and
neighbourhood, plus computed haversine distance.
Risk: **high, and already ruled on.** `catchmentVocabulary.ts` bans catchment,
boundary, assignment, zone and feeder on **every** tier until Halton DSB and
HCDSB boundary data is sourced and wired, and the parent's real question, which
school my child will attend, is precisely the banned one. Buildable only as named
schools, board, level, distance, and an explicit statement that assignment is the
board's to confirm, with a link out. If that framing is not acceptable, this page
is not built.

**G6 · What each Milton neighbourhood costs**
Query: `milton real estate market`. Best link-down of the eight: 22 hubs, then
445 street pages, then address anchors.
Grounded: `getMiltonSoldByNeighbourhood()` and `getMiltonSoldByType()`.
Risk: **medium, the two-typicals trap.** Milton-wide is a median; each
neighbourhood row is a mean computed through the hub's own `saleAggQuery` so it
matches the page it links to, per DEC-GENI-1. The guide must carry the same
convention or it shows two different "typical" figures one click apart.

### HOLD, 2, and why

**G7 · Where you can park in Milton** — query `parking`.
**Do not generate.** The everyday-life tier's hardest case and its clearest
lesson. Town parking bylaws and municipal lots are **not in the repo**, and
on-street overnight parking is exactly what the `nightVideoUrl` column was added
for, per `StreetContent`'s own comment. A model asked to write Milton parking
rules will invent them, and no validator in the codebase can catch a fabricated
bylaw. Build it only after the Town parking layer is sourced the way
`townAddressPoints` was, or hand-write it from the bylaw with a citation.

**G8 · Freehold against condo against POTL.**
Data risk low: `getCompareContrast` already computes the live contrast.
**Duplication risk high:** `/compare/freehold-vs-condo`, `/freehold`, `/potl` and
`/condos-guide` are four live indexable pages on this one axis. Build only if GSC
shows the query landing on none of them.

### Reserve, if G7 and G8 stay held

- **How long homes take to sell in Milton** — DOM by type at k>=5. Grounded, low
  risk, and no existing page owns it.
- **What a Milton lease costs and what is included** — `Listing.rentIncludes` and
  the lease aggregates; the lease k-gates already exist in
  `buildCondoBuildingInput`. Check `/rent` and `/rentals` for overlap first.

---

## 3. Market Watch weekly edition

### 3.1 Sources

| source | role | shape |
|---|---|---|
| `getMiltonSoldAggregates()` | the anchor | trailing 12 months, already k-gated, deterministic |
| a **new week-window query** in the daily-summary shape | flow | see the caveat below |
| `/api/content/v1/market/open-houses` | the weekend | live AMPRE, display-gated |
| `Listing` (DB1) | actives, new listings, `listedAt`, `daysOnMarket` | live |
| `StreetContent` / `HubContent` / `CondoContent` | link-down targets | read-only, never written from here |
| `SeoOpportunity` | not a content source; it says which query the edition answers | read-only |

**Seven daily calls are not a weekly window.** The edition needs one week-scoped
query in the daily route's shape, not a stitch. Carry that route's own caveat
forward: only `sold` has a real close date, while `leased`, `terminated` and both
`expired` buckets proxy on `updatedAt`. The edition says so rather than implying
an event date it does not have.

### 3.2 K-gates, the hard part, stated plainly

A week is a small sample. Milton runs roughly 10 to 15 sales a week town-wide,
which means **most neighbourhoods and most property types are sub-k every single
week.**

- Town-wide weekly **count**: always published. A count alone is non-sensitive,
  which is `market-pulse.ts`'s own ratified posture.
- Town-wide weekly **median**: only at n>=5. Weekly **band**: only at n>=10. Both
  will suppress often, and suppression returns `null`, never `0`, never a dash
  standing in for a number.
- Neighbourhood-weekly and type-weekly medians: **do not publish at any n.** A
  rule that fires nine weeks in ten is not a rule anyone reads. Publish the weekly
  *count* per neighbourhood beside the **12-month** figure from
  `getMiltonSoldByNeighbourhood()`, each labelled with its own window.
- `kAnon.ts` says the floor is only half the rule: it must be checked against the
  **exact sample the figure is computed over**. A weekly figure guarded by a
  12-month k is not guarded.
- Individual sold prices: never, at any n, unauthenticated.
- Open houses carry no k question, being public and active, but the local
  `Listing` display gate is the entire safety net, because the edition publishes
  without a human in the loop.

### 3.3 Sections

1. **The week in one line.** Deterministic, generated from the data, never written
   by a model. The same discipline as the address-anchor summary sentence.
2. **Flow.** New listings, sold, leased, expired, this week against last. Counts
   only, and deltas as counts. A percentage on a base of 11 is noise.
3. **Price context.** 12-month median, band, DOM and sold-to-ask, each labelled
   with its window. The weekly median appears only when n>=5.
4. **Where it happened.** Per-neighbourhood weekly counts linking to
   `/neighbourhoods/<slug>`, each row's 12-month typical taken from the hub's own
   query so it cannot drift from the page it links to.
5. **Open this weekend.** Each entry to `/listings/<mlsNumber>`, never the
   brokerage URL.
6. **Streets that moved.** Streets with activity this week that have a published
   page, linking to `/streets/<slug>`. This is the link a street page cannot make
   for itself.
7. **One paragraph of interpretation.** The **only** LLM section. Cheap-first
   (DeepSeek), fed a grounding input carrying exactly the figures sections 1 to 6
   rendered, validated by the entity-neutral rules plus a numeric-grounding rule
   scoped to that input. **Fail-closed and non-blocking:** if it fails, the edition
   publishes sections 1 to 6 and drops section 7. The edition never waits on a
   model.

### 3.4 Cadence

- **Monday 06:00**, covering Monday to Sunday of the week just closed. Sun 09:00
  is `seo/sense`, Sun 12:00 is `sync/regenerate`, Mon 10:30 is `seo/digest`, so
  06:00 lands ahead of the digest and contends with nothing.
- Routes: `/market-watch` for the current edition, canonical for
  `milton real estate market`, and `/market-watch/<YYYY-MM-DD>` dated by the
  Monday. The archive is the compounding asset.
- **An edition is immutable once published.** A weekly figure that changes
  retroactively is worse than a suppressed one. Late-reported sales land in the
  next edition, stated as such.
- Every successful write revalidates the edition, `/market-watch` and `/`, the
  same invariant `StreetContent` carries.

### 3.5 Link-down

```
/market-watch/<date>
  -> /neighbourhoods/<slug>        22 hubs
       -> /streets/<slug>          445 published
            -> #<houseNumber>      address anchors
  -> /condos/<slug>                names through condoName.ts
  -> /sold                         the full aggregate layer
  -> /listings/<mlsNumber>         open houses
```

Up-links from hubs and streets back to the current edition are what make the
archive compound instead of sit. **Those are hub and street writes and this
worktree does not make them.** They are a cross-worktree request, listed below.

Sitemap: editions get entries. How far back is submitted is a Gate B decision.

---

## 4. Decisions needed before any code

1. **`MarketEdition` plus `MarketEditionGeneration` tables, or compute at request
   time?** A dated, immutable, archived edition argues for a table: the edition
   *is* the artifact, not metadata about one. Recommend the table.
2. **Guides: `GuideContent` plus `GuideGeneration`, or hand-authored?** Eight
   guides is not a scale problem. Recommend **hand-authored structure with
   generated figures** — `types.ts` already supports it, and it avoids porting
   30-plus `StreetGeneratorInput`-typed validators for six pages.
3. **The grounding-input shape for the one generated paragraph** (3.3.7). This is
   the real build cost and it should be scoped explicitly, not inherited.
4. **The per-building condo fee ruling** (G4). `kAnon.ts` has no threshold for a
   population of one building.
5. **The mortgage rate source** (G3).
6. **Whether G5 ships under the catchment ban's framing**, or not at all.
7. **Up-links from hubs and streets** — a cross-worktree request, not this
   worktree's write.
8. **Pull the real GSC rows for the eight queries** before fixing the order.

**No code until sections 2 and 3 are approved.**

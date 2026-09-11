# MC-003
D:\miltonly · fix/core-batch-2

## MC-003 core batch 2: built, on preview, battery green, awaiting merge approval

**Code commit:** `5ebe87a08402585cdb6d0a028ec7500ed2956f29` on `fix/core-batch-2`, pushed; the build, the preview and the battery below are that commit. One docs commit sits on top of it (HANDOFF, QUEUE, this report, and a colon for a dash in the fee guard's log line).
**Preview:** https://miltonly-ghmke31mh-gtahomequest-hubs-projects.vercel.app, `/api/build` answers `5ebe87a0…`.
**Local gate:** `pnpm build`, exit 0 (24 prebuild guards, the new one included).
**Battery on preview, full SHA:** `PASS · 12 checks · 449 pages · 116s`, exit 0, `served == expected`.
**HANDOFF correction applied:** Leads Phase 2 is on main as `543ef99`; nothing pending from `feat/leads`.
Not merged. No merge to main without your approval.

### 1. Guide up-links, done

Every street page (the full shell and the minimal shell) and every hub (22 neighbourhood hubs and the three tenure hubs) now carries a "Guides" ledger: a numbered reading list, category in mono, title in Fraunces, dek beneath. Server-rendered `<a class="g-up-link" href="/guides/…">` anchors, selected from `GUIDE_DEFS` in `src/lib/guides/uplinks.ts` so no title or slug is written twice.

| surface | guides |
|---|---|
| every street page | sold-price literacy, first-time buyer, schools |
| condo-heavy street page | the three above plus condo fees |
| every hub | neighbourhood costs, schools |
| condo-heavy hub | the two above plus condo fees |

"Condo-heavy" is decided from what the page itself renders, so the battery derives the same population from the served HTML: a street with a condo **sale** pill (the lease pill is also typed `condo` in the seam, so the match is on the pill label), a hub that renders the condo-buildings section or carries a fee. On preview: **13 condo-heavy streets, 11 condo-heavy hubs**.

New battery check `guide-links` (the 12th): **1,360 anchors on 449 street pages** (449 × 3 + 13) and **55 on 22 hubs** (22 × 2 + 11), every required guide present, condo guide exactly on the condo-heavy population in both directions, all five destinations answering 200. Placement: streets after "Around <street>" and before the FAQ; hubs after the FAQ and before "Nearby".

### 2. maintenanceFee, done, and the writer does not exist

`Listing.maintenanceFeeAmt` (Float) is now the only fee column read anywhere. The identifier `maintenanceFee` appears nowhere under `src/`: the presentational fields that shared its name (`CondoOwnership`, `CondoFeeRow`) are renamed `monthlyFee`, and `scripts/test-fee-column.ts` runs in prebuild and fails on any word-bounded `maintenanceFee` in code (comments stripped first). 475 files walked, 0 hits.

**The one place that wrote the dead column: there is none.** `Listing.maintenanceFee` (Int) was declared in `c0a694e` (2026-04-09, "Rebuild listing detail page") in the same commit that added `maintenanceFeeAmt` and the sync line `maintenanceFeeAmt: item.AssociationFee || null`. No sync, script or route in the repo's history has ever assigned the Int column; `git log -G'maintenanceFee[^A]'` finds only reads and declarations. Measured today: **NULL on all 3,394 `Listing` rows**, 0 non-null, 0 zero. The figures.ts note that called it "0 on all 73" was reading a falsy null as a number; the note is corrected. The only read it ever had was the condo-fees guide query in `a3cc4e9`, fixed in `aacc652`. The column stays in the schema, annotated DEAD; dropping it is a migration and was not asked for.

### 3. sold_date UTC-midnight stamping, reported and stopped

**Who writes it:** `src/lib/vow-sync.ts:482` in `mapAmpToSoldColumns`, `sold_date: soldDate`, where `soldDate` is `resolveSoldDate(CloseDate, PurchaseContractDate)` returning the feed's string verbatim, bound into a `TIMESTAMPTZ` column through a Neon session whose `TimeZone` is `GMT`. The feed value is a calendar date with no time, so every row lands at 00:00:00 UTC: **8,596 of 8,596 rows**, one distinct time of day. `close_date`, `contract_date` and `list_date` are stamped the same way.

**Can it carry the true Toronto date:** the feed's date **is** the Toronto calendar date (on the 206 contract-dated rows with an entry timestamp, the Toronto-local entry day is never earlier than the stored date), so the true date is known. What the stamp cannot do is survive a Toronto-zone read: `(sold_date AT TIME ZONE 'America/Toronto')::date` is the previous day on **0 of 8,596 rows agreeing**, every row reads one day early.

**Why it is not a one-line write change:** the line itself is one line (`'<date> 00:00:00 America/Toronto'`), but it would put two bases into one column against 8,596 rows stamped the other way, leave three sibling date columns on the old basis, and invert Market Watch, which already carries an explicit UTC-midnight basis for this column (`src/lib/marketWatch/windows.ts`, "TWO BASES FOR ONE WEEK"). Doing it properly is a restamp of every row plus a re-basing of every window reader. Stopped, as instructed. The read-side rule that is correct today: treat `sold_date` as a date (`::date` in a GMT session, or UTC-midnight bounds), never as an instant.

**One live consequence, in Leads' file:** `src/lib/brief/compose.ts:140` bounds `sold_date` with the brief window's Toronto instants (`win.start` = 04:00Z). For Toronto Wednesday 2026-09-09 that selects rows stamped 2026-09-10 00:00Z and drops the 09-09 rows: **8 sales dated 09-09, the brief's window returns 3**. The fix is Market Watch's: use the date basis for this column. Flagged for Leads; not touched here.

### 4. The 249-page programme, first five URLs and their judge results

Built 2026-09-10 by `scripts/create-street-pages-local.ts`, DeepSeek, between 07:14 and 07:18 Toronto (11:14–11:18Z), all five live on production today. "Judge" is the fair-housing semantic judge in `compliance.ts` (`.judge-log.jsonl`); "attempts" is the validator's retry count from `StreetGeneration`.

| # | URL | attempts | words | judge |
|---|---|---|---|---|
| 1 | https://miltonly.com/streets/agnew-crescent-milton | 2 | 1,121 | round 1 FAIL, two `buyer-class suitability` spans ("Buyers looking for a specific housing type will find options across all three", "Buyers weighing a townhouse against a detached home will find the two streets above worth a look"); round 2 PASS |
| 2 | https://miltonly.com/streets/dalgleish-garden-milton | 3 | 1,167 | round 1 PASS |
| 3 | https://miltonly.com/streets/landsborough-avenue-milton | 3 | 1,079 | round 1 FAIL, one `occupation` span ("For a household splitting its working life between Milton and points east or south…") and two `buyer-class suitability` spans; round 2 PASS |
| 4 | https://miltonly.com/streets/willmott-crescent-milton | 1 | 1,128 | round 1 PASS |
| 5 | https://miltonly.com/streets/satok-crescent-milton | 3 | 1,004 | round 1 PASS |

Cost across the five: $0.0474. No `StreetGenerationReview` row on any of them. Nothing has been created since (5 rows with `createdAt` ≥ 2026-09-10, none on 09-11); the programme is paused as HANDOFF records, and the 249 candidates sit in `StreetQueue` as `ineligible` after the 09-11 15:00Z cron pass, not `pending`, so a prompt fix alone will not resume it: the rows need re-queueing.

### Gate A · QUEUE item 5, geometry backfill (no code)

Measured over the 449 published streets (`scratchpad/mc003/gate-a-geometry.ts`, output in `gate-a.out`). Layers: Town of Milton Roads centreline (3,293 segments, pulled today) and the OSM export at `D:/dashcam/work/milton-roads.geojson` (2,963 ways). **447 of 449 match the Town layer, 414 match OSM, 414 match both, 2 match neither** (`second-line-milton`, `pears-court-milton`).

| field | Town layer | OSM | coverage over 449 | note |
|---|---|---|---|---|
| solar exposure | not a field | not a field | bearing computable on 447 | derived from centreline bearing only, never imagery. **178 of 447 have no dominant axis** (curved; axial resultant < 0.6). Milton's grid is rotated off north, so a compass bin is misleading: 258 read "diagonal". Publish the axis as a bearing or a two-compass-point phrase, or not at all for curved streets |
| surface | not a field | `surface` | 391 (OSM) | 1 street mixed; values asphalt on nearly all, dirt/gravel on rural lines |
| lanes | `LANES` | `lanes` | 440 (Town) · 379 (OSM) | 13 Town streets carry more than one value across segments; 11 disagree between layers |
| sidewalk | not a field | `sidewalk`, `sidewalk:left/right/both` | 307 (OSM) | **85 mixed along the street** (left on one block, none on the next); a single value per street is wrong for those |
| maxspeed | `SPEED_LIMIT` | `maxspeed` | 447 (Town) · 64 (OSM) | 28 Town streets carry more than one limit; 13 disagree between layers where both exist. Town is the authority |
| length | geometry | geometry | 447 (Town) · 414 (OSM) | 19 disagree by more than 20 % (OSM ways extend past the Town boundary, or the Town splits a name across discontinuous stubs) |
| terminus | derivable | derivable | 53 dead-ends (Town) · 65 (OSM) | a dead-end node inside the layer; **`guelph-line` and `lower-base-line` count because they leave the Town boundary**, so a cul-de-sac needs a boundary guard or the Town `CATEGORY`/type (court, close) alongside |

Also available and not asked for: Town `CATEGORY` (LOCAL / COLLECTOR / arterial / HIGHWAY / PRIVATE) on 447, `PLOWCLASS`, `ONEWAY` (2 segments town-wide), OSM `lit` on 129.

**Where each renders on the street page.** The at-a-glance grid is fixed at 12 tiles and every one is market data; these are not market data and should not displace one. The honest home is the sidebar facts list (`StreetSidebar.facts`, label/value, absent when unknown), which is the layout's designated place for a street's physical facts and today carries neighbourhood, type and name. Length, lanes, speed limit, surface and road category as facts; sidewalk and terminus as facts only where the value is single-valued for the whole street; orientation as a fact only where a dominant axis exists. The minimal shell has the same facts list. Attribution line (OGL Milton) already exists for Town data.

**What the validator needs so none of it becomes a prompt figure.** `numeric_ungrounded` fires on the market section only and matches money and counts; "a quiet 400-metre crescent" from a 620 m centreline, "a 40 km/h street" from a 50 limit, or "two lanes" on a four-lane collector would pass today. Rule: **geometry never enters `StreetGeneratorInput`.** It is rendered deterministically from the data layer, never offered to the model, and the validator gains a hard rule that any unit-bearing figure in generated prose (metres, m, km, km/h, lanes, mph) is ungrounded by construction, since no input carries one, with the same masking of grounded proper nouns the superlative rule uses. The prebuild guard asserts the input type has no geometry field and the rule fires on a fixture. Then the model cannot distort what it never saw.

**Recommendation for the build:** Town first for lanes, speed, length, category and centroid (447), OSM for surface and sidewalk (391 / 307) with per-street single-value checks, terminus only with the boundary guard, orientation only above the axis threshold. Every field nullable, absence rendering nothing, and no figure of any of it in a prompt.

### Files
- new: `src/lib/guides/uplinks.ts`, `src/components/guides/GuideUplinks.tsx`, `guide-uplinks.css`, `scripts/verify/checks/guide-links.mjs`, `scripts/test-fee-column.ts`
- changed: `StreetPage.tsx`, `StreetMinimalPage.tsx`, `HubPage.tsx`, `TenureHubPage.tsx`, `condo/{types,sections,mockData}`, `condoData.ts`, `guides/{guides,figures}.ts`, `prisma/schema.prisma` (comment only), `package.json` (prebuild), `scripts/verify/{run.mjs,README.md}`
- record: `scratchpad/mc003/gate-a-geometry.ts`, `gate-a.out`, `battery-preview.log`

### Next
Your call on the merge of `5ebe87a` (by SHA). Open beside it: the brief's sold window (Leads), the `differentPriorities` prompt fix and a re-queue of the 249 `ineligible` rows before the programme can resume, and QUEUE item 5 on the Gate A rulings above.

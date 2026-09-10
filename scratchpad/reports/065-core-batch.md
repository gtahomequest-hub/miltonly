# 065 · CORE batch before QUEUE item 5

**Worktree:** `D:\miltonly` (CORE) · **Branch:** `fix/core-batch`

**Head:** `abf9ef45d0e1fd8d389f0bb47ad040bdad8df39a`, branched from `e2d8476` after
`feat/homepage` landed on main (`a9546a7`).
**Preview:** `https://miltonly-5b9qn9rrs-gtahomequest-hubs-projects.vercel.app`
**Battery:** `PASS · 10 checks · 444 pages · 67s`, exit 0, `build abf9ef4 served == expected`, 0 FAIL.
**Not merged.** No production change.

---

## 1. List-price history

`Listing.priorPrice Int?` and `Listing.priceChangedAt DateTime?`, additive migration
`20260910120000_listing_price_history`. Two `ALTER TABLE ... ADD COLUMN`, no default, no index,
no backfill.

Written in `src/app/api/sync/detect/route.ts`, which is where DB1 listings are actually upserted
(`src/lib/vow-sync.ts` writes DB2, not `Listing`). Three conditions, all required:

- the row already exists. A create has no prior price, and taking the incoming price as the prior
  would manufacture a change that did not happen.
- the stored and incoming prices differ.
- both are `> 0`. `price: item.ListPrice || 0` writes a zero when the feed omits `ListPrice`, and
  a zero on either side is an absent number, not a reduction.

Deliberately **not** gated on `MlsStatus`. The existing `lastPriceChangeAt` is, and that is the
whole reason it could never support a drop: it records the board's label for the event, not the
event. A drop is now `priorPrice IS NOT NULL AND price < priorPrice`.

**Fields and one row after the next sync.** The sync has not run yet, so there is nothing to show
and nothing was fabricated to fill the gap. Both columns are NULL across every existing row right
now, which is the correct state: a prior price that was never observed is not knowable. The first
row appears when a listing changes price after 2026-09-10. **Ask for this again after the next
cron sync and it will be a real row.**

Three files carried comments asserting no prior price is stored, and two of them had removed
features over it. All three corrected in place, and both features deliberately left out:

- `src/lib/stats.ts` — the `getFeaturedListings` removal note, amended to say a drop is derivable
  now, forward only.
- `src/lib/listingsV2Data.ts` — the `priceReduced` badge stays out. The columns are empty today,
  so the badge would be absent from every card and the page would silently claim no listing in
  Milton has ever been reduced.
- `src/lib/homeSignals.ts` — the price-drop count stays out, same reason. A count taken today
  reads 0 Milton-wide and would publish "no reductions" as though it were a measurement.

---

## 2. Future-dated sold rows

### The field, and why

**`CloseDate`.** `mapAmpToSoldColumns` wrote `sold_date: closeDate` verbatim.

`CloseDate` is not the date of the sale. PropTx flips `MlsStatus` to `Sold` and `StandardStatus`
to `Closed` when a deal goes **firm**, and `CloseDate` then carries the **completion date the
parties agreed to**, routinely weeks or months out. So a firm-but-uncompleted sale was written
with a sold date in the future, and `StandardStatus = 'Closed'` made it look settled.

The evidence is unambiguous. On all 245 rows: `close_date = sold_date` (245/245),
`contract_date IS NOT NULL` (245/245), and `contract_date <= today` (245/245). Every one of these
sales had already been struck. Only the completion was pending.

### The count

**245, not 192.** The brief counted the `For Sale` half.

| | |
|---|---|
| future rows, total | **245** (all `perm_advertise = TRUE`) |
| `For Sale` / `MlsStatus` Sold | **192** |
| `For Lease` / `MlsStatus` Leased | **53** |
| furthest | **2027-01-29** |
| nearest | 2026-09-11 (tomorrow) |
| spread | 2026-09: 111 · 10: 103 · 11: 24 · 12: 6 · 2027-01: 1 |
| contract dates behind them | 2026-05-09 to 2026-09-08, every one in the past |

### The fix

`resolveSoldDate(closeDate, contractDate, today)` in `src/lib/vow-sync.ts`:

1. `CloseDate` today or earlier: the sale completed, use it.
2. `CloseDate` in the future: use `PurchaseContractDate`, the date the deal was struck.
3. Neither defensible: return `null`.

`sold.sold_records.sold_date` is `NOT NULL`, so on `null` the ingest loop **drops the row** and
picks it up on a later sync once it has closed. Nothing is invented, nothing is shifted, and
`close_date` still carries `CloseDate`, so the completion date is not lost. It is only stopped
from posing as the transaction date.

Prebuild guard `scripts/test-sold-date-not-future.ts`, 10 assertions including the property form:
no input produces a future `sold_date`. Registered in `prebuild`, which is now 20 tests.

### Windows bounded

`DEC-SOLD-UPPER-BOUND` and the B13 pass had already bounded most of the corpus. A full sweep of
every `sold_date >= NOW()` site found **four** still open, now bounded:

- `src/lib/sold-data.ts` ×3, the consumer record lists (`getStreetSoldList`,
  `getNeighbourhoodSoldList`, `getRecentSoldList`). 90-day windows, `ORDER BY sold_date DESC`.
- `src/lib/ai/buildCondoBuildingInput.ts`, `leaseRecordQuery`. 12-month, also `DESC`, capped at
  10, and it feeds the model.

The **28-day** window is `src/lib/board/computeBoard.ts` and was **already safe**: its SQL fetch
carries `sold_date <= NOW()` and every in-memory window carries `s.t <= nowMs`. No change needed.
Reported rather than assumed.

### Does any published figure change

**Yes, in two ways.**

**Now, from bounding.** All 245 future rows sat inside the 90-day consumer list window, and those
lists sort `DESC`. **145 streets had their "recent sales" list led by a sale that has not
happened.** That stops immediately.

**After the next sync, from re-dating.** All 245 rows land inside 12 months at their contract
dates; 238 land inside 90 days.

| | before | after |
|---|---|---|
| Milton-wide 12mo `For Sale` sample | 1,531 | **1,723** (+192) |
| Milton-wide 12mo typical | **$930,000** | **$930,000** (unchanged) |
| streets whose 12mo sample changes | | **145** |
| streets crossing **k5** upward | | **17** |
| streets crossing **k10** upward | | **9** |

The Milton-wide typical does not move. The k-anonymity crossings do matter: 17 streets become
able to publish a "typical" point that is suppressed today, and 9 become able to publish a range.
That is the suppression floor working on a larger and more accurate sample, not a loosened floor.
No k rule was changed.

**Existing rows were not repaired.** The brief said fix the sync and bound the windows; it did not
ask for a backfill, so none was run. The 245 rows keep their `CloseDate` until the next sync
re-upserts them, and the bounded windows exclude them meanwhile.

---

## 3. QUEUE item 7 · the minimum-data gate

`makeStreetDecision` read three clauses, all DB1: `totalListings`, `soldCount`, `activeCount`.
A street failing them was marked `ineligible` in `StreetQueue` and returned `skip_low_data`
**before `getStreetStats` was ever called** — and `getStreetStats` has read DB2 row existence as a
sixth source since `DEC-ZERO-SALES-TIER`. So a street whose whole transaction history lives in
DB2, the table that actually holds the record, could not be built or refreshed by the cron at all.
`tasker-court-milton` needed a manual force-regenerate to get a page.

The gate now calls the same `countRecordedTransactions` helper, **only when the DB1 clause has
already failed**, so a street that already passes costs the cron exactly what it cost before.

### Dry run

`scripts/dryrun-street-decision-gate.ts`. No writes — `makeStreetDecision` marks rows `ineligible`
as a side effect, so the script re-implements the clauses as pure counts over the same population.

Population: **706 `StreetQueue` rows** (239 done, 219 failed, 248 ineligible).

| | |
|---|---|
| old gate, `skip_low_data` | **256** |
| **new gate, `skip_low_data`** | **78** |
| rescued | **178** |
| of those, already published (now refresh) | 80 |
| of those, new build candidates | 98 |
| refused by the entity floor | 14 |

### Reconciling 419

Both numbers are right; they count different populations, and QUEUE item 7 says which is which.
The 419 was measured 2026-09-05 over **slugs carrying DB2 records**, not over `StreetQueue`.
Re-measured today:

| | 2026-09-05 | today |
|---|---|---|
| slugs carrying DB2 records | 831 | **832** |
| of those, skipped low-data by the old gate | **419** | **422** |
| registry-filtered | not measured | **355** |
| refused by the entity floor | not measured | **67** |

The drift of 3 is the feed moving over five days. The item's **Done when** asks for the
registry-filtered population, and that number is **355**. Of those:

- **105 already have a `StreetContent` row** (84 of them published). These are the streets the
  cron could not refresh, and they refresh now. This is the part item 7 was written to fix.
- **250 have no page at all.** Creation candidates, and a much larger decision than this item —
  they are admitted to the gate now, so the cron will start building them. **This needs a ruling
  before merge:** it is 250 new pages, and item 7's own text flags it as "a different and much
  larger decision".

The `StreetQueue` figure (256 → 78) is the narrower one: what the cron drain sees on a run.

### The entity floor, and why the gate now carries it

Widening the gate would have breached a stated invariant. Of the 192 slugs the DB2 clause would
otherwise rescue, **14 are on neither the Town registry nor the off-registry allowlist**, and they
are exactly the ingest debris the registry exists to reject:

`derry-rd-road-milton` (236 rows), `nipissing-rd-milton-road-milton` (27),
`bessy-trail-trail-milton` (10), `nipising-road-milton` (a typo), `regional-rd-25-road-milton`,
`jean-landing-street-milton`, `whithlock-avenue-milton`, `clarriagea-court-milton`,
`mccandles-court-milton`, `dalgleish-gardens-milton`, `sommerville-terrace-milton`,
`regional-road-milton`, `gordon-krantz-boulevard-milton`, `redbud-gardens-milton`.

DB2 rows exist under those slugs because MLS ingest wrote whatever abbreviation it produced. That
is not evidence of a street. **Publish floor = entity floor**, so the DB2 branch only rescues a
slug the Town recognises. Verified safe first: **0 of the 445 published streets are off the
floor**, so the check cannot strand an existing page.

**Left open, deliberately.** The **DB1 branch has never consulted the registry either**, and the
cron drain (`/api/sync/generate`) has no floor check at all — only `scripts/create-street-page.ts`
enforces it. Nothing is leaking through today, but nothing stops it. Not closed here because it is
a behavioural change to a path this task did not touch. **Needs a ruling.**

---

## 4. ExitIntent and CornerWidget retired

Both moved to `src/components/street/retired/` with a one-line note at the top of each and a
`README.md`. Neither is mounted by any page; verified again, zero importers of either path.

`CornerWidgetProps` and `ExitIntentProps` stay in `src/types/street.ts`, annotated. This is not an
oversight: `StreetPageData.cornerWidget` is still assembled by `buildCornerWidget` in
`src/lib/street-data.ts`, so the shape is live even though nothing renders it. Unpicking that is a
page-composition change and was not made here. The `globals.css` rules are kept and annotated;
they are scoped to classnames nothing else uses.

---

## 5. Gates

| | |
|---|---|
| `pnpm build` | **exit 0**, judged by exit code |
| `P2024` in `build.log` | **0** |
| prebuild | **20/20** (19 plus the new sold-date guard) |
| static pages | **546** |
| preview | `miltonly-5b9qn9rrs`, Ready |
| battery on preview | **`PASS · 10 checks · 444 pages · 67s`**, exit 0, 0 FAIL |
| served SHA | `abf9ef4 served == expected` |

The battery is 10 checks now, not 9. `feat/homepage` added the homepage-figure check.

**No merge. Awaiting review of the preview.**

---

## Open, for a ruling

1. **The 245 existing rows.** Not repaired, per the brief. Once the sync fix is merged they
   correct themselves as they are re-upserted, but only if the sync re-fetches them. Worth
   deciding whether to run a one-off re-date instead of waiting.
2. **The DB1 branch has no entity floor**, and neither does the cron drain. See above.
3. **250 creation candidates.** The registry-filtered population is 355; 105 already have a
   page and refresh now, which is what item 7 was for, but the other **250 have no page and the
   cron will start building them**. Item 7's own text calls that "a different and much larger
   decision". **This is the one thing in this batch that should not merge without a ruling.**
4. **`priorPrice` has no consumer.** The columns fill from the next sync forward. Both the
   `priceReduced` badge and the homepage drop count are still out, and should stay out until the
   columns carry real observations.

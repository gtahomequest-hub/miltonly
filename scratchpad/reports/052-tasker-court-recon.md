# 052 — Task A Gate: tasker-court recon

Recon only. No code written. Scripts: `scripts/diag-zero-sales-tier.ts`,
`scripts/diag-zero-sales-tier2.ts`, `scripts/diag-sitemap-delta.ts`.
Run 2026-09-03 against prod DB1/DB2/DB3.

## 1. Corpus shape

| | |
|---|---|
| published `StreetContent` rows | 432 |
| street URLs in the live sitemap | 431 |
| published, 0 DB2 `For Sale` rows in the 12-month window | **74** |
| ...of those, **zero `For Sale` rows ever** -> absence claim | **25** |
| ...of those, older-than-window sales on record -> suppression claim | **49** |

The 25 reconcile to the brief's 24: `15-side-road-side-road-milton` is the one
published row the sitemap drops (publish floor rejects the doubled-suffix slug).
24 absence-claim pages are actually reachable.

The **absence claim is not a tier**. `resaleClaim()` (`src/components/street/v2/resaleClaim.ts:44`)
keys on `hasAnySale` alone. `hasAnySale` is `bestSale > 0 || anySaleOnRecord()`,
and `anySaleOnRecord` (`src/lib/streetEnrichment.ts:83`) asks DB2 for **any**
`For Sale` row with no date guard. So absence copy fires only where DB2 has
never recorded a sale. The 49 with older sales get suppression copy
("Too few recent sales to publish a price"), which is correct and already shipped.

## 2. How the 24 entered generation

Three gates, in order, and **none of them reads DB2 sold history**:

1. `makeStreetDecision` minimum-data gate (`src/lib/streetDecision.ts:28-49`).
   Needs `totalListings > 0` in **DB1** and at least one `sold`-status or
   `active` listing. Pure DB1.
2. `getStreetStats` five-source OR gate (`src/lib/streetDecision.ts:128-136`).
   Passes if **any** of: DB1 active sale listings, DB1 `sold`-status count,
   DB1 active lease count, DB3 `sold_count_12months`, DB3 `leased_count_12months`.
   Returns `null` otherwise. **DB2 `sold.sold_records` is not one of the five.**
3. `generateStreetContent` (`src/lib/generateStreet.ts:320-321`): `if (!stats) throw new Error("No stats available")`.

Every one of the 24 clears gate 2 on a DB1 active listing, a DB1 sold-status
flip, or a DB3 lease count. Example rows:

```
calla-point-milton      db1 total=1 active=0 soldStatus=0  db2 lease12=1  db3 sold=0 leased=1
drew-centre-milton      db1 total=3 active=3 soldStatus=0  db2 lease12=0  db3 NO ROW
nipissing-road-milton   db1 total=52 active=0 soldStatus=0 db2 lease12=21 db3 sold=0 leased=21
pickersgill-crescent    db1 total=2 active=0 soldStatus=1  db2 lease12=0  db3 NO ROW
```

`fifth-line-nassagaweya-milton` is published and `getStreetStats` returns
**null today** — it cleared the gate when it was generated and its DB1 inventory
has since cleared. Published rows persist after the gate stops passing.

### `getStreetStats("calla-point-milton")`, verbatim

```json
{
  "avgListPrice": 0, "medianListPrice": 0, "totalSold12mo": 0, "avgDOM": 0,
  "activeCount": 0, "activeLeaseCount": 0,
  "historicalSoldCount": 0, "historicalLeasedCount": 1,
  "dominantPropertyType": "detached", "typeBreakdown": [],
  "monthlyTrend": [], "priceDirection": "remained steady",
  "neighbourhood": "1051 - Walker", "schoolZone": null
}
```

One DB3 lease in 12 months is the entire reason this object is not `null`.
Every price field is `0`, and those zeros are the *legacy* stats path only —
they never reach the page. `buildGeneratorInput` re-derives everything from DB2.

## 3. Where null-vs-zero is decided

Four distinct seams, and they disagree by design:

| seam | file:line | meaning |
|---|---|---|
| page exists at all | `streetDecision.ts:128-136` | `null` = do not generate |
| legacy stat fields | `streetDecision.ts:139-153` | `0` = no active listings; never rendered |
| generator tier | `buildGeneratorInput.ts:422-444` | `salesCount` from the **live DB2 12-month range query** (`sold_date >= NOW() - INTERVAL '12 months' AND sold_date <= NOW()`, `buildGeneratorInput.ts:189-193`). `kAnonLevel = txCount === 0 ? "zero" : salesCount >= 5 ? "full" : "thin"` |
| published prices | `buildGeneratorInput.ts:427,433,441` | `typicalPrice` null below k5, `priceRange` null below k10, `daysOnMarket` null below k5 |
| render tier | `streetEnrichment.ts:164-170` | `priced-sale` / `priced-lease` / `area-only` / `identity-only` from `graduate()`, which returns a null basis below k5 |

So the 24 pages generate at `kAnonLevel: "zero"` and render at
`tier: 'identity-only'` with `hasAnySale: false`. Nothing is fabricated and no
zero is printed. The tier is honest; it just cannot be reached without DB1/DB3.

## 4. tasker-court-milton, the exact difference

```
db2 rows: 4   For Lease 2025-03-01 | For Sale 2024-11-01 | For Sale 2024-11-01 | For Sale 2024-09-27
              (all perm_advertise = true, all outside the 12-month window)
db1: total=0  active=0  soldStatus=0
db3: NO ROW in analytics.street_sold_stats
getStreetStats("tasker-court-milton") -> null
StreetContent -> none.  ResidentialStreet -> present.  R2 clip + poster -> uploaded, unused.
```

**The difference is one clause, not a data defect.** Tasker's only evidence lives
in DB2, and DB2 is the one source the gate does not consult. All five gate inputs
are literally zero, so `getStreetStats` returns `null` and generation throws
before `buildGeneratorInput` — which *would* find its three `For Sale` rows —
ever runs.

Contrast with the closest published street, generated yesterday for its video:

```
clifford-point-milton   db2 For Sale ever=1, latest 2024-10-22 (outside window)
                        db1 total=2 active=0 soldStatus=0
                        db3 sold=0 leased=3        <- the only reason it passed
                        getStreetStats -> object
```

Identical sale profile. Clifford Point has a DB3 row with three leases; Tasker
does not. That is the whole of it.

Note tasker is a **suppression** street, not an absence street: it has DB2
`For Sale` rows, so `hasAnySale` is `true` and `resaleClaim` returns the
"Too few recent sales to publish a price" copy. It would not join the 24.
n=4 (3 sales + 1 lease) is below k5, so `typicalPrice`, `priceRange` and
`daysOnMarket` all stay null. No price can appear anywhere on the page.

`mae-court-milton` is a second instance of the same gap already published and
now returning `null` (DB2 For Sale latest 2026-11-30, db3 NO ROW), which matters
for Task B: 71 Mae Court is one of the nine GSC address queries.

## 5. Proposed fix, for approval

Add DB2 as a sixth source to the `getStreetStats` OR gate: a full-window
`COUNT(*)` on `sold.sold_records` for the street's sibling slugs. Existence
only, no price, no date, mirroring `anySaleOnRecord`. Everything downstream
already handles the zero-recent-sales case correctly, so this is one gate
clause, not a tier rewrite.

Blast radius: the 5 streets currently published whose `getStreetStats` has gone
null would start passing again on regeneration, plus any registry street with
pre-window DB2 history and no DB1/DB3 signal. Corpus-wide count to be measured
before the change lands.

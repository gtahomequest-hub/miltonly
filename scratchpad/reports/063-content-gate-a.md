# 063 · Content tier, Gate A addendum — the volume measured

CONTENT · D:\miltonly-content · feat/content

**This does not replace `062-content-gate-a.md`. It corrects one premise in it and adds the
measurement that premise was standing in for.** Report 062 was written on this branch while
this recon was running, and its guide list, its risk calls and its section design stand. Read
062 first; this is the numbers underneath its section 3.2.

No code written. Three throwaway `.mjs` queries were run read-only against
`SOLD_DATABASE_URL` and deleted.

---

## 1. The correction

Report 062 §3.2 says:

> Milton runs roughly 10 to 15 sales a week town-wide, which means most neighbourhoods and
> most property types are sub-k every single week.

**The second half is right. The first half is wrong by about 3x.**

Measured 2026-09-10 against `sold.sold_records`, `city = 'Milton'`,
`perm_advertise = TRUE`, `transaction_type = 'For Sale'`, complete Monday weeks only:

| Week commencing | Sales | with `days_on_market` | with `list_price` |
|---|---|---|---|
| 2026-08-31 | 40 | 40 | 40 |
| 2026-08-24 | 43 | 43 | 43 |
| 2026-08-17 | 37 | 37 | 37 |
| 2026-08-10 | 33 | 33 | 33 |

Over the last 12 complete weeks the range is **26 to 67**, and every one of them clears both
floors.

**What that changes.** 062 treated the town-wide weekly typical as a figure that "will
suppress often" and put the 12-month figure in the headline instead. On this volume the
weekly typical clears `K_ANON_PRICE` and `K_ANON_RANGE` in every complete week measured, and
`days_on_market` and `list_price` are populated on 100% of the rows, so weekly DOM and weekly
sold-to-ask are computable too. **The weekly figure can carry the edition rather than sit as a
footnote,** which is the difference between a weekly edition and a monthly one wearing a
weekly date.

The check is still made per edition and never assumed. A thin holiday week publishes `null`
and a sentence saying the week was thin. Never `0`.

## 2. What the measurement confirms

**Per-neighbourhood weekly does not publish at any n.** Confirmed. About 1 to 2 sales per
neighbourhood per week. 062's answer, a weekly count beside the hub's own 12-month figure,
each labelled with its own window, is the right one and is already built in
`getMiltonSoldByNeighbourhood()`.

**Per-form weekly does not publish either**, but a middle window works. Trailing 28 days,
upper-bounded:

| Form | 28-day sales | k5 | k10 band |
|---|---|---|---|
| detached | 71 | yes | yes |
| townhouse | 37 | yes | yes |
| condo | 14 | yes | no |
| semi | 13 | yes | no |

So a by-form block publishes at 28 days with a point for all four and a band for two. This
window sits between 062's weekly and 12-month options and neither report had it.

For comparison, the same 28-day window by neighbourhood clears k5 on only **11 of 21**
neighbourhoods and k10 on **6**, which is why the neighbourhood block stays on the 12-month
figure and the form block does not have to.

**The lease side has no trustworthy weekly figure.** Weekly lease counts over the same period
read 130, 6, 4, 51, 14, 15, 127, 5, 20, 3, 23. Those spikes are ingest stamping, not a market,
and they are the visible form of the caveat `daily-summary/route.ts` already carries: the
lease buckets have no close date and proxy through `updatedAt`. **Lease is out of v1**, and
any later lease figure is 12-month or nothing.

## 3. DEC-SOLD-UPPER-BOUND, with the size of the trap

`sold.sold_records` holds **192 For Sale rows and 53 For Lease rows with a `sold_date` in the
future**, the furthest at **2027-01-29** against a database `NOW()` of 2026-09-10.

This is already ruled on. `soldAggregates.ts` carries the decision and bounds every window
`sold_date <= NOW()`. The size of the trap is worth recording because I fell into it in this
very recon: an unbounded 28-day neighbourhood count returned **327** rows where the bounded
one returns **135**. A new window that forgets the bound does not fail, it publishes a number
inflated by 2.4x, and it publishes sales that have not happened.

Consumer record lists in `sold-data.ts` (lines 269, 294, 324) do not carry the upper bound.
That is outside this worktree and is noted, not claimed as a fault.

## 4. One data note for G4

062 sources condo fees and parking from `CondoBuilding` and `Listing`. `sold.sold_records`
carries a second source on the same axis: `association_fee`, `association_fee_includes`,
`parking_total`, `garage_spaces`, `open_parking_spaces`, `parking_features` and `locker` are
all columns on that table. It does not change the open ruling 062 asks for, since a
per-building fee is still a population of one building whichever table it comes from, but a
cohort distribution has more rows behind it than the 65 `CondoBuilding` rows suggest.

## 5. What this addendum does not change

062's guide list, its BUILD 6 / HOLD 2 split, its risk calls and its eight decisions all
stand. In particular:

- **G7, parking, stays held.** The Town parking bylaw is not in the repo and no validator can
  catch a fabricated bylaw. Measurement does not help here, and the parking columns above are
  a property attribute, not a municipal rule.
- **G5, schools, stays framed by `catchmentVocabulary.ts`.** The ban is already ratified.
- The **mortgage rate** still has no source in the repo.
- The **per-building condo fee** still has no k threshold.
- **GSC is live and readable** through `src/lib/seo/gscClient.ts` and `SeoOpportunity`, and
  pulling the real rows for the eight queries before fixing the order is still step one of
  Gate B.

## 6. Added to the decision list

9. **The weekly typical is the edition's headline figure, computed on the week and gated on
   the week's own n.** 062 §3.2 assumed it would usually suppress. It does not. Confirm the
   swap.
10. **A by-form block on a trailing 28-day window**, point at k5 for four forms and band at
    k10 for detached and townhouse only. New section, not in 062.

**No code until sections 2 and 3 of 062, plus these two, are approved.**

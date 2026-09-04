# 053b — Task A incident response and completion, 2026-09-04

Approved by Aamir. Branch `fix/zero-sales-tier`, still **not merged**.
Continues `053-zero-sales-tier.md`.

## 1. The two live pages, held

`drew-centre-milton` and `pickersgill-crescent-milton` set to `status=draft`,
`publishedAt=null`, `reviewNotes="fabricated area prices under zero tier, 2026-09-04"`.
Both paths and `/streets` revalidated on production, all 200. Both then rendered the
minimal shell.

`drew-centre` still showed `$690K / $695K / $687K` after the hold. Those are **active
listing asking prices** in the inventory block, IDX display gated on `permAdvertise`, and
already public. The fabricated `$625,000 / $800,000` prose was gone. `pickersgill` showed
no figure at all.

## 2. DEC-GROUNDING-ZERO

New rule `zero_tier_price`, hard severity, so the retry budget and the fail-closed path
apply.

`inputHasNoPriceAtAnyGrain()` tests **content, not presence**: a `neighbourhoodComparable`
that holds no figure grounds no figure, and testing `!= null` on the container would hand
the model a payload it cannot cite while switching the rule off. `findZeroTierPrices()`
then treats every currency amount and price-shaped number as a violation, including bare
`1.1M` and bare `800,000` near price vocabulary.

Wired into **all sections** in both `validateStreetGeneration` and
`validateSectionsSubset`, and into **both** FAQ arms. The market-only scope of
`numeric_ungrounded` is precisely what failed: tasker's three figures were in `homes`,
`neighbourhoodComparable` and the FAQ.

`scripts/test-grounding-zero.ts` is the 11th prebuild test. Verified **red** (5 failures
on the new cases) then green. The reverse case is asserted on the same fixtures: a figure
absent from a **non-empty** input still fires `numeric_ungrounded`, and a grounded figure
still passes, so the new rule cannot have been built by loosening the old one.

## 3. DEC-ZERO-CONTEXT

**Source function: `saleAggQuery` + `assembleAggregates` from
`src/lib/ai/buildHubInput.ts`**, reached through `Neighbourhood.rawStrings`. That is the
hub page's own pair, and `buildStreetEnrichment` already calls exactly those two for the
street page's area card, so the street and the hub cannot disagree. `assembleAggregates`
applies the k gates itself: typical null below K_ANON_PRICE, range null below
K_ANON_RANGE. Nothing here weakens k-anonymity, and `fallbackApplied: "whole-nbhd"` is
what tells the prompt to label it as the neighbourhood figure.

`resolveNeighbourhoodComparable` could not supply this. It needs a dominant property type
to pick a per-type column, and `byType` comes from 12-month activity, which on a zero-tier
street is empty by definition. The whole-neighbourhood aggregate needs no type.

Attached **only when it clears k5**. If the hub is itself sub-k5 the typical is null, and
attaching an empty object would switch DEC-GROUNDING-ZERO off while giving the model
nothing to cite.

| street | neighbourhood | typical | n |
|---|---|---|---|
| `tasker-court-milton` | Ford | $1,025,527 | 150 |
| `drew-centre-milton` | Timberlea | $949,767 | 82 |
| `pickersgill-crescent-milton` | Harrison | $937,859 | 119 |

## 4. Three further defects the regeneration exposed

The first pass after DEC-ZERO-CONTEXT still produced **3 ungrounded figures**. Each fix
below goes beyond the literal instruction and is recorded as such.

**A second arm.** A loose restatement of a real neighbourhood endpoint in `homes` was
invisible to the market-scoped rule. On `kAnonLevel: "zero"` the dollar arm of
`numeric_ungrounded` now runs on all sections and the FAQ. Dollars only; counts,
percentages and quarter labels stay market-scoped where they were tuned.

**Bands.** That arm then rejected a **true** statement. Ford's low is $419,990, "the low
$400s" is an accurate reading of it, and it missed the point tolerance by $3,190. A tier
construct names a band, so `tierBandFor` grounds it when an input value falls inside the
band it actually names. `low-$400s` clears $419,990; `high-$400s` means 466,667-500,000
and still does not. Band width is the place value of the last significant digit written,
so `$1.3Ms` spans 100K rather than the whole of the `$1Ms` — reading both as a flat decade
let `mid-$1.3Ms` swallow a $1,595,000 high. The parser now also accepts the unhyphenated
`low $400s`, which previously parsed as the nonsense value `$400`.

**Actionable feedback.** `pickersgill` then burned all five attempts re-guessing
`high-$600s`, because the violation said only that the figure was not in the input.
`correctTierFor` names the band the nearest input value actually sits in, rebuilt **from
that value**: returning `mid-$800s` for 937,859 because the writer said `$800s` is an
instruction to write something still wrong. This is the parkway-drive lesson in a
different costume — a rejection the model cannot act on is a retry storm, not a guard.

**`daysOnMarket` null on the zero-tier comparable.** The hub carries a neighbourhood DOM,
but `numeric_ungrounded` grounds a days figure against `aggregates.daysOnMarket` alone,
which is null here. Passing the real 87 days handed the model a number the validator could
not recognise, and it cost a retry before that line existed.

## 5. Gates

| gate | result |
|---|---|
| `pnpm build`, twice | **exit 0**, 533 pages, **zero P2024**, 11/11 prebuild |
| battery, `EXPECT_SHA=a32c0c9`, preview `miltonly-2sxygwznu` | **PASS · 9 checks · 431 pages · 55s**, exit 0 |

Local `DATABASE_URL` now carries `connection_limit=10`, recorded in `CLAUDE.md`. At 1 the
gate had failed 5 to 17 prerenders on `P2024` and passed on identical code. Zero since.

## 6. Regeneration, on `phase41_v2` against production data

| street | attempts | cost | judge | words |
|---|---|---|---|---|
| `tasker-court-milton` | 3 | $0.009 | PASS | 1050 |
| `drew-centre-milton` | 2 | $0.007 | PASS | 908 |
| `pickersgill-crescent-milton` | 2 | $0.007 | PASS | 1054 |

### Every dollar figure, against the input value it matched

**Audited total: 0 ungrounded across all three.**

```
tasker-court-milton   (Ford, typical $1,025,527, range $419,990-$1,980,000)
  mid $1M      -> neighbourhoodComparable.typicalSoldPrice  $1,025,527  delta $25,527
  low-$400s x2 -> neighbourhoodComparable.priceRange.low      $419,990  within the band it names
  $1,050,000   -> neighbourhoodComparable.typicalSoldPrice  $1,025,527  delta $24,473
  $1.05M    x2 -> neighbourhoodComparable.typicalSoldPrice  $1,025,527  delta $24,473
  $2M       x2 -> neighbourhoodComparable.priceRange.high   $1,980,000  delta $20,000

drew-centre-milton    (Timberlea, typical $949,767, range $475,000-$1,575,000)
  high-$400s   -> neighbourhoodComparable.priceRange.low       $475,000  within the band it names
  high-$1.5Ms  -> neighbourhoodComparable.priceRange.high    $1,575,000  within the band it names
  $950,000  x3 -> neighbourhoodComparable.typicalSoldPrice     $949,767  delta $233

pickersgill-crescent-milton  (Harrison, typical $937,859, range $637,500-$1,595,000)
  mid-$600s    -> neighbourhoodComparable.priceRange.low       $637,500  within the band it names
  $950,000  x4 -> neighbourhoodComparable.typicalSoldPrice     $937,859  delta $12,141
  $650,000     -> neighbourhoodComparable.priceRange.low       $637,500  delta $12,500
  $1.6M     x2 -> neighbourhoodComparable.priceRange.high    $1,595,000  delta $5,000
```

The render layer strips numeric sentences on a sub-k page, so the **published pages show
no price at all**. The audit above is of the stored generation, which is the layer that
had to be made honest. Both layers are now safe, for different reasons.

## 7. Published, and the sitemap count

All three `status=published`, all three revalidated on production.

**The sitemap is 434, not 432.** The 431 baseline already excluded all three, because
step 1 held `drew-centre` and `pickersgill`, which had been published. Republishing three
pages from a 431 baseline gives 434. The `431 -> 432` in the brief assumed only tasker was
being added.

`tasker-court-milton` serves its R2 video: `day.mp4`, `poster.webp` and a `VideoObject` in
the JSON-LD are all present on the live page.

## 8. The gate population, 46 streets, none regenerated

Measured now: **46**, not the 47 reported earlier the same day. One street picked up a DB1
signal in the overnight sync and is no longer newly admitted.

| slug | StreetContent | DB2 records | latest record |
|---|---|---|---|
| `10-side-road-milton` | no StreetContent row | 1 | 2024-10-01 |
| `archer-way-milton` | no StreetContent row | 2 | 2024-12-27 |
| `arthurs-way-milton` | no StreetContent row | 1 | 2024-08-28 |
| `ashbrook-court-milton` | no StreetContent row | 2 | 2024-07-01 |
| `bastedo-court-milton` | no StreetContent row | 3 | 2024-10-31 |
| `buck-drive-milton` | no StreetContent row | 1 | 2024-10-30 |
| `cunningham-court-milton` | no StreetContent row | 1 | 2024-09-20 |
| `detlor-heights-milton` | no StreetContent row | 1 | 2025-04-15 |
| `doran-crescent-milton` | no StreetContent row | 1 | 2025-03-15 |
| `duff-crescent-milton` | published | 1 | 2026-11-02 |
| `farrington-crossing-milton` | no StreetContent row | 2 | 2025-05-15 |
| `five-side-road-milton` | no StreetContent row | 1 | 2024-06-27 |
| `hadley-woods-terrace-milton` | no StreetContent row | 3 | 2025-05-21 |
| `harvest-drive-milton` | published | 7 | 2025-04-14 |
| `hollinrake-crescent-milton` | no StreetContent row | 4 | 2024-12-11 |
| `huddlestone-crescent-milton` | no StreetContent row | 1 | 2025-05-01 |
| `huntingford-gate-milton` | no StreetContent row | 2 | 2024-11-15 |
| `inglis-drive-milton` | no StreetContent row | 2 | 2025-02-17 |
| `livock-trail-milton` | no StreetContent row | 1 | 2024-06-28 |
| `lyons-court-milton` | no StreetContent row | 2 | 2024-09-09 |
| `mae-court-milton` | published | 1 | 2026-11-30 |
| `mara-circle-milton` | no StreetContent row | 1 | 2024-12-12 |
| `marcellus-avenue-milton` | no StreetContent row | 2 | 2025-01-13 |
| `marks-street-milton` | no StreetContent row | 4 | 2025-05-01 |
| `mckim-gate-milton` | no StreetContent row | 5 | 2025-01-01 |
| `mclaren-road-milton` | published | 4 | 2025-04-30 |
| `mcphail-way-milton` | published | 1 | 2026-10-01 |
| `melanson-heights-milton` | no StreetContent row | 2 | 2024-09-26 |
| `moreau-lane-milton` | no StreetContent row | 1 | 2025-01-07 |
| `norrington-place-milton` | no StreetContent row | 4 | 2024-09-26 |
| `nunn-court-milton` | no StreetContent row | 2 | 2025-03-14 |
| `peacock-lane-milton` | no StreetContent row | 1 | 2025-07-01 |
| `pine-view-trail-milton` | published | 2 | 2024-09-30 |
| `pitcher-place-milton` | draft | 2 | 2024-09-18 |
| `pollock-gate-milton` | no StreetContent row | 1 | 2025-01-31 |
| `powys-street-milton` | no StreetContent row | 1 | 2025-02-11 |
| `primrose-crescent-milton` | no StreetContent row | 1 | 2024-07-01 |
| `proud-drive-milton` | no StreetContent row | 3 | 2025-02-05 |
| `rutledge-way-milton` | no StreetContent row | 1 | 2025-01-30 |
| `stagg-garden-milton` | no StreetContent row | 1 | 2025-01-15 |
| `strathcona-court-milton` | published | 3 | 2026-09-28 |
| `tasker-court-milton` | published | 4 | 2025-03-01 |
| `valleyview-crescent-milton` | no StreetContent row | 2 | 2025-02-20 |
| `waldie-avenue-milton` | no StreetContent row | 2 | 2025-04-30 |
| `winn-trail-milton` | no StreetContent row | 1 | 2025-07-01 |
| `wise-crossing-milton` | published | 2 | 2025-03-24 |

`mae-court-milton` and `mcphail-way-milton` are also two of the QUEUE item 3 GSC address
queries.

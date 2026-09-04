# 053 — Task A step 3: the zero-sales tier fix, and the halt

Branch `fix/zero-sales-tier`. **Not merged. Tasker is generated but HELD as draft.**
The run stopped on a systemic failure, per the stop-on-failure rule.

## What shipped on the branch

### The sixth gate source (`c1ca7ce`)

`src/lib/streetDecision.ts`. `countRecordedTransactions()` adds DB2 record
existence as a sixth OR clause: `COUNT(*)` on `sold.sold_records` across sibling
slugs with `perm_advertise = TRUE`. No price column selected, no date filter, no
render surface. Returns 0 when DB2 is unreachable, so the gate stays exactly as
permissive as before when the probe fails.

The five-source inline condition became the exported pure predicate
`hasStreetActivity(StreetActivitySources)`, so the guard can assert it with no
database.

`scripts/test-zero-sales-tier.ts`, 10th prebuild test, 9 assertions:

- tasker's shape (0 window sales, 4 record transactions) passes
- a street with nothing on any of the six sources still fails
- 1 record is enough; depth is a k-anon question answered downstream
- each of the five prior sources still admits on its own
- a negative count cannot pass the floor

Verified **red** against the pre-fix predicate (2 failures) and **green** after.

### The name fix

`generateStreetContent` resolved `streetName` only at the two upsert branches.
Every other consumer read the raw parameter: `buildStreetMetaTitle`,
`buildStreetMetaDescription`, `buildFaqJson`, the legacy prompt, `validateContent`
and the SMS body.

It had never been visible because a regeneration always had a stored name to pass.
Generating a street with **no prior `StreetContent` row** exposed it:
`scripts/regen-streets.ts` does `content?.streetName ?? slug`, so tasker published as

```
metaTitle:  "tasker-court-milton Milton Real Estate | Homes, Prices & Market Data"
streetName: "Tasker Court"        <- correctly resolved, same row
```

Fixed by resolving once at entry, immediately after slug canonicalization, which
makes the raw parameter unusable from that line down. Corpus scan: 1 of 476 rows
affected, and it was the one this task created. Regenerated clean.

## The blast radius, measured

The brief asked for 5 streets. The real number is **47**, and my Gate-A estimate of
5 was an extrapolation from a 6-row sample rather than a measurement.

| | |
|---|---|
| universe scanned (`StreetContent` union `ResidentialStreet`) | 969 |
| newly admitted by the sixth clause | **47** |
| already published (would pass again on regeneration) | **8** |
| draft | 1 |
| no `StreetContent` row (could gain a page) | 38 |

**The 8 published, none regenerated:**

| slug | status | DB2 records |
|---|---|---|
| `duff-crescent-milton` | published | 1 |
| `harvest-drive-milton` | published | 7 |
| `mae-court-milton` | published | 1 |
| `mclaren-road-milton` | published | 4 |
| `mcphail-way-milton` | published | 1 |
| `pine-view-trail-milton` | published | 2 |
| `strathcona-court-milton` | published | 3 |
| `wise-crossing-milton` | published | 2 |
| `pitcher-place-milton` | **draft** | 2 |

`mae-court-milton` and `mcphail-way-milton` are two of the GSC address queries in
Task B, which is not a coincidence: they are streets people search and the corpus
under-serves.

## Gates

| gate | result |
|---|---|
| local `pnpm build`, first run | **exit 1**, 17 street prerenders, `P2024` pool timeout |
| local `pnpm build`, `connection_limit=10` | **exit 0**, 533 pages, 10/10 prebuild |
| preview `miltonly-6ztca9vbu` | Ready |
| battery, `EXPECT_SHA=c1ca7ce` | **PASS · 9 checks · 431 pages · 59s**, exit 0 |

The first failure is HANDOFF open item 2, not this change: the street page render
path imports `street-data`, never `streetDecision`, so `getStreetStats` is not
reachable from a prerender. Overriding the pool for one run (env only, nothing
written to `.env.local` or the repo) took it to exit 0 and confirmed the diagnosis.

## THE HALT

**Every dollar figure in tasker's generated prose is ungrounded.**

`buildGeneratorInput("tasker-court-milton")` returns, in full:

```json
{ "aggregates": { "salesCount": 0, "leasesCount": 0, "typicalPrice": null,
                  "priceRange": null, "daysOnMarket": null, "kAnonLevel": "zero" },
  "activeListingsCount": 0, "neighbourhoods": ["Ford"], "byType": {} }
```

No `neighbourhoodComparable`, no `leaseActivity`, no `quarterlyTrend`. The payload
carries no price of any kind, at any grain. The prose it produced:

- "Across the broader Ford area, homes typically trade in the low $1Ms"
- "The typical sold price for such homes in the area sits near $1.1M"
- "In the Ford area, rents for similar homes typically range from $2,800 to $3,500 per month"
- "Buyers have generally paid close to asking, with only modest negotiation room"
- "Year over year, prices have firmed modestly"

Validator: 0 violations. Judge: PASS. The tell was in run 1 and I nearly missed it:

```
[roundPrices] faq[0] '$790,000' -> '$800,000' (sale, $500K-$999K/$25K) (no input within tolerance)
```

`(no input within tolerance)` is the rounder reporting that it could not match the
figure to any input aggregate, and rounding it anyway.

**This is not a k-anon leak.** No street-level price appears; the model correctly
says pricing is not publicly available at this level for Tasker Court itself. It is
worse in one specific way: a k-anon leak publishes a real number too precisely,
whereas this publishes a number that does not exist. The k5 requirement in the brief
is satisfied and beside the point.

### It is systemic, which is why the run stopped

Same probe across the zero-and-thin tier. `input has price` is computed from the
payload the model actually received:

```
slug                        | kAnon | n  | input has price | prose $ figures
calla-point-milton          | thin  | 0  | YES             | $3,300 $900
drew-centre-milton          | zero  | 0  | no              | $625,000 $800,000
clifford-point-milton       | thin  | 0  | YES             | $1.3M $2,500 $4,000
chretien-street-milton      | full  | 5  | YES             | $1M $1.05M $1.15M ...
heaven-crescent-milton      | thin  | 1  | YES             | $850,000
pickersgill-crescent-milton | zero  | 0  | no              | $1.1M
tasker-court-milton         | zero  | 0  | no              | $1M $1.1M $2,800 $3,500
```

`drew-centre-milton` and `pickersgill-crescent-milton` are **published and live on
production today**, both `kAnonLevel: "zero"`, both with an empty price payload, both
printing dollar figures. This predates the branch. The branch does not cause it; it
widens the population that can reach it by 47 streets.

Under "systemic failures halt the run", the run halted.

### State left behind, deliberately

| | |
|---|---|
| `tasker-court-milton` `StreetContent` | **`status=draft`**, `needsReview=true`, `publishedAt=null`, `reviewNotes` records why |
| sitemap | **431**, unchanged. Tasker absent |
| live page | 200, renders the **minimal shell**. None of the fabricated prose is served |
| R2 | `videoUrl` + `videoCapturedAt` wired on the held row; `day.mp4` 200, `poster.webp` 200 |
| prod revalidation | `/streets/tasker-court-milton` and `/streets` purged, both 200 |
| branch | pushed, **not merged**, no PR opened |

`431 -> 432` was not done, and should not be until the grounding gap is closed.
Publishing tasker today would add a fourth page printing invented prices.

## What I did not touch

1. **`makeStreetDecision`'s own minimum-data gate** (`streetDecision.ts:42`) still
   requires a DB1 listing, so the cron returns `skip_low_data` for every one of the
   47. Manual generation works; automated refresh does not. Outside the approved
   scope, which was one clause on `getStreetStats`.
2. **The 8 published blast-radius streets**, not regenerated, as instructed.
3. **The zero-tier grounding gap itself.** It needs a decision before a fix: whether
   the zero tier should be barred from emitting any figure at all, or whether
   `neighbourhoodComparable` should be populated for it so the area claims become
   true. Those are different products, and it is not my call.
4. **The name guard.** `test-street-name-repair.ts` was green throughout, because it
   asserts that a file *imports* the resolver and `generateStreet.ts` does, at the
   upsert. It cannot see a consumer inside the same file that reads the raw parameter
   instead. Worth a guard; I did not write a brittle one under time pressure.

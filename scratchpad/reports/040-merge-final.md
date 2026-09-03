# Merged and live. Final SHA `33bed68`. Battery still fails on 2 hubs — and it is not what I said it was.

## 1. Merge

```
69f3f66 -> 33bed68   merge --no-ff fix/name-prose    16 files, +220/-71
pushed 69f3f66..33bed68
```

Build green before pushing: 9 prebuild tests, 0 `Failed to compile`, route table emitted, tree verified identical to the branch.

## 2. Production

```
https://miltonly-o1rbbj80d-gtahomequest-hubs-projects.vercel.app
● Ready · Production · 2m · commit 33bed68
```

## 3. Battery against https://miltonly.com — FAILS on hub-meta

Eight of nine checks pass. Full list:

| check | result |
|---|---|
| No sentence denies or contradicts a figure the page publishes | PASS |
| Structured data publishes exactly what the page publishes | PASS |
| Absence claims match the record, and every page has a working CTA | PASS |
| Every published figure is floored against its own sample | PASS |
| One metric, one number | PASS |
| Every published page is a street that exists | PASS |
| Every published coordinate is real | PASS |
| **Hub meta, body and JSON-LD all publish the live aggregate** | **FAIL** |
| Town polygons reproduce the TREB assignments | PASS |

```
PASS  hub pages read == sitemap hub count: 22
PASS  hero stat tiles parsed on every hub: 22
PASS  JSON-LD parsed on every hub: 22
FAIL  meta price != live typical: 1
FAIL  meta sale count != live sale count: 2
PASS  meta states a price off a sub-k pool: 0
FAIL  hero typical != live typical as displayed: 1
FAIL  hero sold count != live sale count: 2
FAIL  JSON-LD price != live typical as published: 1
PASS  JSON-LD states a price off a sub-k pool: 0
PASS  price suppressed on some surfaces only: 0

old-milton:  meta $870,000 vs live $865,000
old-milton:  meta 96 sales vs live 98
old-milton:  hero "$870K" vs expected $865K
old-milton:  hero sold 96 vs live 98
cobban:      meta 77 sales vs live 76
cobban:      hero sold 77 vs live 76
```

### On the cache age you asked for: it does not exist, and my earlier diagnosis was wrong

I attributed these failures to `CACHE_TTL.stats = 3600` with hub aggregates flowing through `cached("nbhd-sale-stats:{n}", …)`. **That is not the hub path.**

- `hubLive.ts` and `hubData.ts` contain no calls to the Upstash `cached()` helper at all.
- Their `cache(...)` is imported from **React** — request-scoped deduplication that does not persist between requests.
- `getNeighbourhoodSaleStats`, which owns the `nbhd-sale-stats` key, is called only by `market-pulse.ts` and `streetMinimal.ts`. Not by hub pages.
- A direct Upstash TTL probe on those keys returned `ttl=-2`: **the keys do not exist.**

There is no 3600s TTL in this path to read an age against. I am not producing a number for it.

### And the "decaying cache" story does not survive this run either

Across runs today: **4 -> 3 -> 2 -> 2**, and this last run is the same two hubs with byte-identical figures as the previous one. `beaty` and `dorset-park` cleared and stayed cleared; `old-milton` and `cobban` have not moved.

**A persistent, reproducible, identical mismatch on two specific hubs is not a timing skew.** Whatever cleared for the other two is not what is happening here. These two look like a genuine disagreement between what the hub publishes and what the battery computes, and they deserve investigation on their own rather than another mechanism guess from me.

What is still solidly established: **this merge did not cause it.** These two hubs were failing with these same numbers before this merge, across three prior runs, and the code merged here touches street prose and a prebuild test, nothing that computes hub aggregates.

## 4. Production check on `buckthorn-garden-milton`

```
INTRO  Buckthorn Garden is a quiet residential street in the Cobban neighbourhood of Milton,
       set within a grid of similar streets that define this part of the town.

H2     The market around Buckthorn Garden      <- requested
H2     Recent activity on Buckthorn Garden
H2     Commute & reach from Buckthorn Garden
H2     Around Buckthorn Garden
H2     About Buckthorn Garden

CONTEXT  "the neighbourhood, not Buckthorn Garden specifically"   (em-dash gone)
```

Both requested surfaces confirmed on production.

## 5. Final SHA

**`33bed68`** — `main`, deployed as `miltonly-o1rbbj80d`.

| | |
|---|---|
| final SHA | `33bed68` |
| production | `miltonly-o1rbbj80d`, Ready |
| battery | 8/9 PASS; hub-meta FAILS on `old-milton` and `cobban` |
| hub-meta cause | **unresolved** — my cache explanation was wrong, and the persistence rules out timing |
| buckthorn on prod | intro, all H2s, context line read "Buckthorn Garden" |
| Build 2 | not started, as instructed |

Recommended next step, not taken: capture the hub page's number and the DB number for `old-milton` in the same instant. If they agree at that moment the battery's comparison is wrong; if they disagree, the page is publishing a stale figure and the source needs finding.

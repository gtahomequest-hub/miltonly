# Merged and live. Final SHA `33bed68`.

**Production:** `miltonly-o1rbbj80d`, Ready, 2m build. Tree verified identical to the branch before pushing; build green with 9 prebuild tests.

## Step 4 confirmed on production

```
INTRO  Buckthorn Garden is a quiet residential street in the Cobban neighbourhood of Milton…
H2     The market around Buckthorn Garden
CONTEXT  "the neighbourhood, not Buckthorn Garden specifically"
```

## Step 3: 8 of 9 pass, hub-meta fails — and my story about it was wrong twice

**The cache age you asked for does not exist.** `hubLive.ts`/`hubData.ts` never call the Upstash `cached()` helper; their `cache(...)` is React's request-scoped one. The `nbhd-sale-stats` key belongs to functions hub pages do not call, and a direct TTL probe returned `ttl=-2` — the keys are not there. There is no 3600s TTL in this path to measure against, so I am not reporting a number for it.

**And the "decaying cache" story does not survive this run.** Across today: **4 -> 3 -> 2 -> 2**, and this run is the *same two hubs with byte-identical figures* as the last:

```
old-milton:  meta $870,000 vs live $865,000 · 96 sales vs live 98
cobban:      77 sales vs live 76
```

`beaty` and `dorset-park` cleared and stayed cleared. These two have not moved. **A persistent, reproducible, identical mismatch on two specific hubs is not a timing skew** — so whatever explained the other two does not explain these. They look like a genuine disagreement between what the hub publishes and what the battery computes.

What does still hold: **this merge did not cause it.** Both hubs were failing with these same numbers across three prior runs, and the merged code touches street prose and a prebuild test — nothing that computes hub aggregates.

I have stopped there rather than offer a third mechanism after two were wrong. The check that would settle it: capture the hub page's number and the DB number for `old-milton` in the same instant. If they agree, the battery's comparison is wrong; if not, the page is publishing a stale figure and the source needs finding.

Build 2 not started, as instructed.

## Full battery, per check

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

## State

| | |
|---|---|
| final SHA | `33bed68` |
| production | `miltonly-o1rbbj80d`, Ready |
| battery | 8/9 PASS; hub-meta FAILS on `old-milton` and `cobban` |
| hub-meta cause | **unresolved** — the cache explanation was wrong, and the persistence rules out timing |
| buckthorn on prod | intro, all H2s, context line read "Buckthorn Garden" |
| Build 2 | not started |

Full detail at `scratchpad/merge-final.md`.

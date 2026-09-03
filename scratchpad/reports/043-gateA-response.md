# Task 1 — there is no hub-meta defect

**Both sides query the same DB2 table with identical windows and filters, and return byte-identical data.**

```
run at 2026-09-03T06:27:32.386Z
### old-milton  rawStrings=["1035 - OM Old Milton"]
  PAGE  (= ANY(rawStrings))      n=98  avg=866311.24  ->Math.round=866311
  BATTERY (GROUP BY + sum)       n=98  avg=866311.24  ->round5000=865000
```

**Battery:** `scripts/verify/lib/db.mjs:42-45` — DB2 `sold.sold_records`, `GROUP BY neighbourhood`, summed over `rawStrings` in JS, k-gate then round to $5,000.

**Page:** `buildHubInput.ts:172-181` `saleAggQuery` — DB2 `sold.sold_records`, `neighbourhood = ANY(rawStrings)`, k-gate then `Math.round` to the dollar.

Same `sold_date` field, same 12-month window, same `perm_advertise`/`For Sale` filters, no property-type filter either side, same `K_ANON_PRICE = 5`. **Neither reads DB3** — `analytics.neighbourhood_sold_stats` is not in this path at all, so there is no stale-analytics-row hypothesis and no `updated_at` to report against it.

## What the failures actually were

Production, checked the same minute:

```
old-milton meta: "…typically $865,000, 98 sales in the last 12 months…"   hero: 98
cobban     meta: "…typically $1,105,000, 76 sales…"                        hero: 76
```

The page now serves exactly the battery's figures, and the re-run confirms it: **exit 0, 0 FAIL lines, `PASS · 9 checks · 426 pages · 45s`** — with no code change and no deploy in between.

The page was serving **stale rendered output** during the earlier runs. Headers today are `no-store`, `X-Vercel-Cache: MISS`, `Age: 0`. The stale windows lined up with the minutes just after each production promotion, which points at the battery sampling a freshly-promoted deployment while some hub responses still came from the outgoing one.

**I was wrong twice here.** First I blamed a `CACHE_TTL.stats = 3600` Upstash cache — that key is not in the hub path and a TTL probe returned `ttl=-2`. Then I said the persistence across four runs ruled out timing and indicated a real defect — also wrong. The figures were stable because the stale *render* was stable. The queries never disagreed.

## The fix I would propose

Not a data fix — fix the check. `hub-meta` races a freshly-queried DB figure against a page that may still be served by the outgoing deployment, and gates the whole battery on it. Either have `run.mjs` assert the served build matches the expected commit before the hub checks, or give `hub-meta` the treatment its street sibling already has: NOTE a mismatch with both figures, FAIL only when it persists across two spaced samples. The second is cheaper and matches existing precedent in the suite.

## Task 2 gate: passes

No defect exists to propagate, and `buildGeneratorInput` derives street aggregates independently of `saleAggQuery` regardless.

**Task 2 not started** — the instruction sequences it after this report, and it is 13 regenerations plus a new page plus an adjacency rebuild against production. Say the word and it runs one at a time, stopping on any failure.

---

Full detail at `scratchpad/gateA-hub.md`, including the side-by-side query table and the analytics column list.

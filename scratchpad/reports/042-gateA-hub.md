# Task 1 — Gate A recon. **There is no hub-meta defect. Both sides agree, and the battery now passes 9/9.**

`main @ 33bed68`, tree clean. No code written.

## 1. What the battery uses for "live"

`scripts/verify/lib/db.mjs:42-45`, `loadHubRecord()` — **DB2**, `sold.sold_records`, raw SQL:

```sql
SELECT neighbourhood, COUNT(*)::int n, AVG(sold_price) avg
FROM sold.sold_records
WHERE perm_advertise=TRUE AND transaction_type='For Sale'
  AND sold_date >= NOW() - INTERVAL '12 months' AND sold_date <= NOW()
GROUP BY neighbourhood
```

Then in JS (`db.mjs:57-64`) it sums the groups whose `neighbourhood` appears in `public."Neighbourhood"."rawStrings"`, and:

```js
const typical = count >= K_ANON_PRICE && total > 0
  ? Math.round(total / count / 5000) * 5000     // k-gate FIRST, then round to $5,000
  : null;
```

## 2. What the hub page uses

`hubLive.ts:77-107` `getHubMetaLive` reads `input.aggregates.typicalPrice` / `.salesCount` from `getHubInputCached` -> `buildHubInput`. That resolves to `saleAggQuery` (`buildHubInput.ts:172-181`) — **DB2, same table**:

```sql
SELECT COUNT(*)::int AS n, MIN(sold_price) AS lo, MAX(sold_price) AS hi,
       AVG(sold_price) AS avg_price, AVG(days_on_market) AS avg_dom
FROM sold.sold_records
WHERE neighbourhood = ANY($rawStrings::text[])
  AND perm_advertise = TRUE AND transaction_type = 'For Sale'
  AND sold_date >= NOW() - INTERVAL '12 months' AND sold_date <= NOW()
```

`assembleAggregates` (`:93-120`): `typicalPrice = salesCount >= K_ANON_PRICE && typicalRaw !== null ? Math.round(typicalRaw) : null`.

**Side-by-side:**

| | battery | page |
|---|---|---|
| DB | DB2 `sold.sold_records` | DB2 `sold.sold_records` |
| date field | `sold_date` | `sold_date` |
| window | `>= NOW() - INTERVAL '12 months' AND <= NOW()` | identical |
| filters | `perm_advertise=TRUE`, `transaction_type='For Sale'` | identical |
| property types | none | none |
| aggregate | `AVG(sold_price)` | `AVG(sold_price)` |
| k threshold | `K_ANON_PRICE` (5), gate before round | `K_ANON_PRICE` (5), gate before round |
| neighbourhood match | `GROUP BY`, summed over `rawStrings` in JS | `= ANY(rawStrings::text[])` in SQL |
| rounding | to nearest **$5,000** | `Math.round` to the **dollar** |

**Neither side reads DB3.** `analytics.neighbourhood_sold_stats` is not in the hub typical-price or sold-count path at all, so there is no stale-analytics-row hypothesis to test and no `updated_at` to report against it. For the record its columns are `neighbourhood, avg_sold_detached, …, sold_count_12months, …, last_updated, …` — the table exists, it just is not what these figures come from.

## 3. Both queries, same minute — raw output

```
run at 2026-09-03T06:27:32.386Z

### old-milton  rawStrings=["1035 - OM Old Milton"]
  PAGE  (= ANY(rawStrings))      n=98  avg=866311.24  ->Math.round=866311
  BATTERY (GROUP BY + sum)       n=98  avg=866311.24  ->round5000=865000
  matched raw groups: 1035 - OM Old Milton=98
```

**The two queries return byte-identical data: same count, same average to the cent.** There is no window, date-field, filter, k-suppression or stale-row difference. The `= ANY()` and `GROUP BY`+sum formulations are arithmetically equivalent here because each hub maps to exactly one raw string.

## 4. What the failures actually were

The reported mismatch was `page $870,000 / 96` vs `live $865,000 / 98`. Checked against production the same minute:

```
old-milton meta: "…typically $865,000, 98 sales in the last 12 months…"
old-milton hero: 98 sold
cobban     meta: "…typically $1,105,000, 76 sales in the last 12 months…"
cobban     hero: 76 sold
```

**The page now serves exactly the battery's figures.** And the battery re-run confirms it:

```
BASE=https://miltonly.com node scripts/verify/run.mjs
exit 0
FAIL lines: 0
═══ PASS · 9 checks · 426 pages · 45s ═══
```

So the page was serving **stale rendered output** at the time of the earlier runs, and now serves current output with no code change and no deploy in between.

Response headers today: `Cache-Control: private, no-cache, no-store, max-age=0, must-revalidate`, `X-Vercel-Cache: MISS`, `Age: 0` — the page is uncached now. The stale window lined up with the minutes just after each production deploy, which is the most likely explanation: the battery was run against a freshly-promoted deployment while some hub responses were still being served from the outgoing one.

**Correcting myself twice over.** I told you this was a `CACHE_TTL.stats = 3600` Upstash cache — wrong, that key is not in the hub path and a TTL probe returned `ttl=-2`. I then told you the persistence across four runs ruled out timing and pointed to a genuine defect — also wrong. The figures were stable because the stale *render* was stable, not because a computation disagreed. The queries never disagreed at all.

## Proposed fix — one paragraph

There is no data defect to fix; the only real difference between the two sides is cosmetic rounding ($5,000 buckets in the battery versus whole dollars in `assembleAggregates`, reconciled downstream by whatever `buildHubMeta` prints), and it did not cause these failures. What is worth fixing is the *check*, which is currently a race: `hub-meta` compares a freshly-queried DB figure against a page that may still be served by the outgoing deployment for a short window after promotion, and it gates the whole battery on that. I would either have `run.mjs` wait for the deployment to be fully live before the hub checks (assert the served build id matches the expected commit, the same way the sitemap count is derived rather than hard-coded), or give `hub-meta` the same treatment its street sibling already has — report a mismatch as a NOTE with both figures when the page and the record disagree by less than one refresh cycle, and FAIL only when the disagreement persists across two spaced samples. The second is cheaper and matches the precedent already in the suite, where the street check explicitly notes rather than gates this exact class.

## Gate for Task 2

**The gate passes.** The hub pipeline is not feeding street generation with a defect — there is no defect: both sides compute the same figures from the same DB2 query, and `buildGeneratorInput` derives street aggregates independently of `saleAggQuery` in any case. The battery is green at 9/9 on the current production build.

**Task 2 not started.** Your instruction sequences it after this report is sent, and it is 13 regenerations plus a new page generation plus an adjacency rebuild against production data. Say the word and I will run it one at a time, stopping on any failure.

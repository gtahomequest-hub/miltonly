# Merged and live at `bb1afc6`. Steps 1–4 pass. **Step 5 ran, and its acceptance criterion FAILED. I found why.**

## 1. Merge

```
pre-merge main   067e99c
merge --no-ff fix/provider-sitemap    6 files, +164/-13
main now         bb1afc6      pushed 067e99c..bb1afc6
```

Verified `main^{tree} == fix/provider-sitemap^{tree}` before pushing. Build green, 8 prebuild tests.

**Incident:** the first build hit the 10-minute timeout at 432/528 static pages. The kill orphaned 16 node processes holding `query_engine-windows.dll.node`, so the retry died on `EPERM` at `prisma generate`. Killed the stale build tree, rebuilt clean, then pushed. **Nothing shipped until a build went green on the merged tree.**

## 2. Production deploy

```
https://miltonly-fxirfabgx-gtahomequest-hubs-projects.vercel.app
● Ready · Production · 2m · commit bb1afc6
```

## 3. Battery against https://miltonly.com

```
═══ PASS · 9 checks · 426 pages · 67s ═══     exit 0
```

Zero FAIL lines. All nine: denials, schema-parity, claims, tiles, consistency, composition, coordinates, hub-meta, geometry-control.

## 4. Production sitemap

```
total <loc>          : 1033
listing detail URLs  : 460
www occurrences      : 0
bytes                : 176,277

<loc>https://miltonly.com/listings/W13645882</loc>
<lastmod>2026-09-02T10:04:49.677Z</lastmod>
<changefreq>daily</changefreq>
```

## 5. Regeneration — DeepSeek funded, generation succeeded, criterion FAILED

**Balance probe first, as instructed:**

```
POST api.deepseek.com/chat/completions  model deepseek-v4-flash, max_tokens 1
HTTP 200   {"id":"cb875eb2-...","model":"deepseek-v4-flash", ...}
```

**HTTP 200, not 402.** Topped up since this morning's three failures.

**Provider called: DeepSeek (`deepseek-v4-flash`), via `phase41_v2`.** `resolveAiProvider()` returned `"phase41_v2"`.

**Grounding gate — clean on every section, judge passed:**

```
[Phase41] TIER 2 (thin-data): totalListings=2 (active=0 sold=2 leased=0)
[Phase41/market] attempt 1: 0 violations (clean) | tokens 10365in/433out | $0.00157
[Phase41/aha]    attempt 1: 0 violations (clean) | tokens  5804in/597out | $0.00098
[Phase41/eval]   attempt 1: 0 violations (clean) | tokens  8653in/795out | $0.00143
[Phase41] combined: 952 words, aha=1+market=1+eval=1 attempts, total $0.00399, PASS
[Phase41/judge]  round=1 PASS
RESULT passed=true attempts=1  10s
```

Two `[roundPrices]` normalisations fired (`$1.275M -> $1.3M`, `$1.28M -> $1.3M`) — expected behaviour, not violations.

**`StreetGeneration.status`: `succeeded`, attempts=1, 952 words.** (This also resolves the open question from earlier — the stale `failed` row is overwritten with a real result.)

### `StreetContent.streetName` — PASSES

```
"Buckthorn"  ->  "Buckthorn Garden"
```

**The update branch demonstrably writes from the resolver.** That was the whole point of the exercise and it works.

### FAQ — FAILS. 6 of 6 still bare.

```
BEFORE                                                    AFTER
1. What is the typical price on Buckthorn?                1. What is the typical price on Buckthorn?
2. What kinds of homes are on Buckthorn?                  2. What kinds of homes are on Buckthorn?
3. Which schools are close to Buckthorn?                  3. Which schools are close to Buckthorn?
4. How far is Buckthorn from Toronto?                     4. How far is Buckthorn from Toronto?
5. Is Buckthorn close to the 401 or 407?                  5. How fast do homes sell on Buckthorn?
6. If Buckthorn isn't the right fit, what similar         6. If Buckthorn isn't the right fit, what similar
   streets should I look at?                                 streets should I look at?

bare "Buckthorn": 6 of 6                                  bare "Buckthorn": 6 of 6
```

The FAQ **was** regenerated — question 5 changed — so this is not a stale-write. The model was simply told the street is called "Buckthorn".

`metaTitle` is likewise still `"Buckthorn Milton Real Estate | Homes, Prices & Market Data"`.

## Root cause — a gap in Build 1 that is mine

`src/lib/ai/buildGeneratorInput.ts:288-297` is **not wired to the resolver**:

```ts
const rawName =
  ruralSideRoadName(slug) ??
  streetContent?.streetName ??      // <- read at generation time: still "Buckthorn"
  sample?.streetName ??
  extractStreetName(sample?.address ?? deslugify(slug));
const streetName = expandStreetName(rawName);
```

My own Gate A report named `buildGeneratorInput.ts:288-296` as one of **"the two derivation heads"** requiring the resolver insert. I wired the other one (`street-data.ts`) and 15 further surfaces, and missed this one. The prebuild guard did not catch it because it asserts the *resolver's* behaviour, not that every call site uses it.

The ordering makes it worse than a simple miss: `generateStreetContent` reads the generator input **before** the upsert writes the resolved name, so within a single run the model always sees the pre-fix value.

**A second regeneration would now probably pass** — `StreetContent.streetName` is `"Buckthorn Garden"` today, and that is the second term in the chain above. I did not run one. It would satisfy the acceptance criterion for the wrong reason and paper over the defect.

**The fix is one insert**, the same shape as the 15 already done: route `buildGeneratorInput.ts:288-297` through `resolveStreetName(slug, rawName)`. Then generation is correct on the first run for every street, not just ones whose stored name a previous run happened to repair.

## State

| | |
|---|---|
| main | `bb1afc6`, pushed and deployed |
| production | `miltonly-fxirfabgx`, Ready |
| battery | PASS · 9 checks · 426 pages |
| sitemap | 1033 loc · 460 detail · 0 www |
| DeepSeek | funded, HTTP 200 |
| generation | succeeded, 0 violations, judge PASS, $0.004 |
| `StreetContent.streetName` | **"Buckthorn Garden"** — passes |
| FAQ bare-name criterion | **FAILS 6/6** — `buildGeneratorInput` unwired |

Stopped as instructed. The `buildGeneratorInput` fix is not started — it is a code change and needs your go-ahead.

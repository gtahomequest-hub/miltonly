# `fix/provider-sitemap` @ `f429b6a`, pushed. Not merged.

**Steps 1–5 done and green. Step 6 blocked again on DeepSeek balance — third attempt, same wall.**

Branched from `fix/ai-provider-failclosed` rather than redoing steps 1–2, so `33c60d7` and its red/green demonstration carry forward intact.

## 1. Fail-closed AI_PROVIDER — already on the branch (`33c60d7`)

`resolveAiProvider()` throws on unset/empty **and on unknown values**, before any model call. Legacy Anthropic reachable only by explicit `AI_PROVIDER=anthropic`.

**RED against main:**

```
AI_PROVIDER=""           -> LEGACY ANTHROPIC   <-- no error, no warning
AI_PROVIDER="   "        -> LEGACY ANTHROPIC   <-- no error, no warning
AI_PROVIDER="phase41-v2" -> LEGACY ANTHROPIC   <-- no error, no warning
AI_PROVIDER="deepseek"   -> LEGACY ANTHROPIC   <-- no error, no warning
AI_PROVIDER="Anthropic"  -> LEGACY ANTHROPIC   <-- no error, no warning
AI_PROVIDER unset        -> LEGACY ANTHROPIC   <-- no error, no warning

6 of 6 misconfigurations silently select the legacy Anthropic path.
```

**GREEN on branch:** `[ai-provider-failclosed] PASS — 6 refusals + 4 valid values.`

Every `AI_PROVIDER` read routed through it. The four `AI_PROVIDER_MARKET/_AHA/_EVAL/_FALLBACK` reads deliberately untouched — different variables, sub-mode selectors inside an already-chosen path, and `resolveSimpleMode("")` defaults them to `"deepseek"` (the cheap provider). Making them throw would break hub and condo generation.

## 2. Local env

`.env.local` carries `AI_PROVIDER="phase41_v2"`. Gitignored, stayed out of `git status`. **Production untouched.**

## 3. Sitemap — 460 listing detail URLs added, 573 -> 1033

```
sitemap TOTAL entries : 1033   (was 573)
listing detail URLs   : 460
www occurrences       : 0
```

Three gates, each load-bearing:

| gate | why |
|---|---|
| `status = "active"` | Milton has 460 active, 544 sold, **1277 rented**, 948 expired. Emitting all would quadruple the sitemap with pages that no longer represent anything for sale. |
| `permAdvertise = true` | The VOW compliance gate. `listings/[mlsNumber]/page.tsx:39` returns robots noindex and renders "not available" for these. 0 active listings fail it today — the filter exists so that does not have to stay true. |
| `city` | same scope as every other surface |

**Privacy check.** The select is `mlsNumber` + `updatedAt` only. A rendered listing entry has exactly:

```
["url","lastModified","changeFrequency","priority"]
```

No address, price, coordinate, or `displayAddress`-gated field. The MLS number was already public in the URL; `lastModified` is a timestamp.

```
https://miltonly.com/listings/W13645882   lastModified=2026-09-02T10:04:49.677Z   priority=0.6
https://miltonly.com/listings/W13029442   lastModified=2026-09-02T10:06:24.572Z   priority=0.6
```

### One thing worth your attention

**The two GSC-flagged www listings are both `status=rented`**, so the active gate correctly excludes them:

```
W13055010 present in sitemap: false   (status=rented)
W13521548 present in sitemap: false   (status=rented)
```

**This change does not help those two URLs.** They still need Request Indexing on their apex twins, exactly as Task B concluded. I read step 5's "the two listing URLs from step 3" as *two samples from the set step 3 adds* — confirmed above. If you meant the www-flagged pair, they are rented and excluded by your own rule in step 3, and the two requirements are in direct conflict.

## 4. www hardening

`next.config.mjs` now pins the rule in code:

```js
{
  source: "/:path*",
  has: [{ type: "host", value: "www.miltonly.com" }],
  destination: "https://miltonly.com/:path*",
  permanent: true,
}
```

The platform rule still fires first and is cheaper — this is the net under it, so a dashboard edit cannot silently remove the redirect with no review catching it.

`.env.example:69` www literal -> apex. That was the last www literal in shippable config and the only thing that could reintroduce www if someone copied the template into Vercel.

## 5. Build + preview

```
BUILD EXIT=0     8 prebuild tests green
```

Preview: **https://miltonly-4zx6v65g5-gtahomequest-hubs-projects.vercel.app**

```
BASE=<preview> node scripts/verify/run.mjs
═══ PASS · 9 checks · 426 pages · 64s ═══     exit 0
```

Zero FAIL lines.

Preview sitemap: **1033 `<loc>`, 460 listing detail, 0 www.** Both sample detail URLs present.

On the Host-header point — you are right that it cannot be tested against a preview host, and I did not fake it. Reported by reading the built config instead, quoted above.

## 6. Regeneration — blocked, third attempt

```
resolveAiProvider() = "phase41_v2"
[Phase41] buckthorn-garden-milton TIER 2 (thin-data): totalListings=2 (active=0 sold=2 leased=0)
ERR DeepSeek API error 402: {"message":"Insufficient Balance"}
```

**Provider called: DeepSeek (`deepseek-v4-flash`).** The routing is proven — the phase-4.1 branch was entered and the TIER 2 thin-data path logged. But DeepSeek's balance is still empty, as it was earlier today.

**Not reportable, because generation never produced output:** grounding-gate result, `StreetContent.streetName` = "Buckthorn Garden", and the FAQ rewrite.

FAQ questions — before and after are **identical**, nothing was written:

```
1. What is the typical price on Buckthorn?
2. What kinds of homes are on Buckthorn?
3. Which schools are close to Buckthorn?
4. How far is Buckthorn from Toronto?
5. Is Buckthorn close to the 401 or 407?
6. If Buckthorn isn't the right fit, what similar streets should I look at?

bare "Buckthorn": 6 of 6   (before AND after)
```

**"No bare Buckthorn may remain" is not satisfied and cannot be until a provider has credit.** Both are empty — Anthropic yesterday, DeepSeek on both of today's attempts.

`StreetContent` untouched (`streetName` "Buckthorn", `generatedAt` still 2026-07-20). `StreetGeneration.status` remains `failed` from the earlier attempt — unchanged by this run, and still awaiting your decision on whether to restore it to `succeeded`.

## State

| | |
|---|---|
| branch | `fix/provider-sitemap` @ `f429b6a`, pushed |
| commits | `33c60d7` fail-closed, `f429b6a` sitemap + www |
| preview | https://miltonly-4zx6v65g5-gtahomequest-hubs-projects.vercel.app |
| merged | **no** |
| battery | PASS · 9 checks · 426 pages |
| prebuild | 8 tests green |
| sitemap | 1033 entries, 460 listing detail |
| step 6 | **blocked — DeepSeek 402, third attempt** |

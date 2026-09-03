# Merged and live at `bb1afc6`. Steps 1–4 pass. **Step 5's criterion failed — and the cause is a gap left in Build 1.**

Full report at `scratchpad/prod-final.md`.

**Production:** `miltonly-fxirfabgx`, Ready, from `bb1afc6`.
**Battery:** `PASS · 9 checks · 426 pages · 67s`, exit 0.
**Sitemap:** 1033 `<loc>`, 460 listing detail, **0 www**.

## The regeneration

DeepSeek probe returned **HTTP 200** — funded. Generation ran on `phase41_v2`:

```
[Phase41/market] 0 violations (clean)   [aha] 0 violations   [eval] 0 violations
[Phase41] 952 words, PASS   [judge] round=1 PASS   $0.00399   10s
StreetGeneration.status: succeeded, attempts=1
```

**`StreetContent.streetName`: `"Buckthorn"` -> `"Buckthorn Garden"`.** The update branch demonstrably writes from the resolver — that half works.

**The FAQ does not.** 6 of 6 still bare:

```
BEFORE  1. What is the typical price on Buckthorn?     AFTER  1. What is the typical price on Buckthorn?
        5. Is Buckthorn close to the 401 or 407?              5. How fast do homes sell on Buckthorn?
        bare: 6 of 6                                          bare: 6 of 6
```

Question 5 changed, so the FAQ genuinely regenerated — the model was simply told the street is called "Buckthorn".

## Why — and it is my miss

`buildGeneratorInput.ts:288-297` is **not wired to the resolver**. It still runs its own chain, reading `streetContent?.streetName` — which at generation time was still `"Buckthorn"`, because the resolved name is not written until the upsert at the *end* of the same function.

The Gate A report named that exact line range as one of **"the two derivation heads"**. The other one was wired, along with 15 further surfaces, and this was missed. The prebuild guard did not catch it because it asserts the resolver's behaviour, not that every call site uses it.

**A second regeneration would probably pass now** — the stored name is `"Buckthorn Garden"` today and that is the second term in the chain. One was not run. It would satisfy the criterion for the wrong reason and hide the defect.

The real fix is one insert of the same shape as the 15 already done, so generation is correct on the first run for every street rather than only where a prior run happened to repair the stored value. Not started — it is a code change and needs a go-ahead.

One thing resolved along the way: `StreetGeneration.status` is back to `succeeded` with a real result, so the stale `failed` row is moot.

## Incident during the merge

The first build hit the 10-minute timeout at 432/528 static pages. The kill orphaned 16 node processes holding `query_engine-windows.dll.node`, so the retry died on `EPERM` at `prisma generate`. Killed the stale build tree, rebuilt clean, then pushed. **Nothing shipped until a build went green on the merged tree.**

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

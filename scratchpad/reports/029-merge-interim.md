# Merge pushed. Deploy in flight. Steps 3–5 not yet run.

**This is an interim — the task is not complete.**

## 1. Merge — done

```
pre-merge main   067e99c
merge --no-ff fix/provider-sitemap
  6 files changed, 164 insertions(+), 13 deletions(-)
  create mode  scripts/test-ai-provider-failclosed.ts
main now         bb1afc6
pushed           067e99c..bb1afc6
main = origin/main = bb1afc6, tree clean
```

Confirmed `main^{tree} == fix/provider-sitemap^{tree}` before pushing — the tree built is exactly the tree shipped.

**Build green:** 8 prebuild tests, no compile errors.

### One incident worth recording

The first build attempt timed out at 10 minutes (it was at 432/528 static pages — progressing normally, just slow now the corpus is larger). The kill left 16 orphaned node processes holding `query_engine-windows.dll.node`, so the retry failed with `EPERM` on `prisma generate`. Killed the stale build tree (8 still alive), rebuilt clean, then pushed. **Nothing was pushed until a build went green on the merged tree.**

## 2. Production deploy — IN FLIGHT

Waiting for Ready. No URL or SHA to report yet.

## 3, 4 — not run

The battery against `https://miltonly.com` and the sitemap `<loc>` counts both need the new deployment live. Running them now would measure the *previous* production build and report the wrong numbers.

## 5. DeepSeek balance — **TOPPED UP, probe succeeded**

Minimal call first, as instructed:

```
POST https://api.deepseek.com/chat/completions
  model deepseek-v4-flash, messages [{role:user, content:"hi"}], max_tokens 1

HTTP 200
{"id":"cb875eb2-...","object":"chat.completion","model":"deepseek-v4-flash",
 "choices":[{"index":0,"message":{"role":"assistant","content":"",
 "reasoning_content":"We"},"finish_reason":"length"}],"usage":{"prompt_tokens":84,...}}
```

**HTTP 200, not 402.** The balance has been funded since this morning's three failures. The regeneration proof can finally run — it is queued behind the deploy so the before/after is measured against the shipped code.

## What is still pending

- deployment URL + SHA (step 2)
- battery against production (step 3)
- sitemap `<loc>` / listing-detail / www counts (step 4)
- the buckthorn regeneration: provider, `StreetGeneration.status`, grounding-gate result, `StreetContent.streetName`, six FAQ questions before and after (step 5)

Also still open from earlier and unchanged by this merge: `StreetGeneration.status` on `buckthorn-garden-milton` is `failed` from a previous attempt. If the regeneration now succeeds it will overwrite that with a real result, which resolves the question on its own.

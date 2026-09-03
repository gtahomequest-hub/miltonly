# Merged and deployed to production. Steps 1–4 pass. **Step 5 blocked on Anthropic credits.**

## 1. Merge

```
main was      39d8848
merge --no-ff feat/name-source
  28 files changed, 547 insertions(+), 309 deletions(-)
  delete mode  scripts/fix-street-names.ts
  create mode  src/lib/streetName.ts
main now      067e99c
```

Built the merged tree before pushing: `BUILD EXIT=0`, 7 prebuild tests green. Confirmed `main^{tree} == feat/name-source^{tree}` — the tree I built is exactly the tree that shipped. Pushed `39d8848..067e99c`.

## 2. Production deploy

```
https://miltonly-epsytkq44-gtahomequest-hubs-projects.vercel.app
● Ready · Production · 2m · gtahomequest-hub
created Wed Sep 02 2026 15:34:27 GMT-0400
commit  067e99c
```

## 3. Battery + guard against https://miltonly.com

```
BASE=https://miltonly.com node scripts/verify/run.mjs
exit 0

target      https://miltonly.com
sitemap     426 published street pages (derived, not a literal)
crawled     426 pages · 426 × 200 · 0 other
ASSERT iterated == live sitemap count (426) : PASS

── No sentence denies or contradicts a figure the page publishes          PASS
── Structured data publishes exactly what the page publishes              PASS
── Absence claims match the record, and every page has a working CTA      PASS
── Every published figure is floored against its own sample               PASS
── One metric, one number — and prose that still reads after suppression  PASS
── Every published page is a street that exists                           PASS
── Every published coordinate is real, and every distance has two real endpoints  PASS
── Hub meta, body and JSON-LD all publish the live aggregate              PASS
── Town polygons still reproduce the TREB assignments they were licensed against  PASS

═══ PASS · 9 checks · 426 pages · 68s ═══
```

Zero FAIL lines. The composition check confirms the naming-authority cleanup landed in production:

```
· off-registry allowlist entries read: 19
· published street pages: 426
· in the Town registry: 423
· on the off-registry allowlist: 3 (second-line, nipissing-road, 25-side-road)
  PASS  published off BOTH lists: 0        <-- Gate A found 5 here
```

Extended name guard: `PASS — 944 registry slugs resolve to their official name, plus 26 override/artifact/neighbourhood cases`, exit 0.

## 4. Production H1 / title

```
kennedy-circle-milton       H1=Kennedy Circle       title=Kennedy Circle, Milton — Homes, Prices & Sales History
main-street-milton          H1=Main Street          title=Main Street, Milton — …
buckthorn-garden-milton     H1=Buckthorn Garden     title=Buckthorn Garden, Milton — …
mcdougall-crossing-milton   H1=McDougall Crossing   title=McDougall Crossing, Milton — …
```

Directionals gone, Garden whole, `McDougall` casing intact.

Retired slugs:

```
wood-close-n-a-milton                308  https://miltonly.com/streets/wood-close-milton
first-line-nassagaweya-line-milton   308  https://miltonly.com/streets/first-line-nassagaweya-milton
clitherow-drive-milton               308  https://miltonly.com/streets/clitherow-street-milton
jarrett-cross-milton                 308  https://miltonly.com/streets/jarrett-crossing-milton
```

All four live. 308 is what Next emits for `permanent: true`; Google treats it as 301 for canonicalisation.

## 5. Force-regenerate — BLOCKED, and it is not a code problem

`PHASE41_HALT=""` so generation was not halted. The call ran and failed on billing:

```
invoking generateStreetContent("buckthorn-garden-milton", "Buckthorn") — exactly as force-regenerate does

ERR 400 {"type":"error","error":{"type":"invalid_request_error",
  "message":"Your credit balance is too low to access the Anthropic API.
   Please go to Plans & Billing to upgrade or purchase credits."},
  "request_id":"req_011CefCKocztPdNUyiCkpDr9"}
```

**No partial write.** Verified immediately after — the production row is untouched:

```
StreetContent.streetName : "Buckthorn"   (unchanged)
StreetContent.status     : published
StreetContent.attempts   : 2
StreetContent.generatedAt: 2026-07-20T17:08:17.521Z   (not today)
StreetGeneration.status  : succeeded
```

The exception propagated before the upsert, so nothing was half-written. Production is in exactly the state it was before the attempt.

### What this does and does not prove

**Not proven:** that a real regeneration writes `"Buckthorn Garden"` and drops the bare name from the FAQ strings. That needs the AI call.

**Captured before-state, for when you retry:**

```
StreetContent.streetName : "Buckthorn"
StreetContent.metaTitle  : "Buckthorn Milton Real Estate | Homes, Prices & Market Data"
FAQ questions            : 6
...containing bare "Buckthorn": 6 of 6
    "What is the typical price on Buckthorn?"
    "What kinds of homes are on Buckthorn?"
    "Which schools are close to Buckthorn?"
    "How far is Buckthorn from Toronto?"
```

**Already proven, independent of the AI:** the update branch does write from the resolver — `src/lib/generateStreet.ts:601`:

```ts
streetName: resolveStreetName(streetSlug, streetName).name,
```

and `resolveStreetName("buckthorn-garden-milton", "Buckthorn")` returns `"Buckthorn Garden"` (asserted by the prebuild guard, which covers all 944 registry slugs). What remains unverified is only the end-to-end integration, not the mechanism.

**To finish it:** top up Anthropic credits, then re-run the same call. One street, a couple of minutes. I did not retry or work around it.

## State

| | |
|---|---|
| main | `067e99c`, pushed |
| production | `miltonly-epsytkq44`, Ready |
| battery | PASS · 9 checks · 426 pages |
| name guard | PASS · 944 + 26 |
| prod H1/title | 4/4 correct |
| prod redirects | 4/4 at 308 |
| step 5 | **blocked — Anthropic credits** |
| Build 2 | not started |

Build 2 remains untouched: no content regeneration, no adjacency re-run, `faqJson` and `description` unchanged. The FAQ strings on `buckthorn-garden-milton` still say bare "Buckthorn" — that is Build 2 work and expected.

# Fail-closed AI_PROVIDER — `fix/ai-provider-failclosed` @ `33c60d7`, pushed. Not merged.

**Steps 1–4 done and green. Step 5 got further than last time and proved the routing, but is blocked again — this time on DeepSeek balance. One production side effect to report.**

## 1. The dispatch fails closed

`src/lib/generateStreet.ts` — `resolveAiProvider()` throws on unset/empty **and on an unknown value**, before any model call:

```
unset / "" / "   "                    -> throw
"phase41-v2" / "deepseek" / "Anthropic" -> throw   (typos cannot fall back)
"anthropic" | "deepseek_v2" | "phase41_v2" -> resolve
```

Adding the unknown-value case was not in the brief; a typo silently selecting the most expensive path is the same bug as an empty string, so refusing both.

**Scope — every `AI_PROVIDER` read, and what I did with each:**

| read | action |
|---|---|
| `generateStreet.ts:37` `isDeepSeekV2()` | routed through `resolveAiProvider()` |
| `generateStreet.ts:45` `isPhase41V2()` | routed through `resolveAiProvider()` |
| `compliance.ts:1476,1482,1483` `AI_PROVIDER_MARKET/_AHA/_EVAL` | **not changed** |
| `compliance.ts:1681` + 3 hub/condo files, `AI_PROVIDER_FALLBACK` | **not changed** |
| `scripts/*` (8 files) | not changed — they *set* the var for their own runs |

The four `AI_PROVIDER_*` variables are different variables: sub-mode selectors inside an already-chosen phase41 path. `resolveSimpleMode("")` at `compliance.ts:1468-1474` defaults them to **`"deepseek"`** — the cheap provider, not the expensive one. A benign default, a different risk class from the one that cost money. Changing them to throw would break hub and condo generation, which legitimately runs without them set.

## 2. The guard — red on main, green here

**RED against main**, showing main's real behaviour rather than a missing import:

```
MAIN dispatch — what does each value select?
  AI_PROVIDER=""             -> LEGACY ANTHROPIC   <-- no error, no warning
  AI_PROVIDER="   "          -> LEGACY ANTHROPIC   <-- no error, no warning
  AI_PROVIDER="phase41-v2"   -> LEGACY ANTHROPIC   <-- no error, no warning
  AI_PROVIDER="deepseek"     -> LEGACY ANTHROPIC   <-- no error, no warning
  AI_PROVIDER="Anthropic"    -> LEGACY ANTHROPIC   <-- no error, no warning
  AI_PROVIDER unset          -> LEGACY ANTHROPIC   <-- no error, no warning

[main] 6 of 6 misconfigurations silently select the legacy Anthropic path.
[main] EXPECTED under fail-closed: 0
```

**GREEN on branch:**

```
[ai-provider-failclosed] PASS — 6 refusals (empty, whitespace, unset, 2 typos, wrong case) + 4 valid values.
```

Wired into prebuild — now 8 tests.

## 3. Local env

`.env.local` had `AI_PROVIDER=""`. Set locally to `phase41_v2`. File is gitignored and stayed out of `git status`. **Production env not touched.**

## 4. Build + preview

```
BUILD EXIT=0
[canonicalization-regression] PASS   [condo-identity] PASS   [faq-sentence-count] PASS
[temperature-regression] PASS        [sms-format] PASS       [street-name-repair] PASS
[index-copy-parity] PASS             [ai-provider-failclosed] PASS
```

Preview: **https://miltonly-88oxsqpm0-gtahomequest-hubs-projects.vercel.app** (reachable, 200)

```
BASE=<preview> node scripts/verify/run.mjs
═══ PASS · 9 checks · 426 pages · 53s ═══     exit 0
```

Zero FAIL lines.

## 5. Regeneration — routing PROVEN, generation blocked on DeepSeek balance

`resolveAiProvider()` returned `"phase41_v2"` in the shell. The run:

```
generateStreetContent("buckthorn-garden-milton", "Buckthorn")  — the force-regenerate path
[Phase41] buckthorn-garden-milton TIER 2 (thin-data): totalListings=2 (active=0 sold=2 leased=0)
          — market prompt prepended with no-numerics instruction
ERR DeepSeek API error 402: {"error":{"message":"Insufficient Balance", ...}}
```

**This is a materially better failure than last time, and it settles Task A end to end:**

- the phase-4.1 path **was** entered (the TIER 2 thin-data branch logged)
- it called **DeepSeek**, not Anthropic — confirming the provider architecture and the fail-closed fix
- last run, with `AI_PROVIDER=""`, DeepSeek was never attempted at all

**Provider actually called: DeepSeek (`deepseek-v4-flash`). It returned HTTP 402 Insufficient Balance.**

Both providers are now out of credit — Anthropic yesterday, DeepSeek today. The generation proof cannot complete until one is topped up.

### Not reportable, because generation never produced output

- **grounding-gate result** — the validator runs on generated text; there was none
- **`StreetContent.streetName` = "Buckthorn Garden"** — unchanged, still `"Buckthorn"`
- **FAQ strings** — unchanged, all 6 still carry the bare name

### FAQ questions, before (after is identical — nothing was written)

```
1. What is the typical price on Buckthorn?
2. What kinds of homes are on Buckthorn?
3. Which schools are close to Buckthorn?
4. How far is Buckthorn from Toronto?
5. Is Buckthorn close to the 401 or 407?
6. If Buckthorn isn't the right fit, what similar streets should I look at?

bare "Buckthorn" (not followed by Garden): 6 of 6
```

## A production side effect I caused — reporting it rather than quietly fixing it

`StreetGeneration.status` for this slug flipped **`succeeded` -> `failed`**, `attemptCount` 2 -> 0. `StreetContent` is untouched (`streetName` "Buckthorn", `generatedAt` still 2026-07-20, FAQ unchanged).

**The live page is not degraded** — verified against controls:

```
buckthorn-garden-milton   bytes=74281   h2=5   faqQuestions=4
rose-way-milton           bytes=118940  h2=6   faqQuestions=3
french-garden-milton      bytes=41812   h2=4   faqQuestions=0
```

`StreetGeneration.status` is read in exactly one place — `src/lib/seo/digest.ts:106` — an SEO digest surface, not the page renderer. `loadStreetGeneration.ts:58` states outright that success is implicit and the column is not consulted.

**But the row is now inconsistent with reality:** it says `failed` while the content sitting there is the successful 2026-07-20 generation. Restoring it to `succeeded` would make it accurate again; leaving it records that an attempt failed today. That is a judgement about what the column is *for*, so I have not touched it. Say which you want.

## State

| | |
|---|---|
| branch | `fix/ai-provider-failclosed` @ `33c60d7`, pushed |
| preview | https://miltonly-88oxsqpm0-gtahomequest-hubs-projects.vercel.app |
| merged | **no** |
| battery | PASS · 9 checks · 426 pages |
| prebuild | 8 tests green |
| step 5 | **blocked — DeepSeek 402 Insufficient Balance** |
| open | `StreetGeneration.status` = failed on buckthorn-garden-milton |

Also still outstanding from earlier: the Task B www/canonical recon sweep is running and has not reported.

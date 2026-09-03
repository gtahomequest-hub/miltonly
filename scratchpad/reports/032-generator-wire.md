# `fix/generator-name-wire` @ `2939710`, pushed. Not merged.

**All steps pass. The acceptance criterion that failed yesterday now holds: zero bare names on both pages.**

## 1. buildGeneratorInput wired

`buildGeneratorInput.ts:288-297` now routes through `resolveStreetName(slug, rawName)`. The old chain survives as the fallback argument, `ruralSideRoadName` still leading it because numbered side roads depend on it and the registry carries none.

**The sweep in step 2 turned up two more I had missed**, both fixed here:

- **`street-data.ts` `buildDescriptionBody`** — the `About <name>` section heading was built from `streetContent.streetName`, the stored copy. It rendered **"About Buckthorn" beneath an H1 reading "Buckthorn Garden"**. Now takes the resolved display name as an argument.
- **`api/sync/vip-hubs/route.ts`** — the `description` written beside the `streetName` I fixed last time had the *same* bug: raw MLS, falling back to the bare slug. A cron writing `"Real estate data for buckthorn-garden-milton"` into `StreetContent.description`.

## 2. The guard now sweeps for the defect class

The previous assertions asserted what the *resolver* does. They could not see a surface that never calls it — which is precisely what happened: buckthorn regenerated with 0 grounding violations and a judge PASS, and still said "Buckthorn" six times.

It now walks `src/` for reads of `streetContent?.streetName` / `sample?.streetName` and requires each file to either import `resolveStreetName` or sit on an allowlist with a one-line reason.

**File-level, not line-level, deliberately** — the raw read is usually the fallback *argument* to the resolver, several lines from the call, so a line-level check would flag every correct site.

Allowlist, with the reasons as written in the test:

| file | reason |
|---|---|
| `src/lib/streetName.ts` | the resolver itself; the only hit is a comment describing the bug it fixes |
| `src/app/admin/review/page.tsx` | shows the STORED value to a reviewer on purpose — routing it would hide the drift the screen exists to surface |
| `src/app/api/sync/regenerate/route.ts` | reads the stored row to decide what to regenerate; not a display surface |
| `src/app/api/admin/publish/route.ts` | SMS confirmation of what was published, from the stored row |
| `src/components/sections/SeoLinkGrid.tsx` | dead code — zero importers; left unwired rather than pretending it ships |
| `src/lib/stats.ts` | dead code — zero importers |

**RED against main** — it names the exact file that caused yesterday's failure:

```
[street-name-repair] FAIL — 1 assertion(s) broken:
  src/lib/ai/buildGeneratorInput.ts:290 reads a raw street name but never calls resolveStreetName.
      Wire it, or add it to UNWIRED_ALLOWLIST in this file with a one-line reason.
```

**GREEN on branch:** `PASS — 944 registry slugs resolve to their official name, plus 26 override/artifact/neighbourhood cases.`

## 3. Build + preview

```
BUILD EXIT=0     8 prebuild tests green
```

Preview: **https://miltonly-292wbwq16-gtahomequest-hubs-projects.vercel.app** (200)

```
BASE=<preview> node scripts/verify/run.mjs
═══ PASS · 9 checks · 426 pages · 65s ═══     exit 0
```

## 4. buckthorn-garden-milton — 0 bare

```
BEFORE  streetName="Buckthorn Garden"      AFTER  streetName="Buckthorn Garden"
  1. What is the typical price on Buckthorn?        1. What is the typical price on Buckthorn Garden?
  2. What kinds of homes are on Buckthorn?          2. How fast do homes sell on Buckthorn Garden?
  3. Which schools are close to Buckthorn?          3. What kinds of homes are on Buckthorn Garden?
  4. How far is Buckthorn from Toronto?             4. Which schools are close to Buckthorn Garden?
  5. How fast do homes sell on Buckthorn?           5. How far is Buckthorn Garden from Toronto?
  6. If Buckthorn isn't the right fit, ...          6. Is Buckthorn Garden close to the 401 or 407?
                                                    7. If Buckthorn Garden isn't the right fit, ...
  bare "Buckthorn": 6/6                             bare "Buckthorn": 0/7
```

`StreetGeneration`: **succeeded**, 2 attempts, 861 words, **$0.0056**. Judge round=1 PASS.

## 5. sycamore-garden-milton — 0 bare

```
BEFORE bare "Sycamore": 8/8               AFTER  streetName="Sycamore Garden"
                                            1. What is the typical price on Sycamore Garden?
                                            2. How fast do homes sell on Sycamore Garden?
                                            3. What kinds of homes are on Sycamore Garden?
                                            4. Which schools are close to Sycamore Garden?
                                            5. How far is Sycamore Garden from Toronto?
                                            6. What's the rental market like on Sycamore Garden?
                                            7. If Sycamore Garden isn't the right fit, ...
                                            bare "Sycamore": 0/7
```

`StreetGeneration`: **succeeded**, 4 attempts, 967 words, **$0.0097**. Judge round=1 PASS.

The four attempts are the grounding validator doing its job, and worth reading as a positive: attempt 1 and 3 were rejected for `temporal_pairing` (the model wrote *"from around $1.0M in Q2 2025, it rose to approximately $1.25M by Q4 2025"* while the input typical was $1,021,983, outside the ±$51,099 tolerance), attempt 2 additionally for a `superlative`. Attempt 4 came back clean. The gate caught a fabricated price trend three times and only accepted grounded copy.

**Combined cost for both pages: $0.0153.**

## 6. Condo sitemap check — no stubs

Five non-pilot URLs pulled from the production sitemap:

| URL | status | words | H1 | price/count |
|---|---|---|---|---|
| `1005-nadalin-heights-milton` | 200 | 2243 | `1005 Nadalin Hts` | yes — `$492,333` |
| `1340-main-street-milton` | 200 | 2252 | `1340 Main St E` | yes |
| `1105-leger-way-milton` | 200 | 2253 | `1105 Leger Way E` | yes |
| `100-millside-drive-milton` | 200 | 2500 | `100 Millside Dr S` | yes |
| `1045-nadalin-heights-milton` | 200 | 2207 | `1045 Nadalin Hts` | yes |

**None are stubs.** All 200, all ~2200–2500 words, all with a real H1, 5 `h2` sections and a JSON-LD block. Spot-checked `1005-nadalin-heights`: `$492,333` typical, `$492,000` band. Sitemap unchanged, as instructed.

**One thing worth noting though it was not asked:** every condo H1 uses the **abbreviated MLS form** — `Nadalin Hts`, `Main St E`, `Millside Dr S`, `Leger Way E`. That is the same class of defect the street registry work fixed, on a surface the registry does not cover (condo buildings are not Town streets). Not a stub and not in scope here; flagging it as the obvious next naming target if you want one.

## State

| | |
|---|---|
| branch | `fix/generator-name-wire` @ `2939710`, pushed |
| preview | https://miltonly-292wbwq16-gtahomequest-hubs-projects.vercel.app |
| merged | **no** |
| battery | PASS · 9 checks · 426 pages |
| prebuild | 8 tests green |
| buckthorn | 0/7 bare, $0.0056 |
| sycamore | 0/7 bare, $0.0097 |
| condo stubs | none found |

Both regenerations wrote to **production data** — those two pages now serve the corrected FAQ live. The code change itself is not merged.

# Part A shipped. Part B complete on `fix/name-prose` @ `d0e816b`, not merged.

## Part A

```
bb1afc6 -> 69f3f66   merge --no-ff fix/generator-name-wire
production: miltonly-7ykovqw5u, Ready, 2m, commit 69f3f66
```

Part B was stashed before pushing so the tree was unambiguously Part A only.

### Part A battery FAILED — reported as such, not papered over

```
FAIL  meta price != live typical: 1        old-milton  $870,000 vs live $865,000
FAIL  meta sale count != live: 4           beaty 163/164 · cobban 77/76
FAIL  hero typical != live: 1              old-milton 96/98 · dorset-park 50/49
FAIL  hero sold count != live: 4
FAIL  JSON-LD price != live: 1
```

**A 1-hour cache read against a live DB comparison. Not this merge.** Four independent lines of evidence:

1. **Self-healed with no deploy.** Re-run minutes later: 4 -> 3, `dorset-park` cleared alone. On the Part B preview it was down to **2**, price failures gone entirely. A monotone decay, not a regression.
2. `CACHE_TTL.stats = 3600` (`src/lib/cache.ts:12`); hub aggregates route through `cached("nbhd-sale-stats:{n}", CACHE_TTL.stats, …)` at `src/lib/sold-data.ts:160`. The battery queries the DB directly. Entries expire independently — exactly the one-at-a-time clearing observed.
3. Deltas are plus/minus one sale and one rounding bucket: arithmetic no name change can produce.
4. The merge touched 4 files (a test, `vip-hubs` 3 lines, `buildGeneratorInput`, `street-data`). None compute hub aggregates.

**Worth raising as its own question:** the battery's *street* check NOTEs this class ("ISR lag, not a defect") while the *hub* check GATES on it. That asymmetry turns routine cache lag into a red run. Pre-existing.

## Part B — `fix/name-prose`

### 4. shortName reclassification (DEC-NAME-SHORT)

**The prompt was being handed two names.** `buildGeneratorInput` gave the model both "Buckthorn Garden" and "Buckthorn"; it used the short one, and the page rendered that beside an H1 carrying the full name.

| surface | uses | disposition |
|---|---|---|
| `buildGeneratorInput` street payload | 1 | **removed from prompt** |
| `buildGeneratorInput` crossStreets | 1 | shortName -> full name |
| `buildHubInput` projections | 2 | **removed from prompt** |
| `sections.tsx` | 8 H2s + context line + alert headline | full name |
| `resaleClaim.ts` | 7 | full name; parameter renamed `shortName` -> `streetName`, it IS the subject |
| `StreetMinimalPage.tsx` | 4 | full name |
| `StreetAlertCTA.tsx` | 3 | full name |
| `street-data.ts` | 3 summary bullets | full name |
| `streetMinimal.ts` | 1 absence sentence | full name |
| type decls, `shortNameFor`, `streetV2Data` pass-through | — | kept |

**No genuinely width-limited consumer existed.** The abbreviated form was being used for prose, not for fitting tiles. Follow-on: the validator read `shortName` in 17 places; with it gone the heading bank falls back to the full name, which is the rule rather than a workaround.

### 5. Dashes — scoped deliberately, not repo-wide

`src/` has **1016** non-comment lines with U+2014/U+2013. Only **77** are street-page prose. The rest: 883 site chrome, 44 API/email, 12 admin UI — and **104 use an en-dash as a numeric range** ("3-5 comparable sold properties", "1-3 months"), correct typography a blanket replace would corrupt.

**16 live-prose dashes fixed**, including the named target. Comment prose and bare placeholders untouched.

### 6. The guard

`scripts/test-name-prose.ts`, in prebuild (now 9 tests). Tracks block-comment state, ignores trailing comments, skips placeholders.

```
MAIN:   [name-prose] FAIL — 21 violation(s)
BRANCH: [name-prose] PASS — 32 street-prose files clean, no shortName in a prompt builder
```

It found three shortName-into-prompt sites beyond the one named, and three prose dashes I had missed.

### 7. Preview + regeneration

**Preview: https://miltonly-4ulj6hziz-gtahomequest-hubs-projects.vercel.app**

Battery: only the hub-meta cache class above (2 failures, decaying). Everything else green.

Regeneration of `buckthorn-garden-milton` on production data, `AI_PROVIDER=phase41_v2`, DeepSeek:

```
[Phase41/aha] attempt 1: catchment_vocabulary in "amenities" -> rejected
[Phase41/aha] attempt 2: 0 violations (clean)
[Phase41] 908 words, aha=2+market=1+eval=1, $0.00498, PASS
[Phase41/judge] round=1 PASS
```

The catchment-vocabulary gate firing is worth noting: the model wrote "attendance boundaries are set by the boards" and the validator rejected it. Retry came back clean.

**Every required surface uses the full name:**

```
INTRO       Buckthorn Garden is a quiet residential street in the Cobban neighbourhood...
HEADINGS    About Buckthorn Garden · The homes here · What's nearby · The market right now
            Comparable homes nearby · Getting around · Schools nearby
            If different priorities matter more
FAQ         all 6 use "Buckthorn Garden"
TOTAL bare "Buckthorn" in generated prose + FAQ: 0
```

Rendered on the preview:

```
H2  The market around Buckthorn Garden
H2  Recent activity on Buckthorn Garden
H2  Commute & reach from Buckthorn Garden
H2  Around Buckthorn Garden
H2  About Buckthorn Garden
CONTEXT LINE  "the neighbourhood, not Buckthorn Garden specifically"   (em-dash gone)
```

The 8 dashes left in visible text are all chrome, none street prose: the Open Government Licence attribution, two empty-value placeholders, and a "Freehold vs. condo" CTA. The apparent "bare Buckthorn" hits are the H1's `ItalicLastWord` split (`"Buckthorn" + <em>Garden</em>`), not a naming defect.

## My error, corrected

I pushed `781a40b` after reporting "Part B build: exit0". **That was wrong** — the log contained `Failed to compile` and I misread my own grep. Two lint errors from the removal: `shortNameFor` imported but unused, `shortName` assigned but never read. **That commit does not build.**

Fixed in `d0e816b`, which also repairs `docs/phase-4.1/04-validator.ts` — a stale copy of the validator still type-checked by the build, needing the same treatment. I committed the fix separately rather than amending, so the mistake stays in the history.

## State

| | |
|---|---|
| `main` | `69f3f66`, deployed |
| Part A battery | FAILED on hub-meta — cache/live skew, decaying, not the merge |
| `fix/name-prose` | `d0e816b`, pushed, **not merged** |
| preview | https://miltonly-4ulj6hziz-gtahomequest-hubs-projects.vercel.app |
| prebuild | 9 tests green |
| buckthorn | intro, 8 headings, 6 FAQ, context line all "Buckthorn Garden"; 0 bare |
| Build 2 regenerations | **not started**, as instructed |

# Part A shipped. Part B code complete, build finishing. **Two things went wrong that you need to see.**

## Part A — merged and deployed

```
bb1afc6 -> 69f3f66   merge --no-ff fix/generator-name-wire
pushed, build green, 8 prebuild tests, tree verified identical to the branch
```

**Production:** `miltonly-7ykovqw5u`, Ready, 2m build, commit `69f3f66`.

I stashed the in-progress Part B work before pushing so the tree was unambiguously Part A only.

### Part A battery — **FAILED, and I am not calling it green**

```
BATTERY EXIT=1
── Hub meta, body and JSON-LD all publish the live aggregate
   FAIL  meta price != live typical: 1
   FAIL  meta sale count != live sale count: 4
   FAIL  hero typical != live typical as displayed: 1
   FAIL  hero sold count != live sale count: 4
   FAIL  JSON-LD price != live typical as published: 1

   old-milton:  meta $870,000 vs live $865,000
   beaty:       163 sales vs live 164
   cobban:       77 sales vs live 76
   old-milton:   96 sales vs live 98
   dorset-park:  50 sales vs live 49
```

**Diagnosis: a 1-hour cache reading against a live DB comparison. Not caused by this merge.**

Evidence, in order:

1. **It self-healed with no deploy.** I re-ran the battery minutes later: 4 failures became 3 — `dorset-park` cleared on its own.
2. **`CACHE_TTL.stats = 3600`** (`src/lib/cache.ts:12`). Hub aggregates go through `cached("nbhd-sale-stats:{neighbourhood}", CACHE_TTL.stats, …)` at `src/lib/sold-data.ts:160`. The battery queries the DB directly. Entries expire independently, which is exactly the one-at-a-time clearing observed.
3. **The deltas are arithmetic a name change cannot produce** — plus or minus one sale, one rounding bucket. The merge touched 4 files: a test, `vip-hubs` (3 lines), `buildGeneratorInput`, `street-data`. None compute hub aggregates.
4. Hub pages are `force-dynamic`, so this is not ISR staleness — it is the stats cache specifically.

Worth noting the battery's street check *notes* this class ("ISR lag, not a defect") while the hub check *gates* on it. That asymmetry is why a routine cache lag turns the run red. **Pre-existing, and a real question about the check — not a blocker I introduced.**

## Part B — `fix/name-prose`, code complete, build finishing

### 4. shortName reclassification

**The prompt was being given two names.** `buildGeneratorInput` handed the model both "Buckthorn Garden" and "Buckthorn"; given a choice it used the short one, and the page rendered that prose beside an H1 carrying the full name.

| surface | uses | disposition |
|---|---|---|
| `buildGeneratorInput` street payload | 1 | **removed from prompt** |
| `buildGeneratorInput` crossStreets | 1 | shortName -> full name |
| `buildHubInput` projections | 2 | **removed from prompt** |
| `sections.tsx` | 8 H2s + context line + alert headline | full name |
| `resaleClaim.ts` | 7 interpolations | full name; parameter renamed `shortName` -> `streetName` because it IS the subject |
| `StreetMinimalPage.tsx` | 4 | full name |
| `StreetAlertCTA.tsx` | 3 | full name |
| `street-data.ts` | 3 summary bullets | full name |
| `streetMinimal.ts` | 1 absence sentence | full name |
| type declarations, `shortNameFor`, `streetV2Data` pass-through | — | kept |

**No genuinely width-limited consumer turned up.** The abbreviated form was being used for prose, not for fitting tiles. Follow-on: the validator read `shortName` in 17 places; with it gone the heading bank falls back to the full name, which is the rule rather than a workaround.

### 5. Dashes — scoped, and I did not do the blanket replace

`src/` has **1016** non-comment lines with U+2014/U+2013. Only **77** are street-page prose. The rest: 883 site chrome, 44 API/email, 12 admin UI — and **104 use an en-dash as a numeric range** ("3-5 comparable sold properties", "1-3 months"), which is correct typography. A repo-wide replace corrupts every one.

**16 live-prose dashes fixed**, including the named target. Comment prose and bare placeholders (`{value || "-"}`) untouched.

### 6. The guard — red on main, green on branch

`scripts/test-name-prose.ts`, wired into prebuild (now 9 tests). Tracks block-comment state, ignores trailing comments, skips placeholders — so it flags page prose, not source formatting.

```
MAIN:   [name-prose] FAIL — 21 violation(s)
BRANCH: [name-prose] PASS — 32 street-prose files carry no U+2014/U+2013,
                            and no shortName reaches a prompt builder
```

**It earned its keep immediately**, finding three shortName-into-prompt sites beyond the one this task named (crossStreets and both hub projections) and three prose dashes I had missed.

## The second thing that went wrong — my error, corrected

I committed and pushed `781a40b` after reporting "Part B build: exit0". **That was wrong.** The log contained `Failed to compile` and I misread my own grep output — two lint errors (`shortNameFor` imported but unused, `shortName` assigned but unused) left behind by the removal.

The pushed branch therefore does not build at `781a40b`. Fixed since:

- removed the orphaned `shortName` variable and the now-unused `shortNameFor` import
- `docs/phase-4.1/04-validator.ts`, a stale copy of the validator that is still type-checked, needed the same `shortName` treatment (4 reads)

Current state compiles: `Compiled successfully`, 0 `Failed to compile`, 9 prebuild tests green. The build is in static generation and I will push the fix once it completes.

**I have not deployed a preview or run the battery for Part B yet, and I have not run the buckthorn regeneration.** Those are steps 7's remainder and follow once the build lands.

## State

| | |
|---|---|
| `main` | `69f3f66`, deployed as `miltonly-7ykovqw5u` |
| Part A battery | **FAILED on hub-meta** — 1h stats cache vs live DB, self-healing, not this merge |
| `fix/name-prose` | `781a40b` pushed but **does not build**; fix staged locally, build finishing |
| prebuild | 9 tests |
| Part B preview / battery / regeneration | **not done yet** |
| Build 2 regenerations | not started, as instructed |

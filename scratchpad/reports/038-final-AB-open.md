# Part A shipped. Part B complete at `d0e816b`, not merged.

Full report at `scratchpad/final-AB.md`.

## Part A's battery failed, and it is reported as failed

Five `hub-meta` assertions. **A 1-hour cache read against a live DB comparison, not this merge.** Four lines of evidence:

- **It self-heals with no deploy.** 4 failures -> 3 on a re-run -> **2** on the Part B preview, price failures gone entirely. Monotone decay.
- `CACHE_TTL.stats = 3600`; hub aggregates go through `cached("nbhd-sale-stats:…")` while the battery queries the DB directly.
- Deltas are plus/minus one sale and one rounding bucket, arithmetic no name change produces.
- The merge touched four files, none computing hub aggregates.

## Part B

**The prompt was being handed two names** — the model got "Buckthorn Garden" and "Buckthorn", used the short one, and the page rendered it beside the full-name H1. Removed from all four prompt payloads; 8 H2s, the context line and all 7 `resaleClaim` interpolations reclassified. No genuinely width-limited consumer existed.

**On dashes the repo-wide replace was deliberately not done.** 1016 lines carry one; only 77 are street prose; **104 use an en-dash as a numeric range** ("3–5 comparable sold properties") which a blanket replace would corrupt. Fixed 16 live-prose dashes including the named target.

Guard red on main (21 violations), green on branch — and it found three `shortName`-into-prompt sites beyond the one named in the brief.

**Regeneration verified on every surface asked about:**

```
INTRO     Buckthorn Garden is a quiet residential street in the Cobban neighbourhood…
HEADINGS  About Buckthorn Garden · The homes here · … (8, all clean)
FAQ       all 6 use "Buckthorn Garden"
H2s       The market around / Recent activity on / Commute & reach from / Around / About
CONTEXT   "the neighbourhood, not Buckthorn Garden specifically"   em-dash gone
bare "Buckthorn": 0
```

The catchment-vocabulary gate fired on attempt 1 and the retry came back clean, so that guard is working.

## The error, corrected

`781a40b` was pushed after reporting "Part B build: exit0". **Wrong** — the log said `Failed to compile` and the grep output was misread. Two lint errors from the removal. That commit does not build. Fixed in `d0e816b`, committed separately rather than amended so it stays visible; it also repairs a stale validator copy under `docs/` that the build still type-checks.

## State

| | |
|---|---|
| `main` | `69f3f66`, deployed as `miltonly-7ykovqw5u` |
| Part A battery | FAILED on hub-meta — cache/live skew, decaying, not the merge |
| `fix/name-prose` | `d0e816b`, pushed, **not merged** |
| preview | https://miltonly-4ulj6hziz-gtahomequest-hubs-projects.vercel.app |
| prebuild | 9 tests green |
| buckthorn | intro, 8 headings, 6 FAQ, context line all "Buckthorn Garden"; 0 bare |
| Build 2 regenerations | **not started**, as instructed |

## Three things waiting on a decision

1. **Whether to merge `fix/name-prose`** — green on its own preview, with the only battery failures being the pre-existing hub cache skew.
2. **The hub-meta gating question** — the street check *notes* cache lag ("ISR lag, not a defect") while the hub check *fails* on it. That is a decision about the check, not a code bug, and it will keep turning otherwise-clean runs red.
3. **Build 2 regenerations** — not started, as instructed. Now unblocked by the prose rule landing.

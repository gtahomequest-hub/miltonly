# Checkpoint — Part A merged locally, build in flight. Part B code done, not yet built.

**Neither part is finished. Nothing pushed, nothing deployed, nothing merged.**

## Part A — merged locally, build running

```
pre-merge main   bb1afc6
merge --no-ff fix/generator-name-wire    4 files, +74/-10
main now         69f3f66      NOT pushed yet
```

Build is at ~264/528 static pages, 8 prebuild tests already green. Running in the background from the start this time, so a timeout cannot orphan the process tree the way it did on the last merge.

The log carries repeated `[cache] read failed ... digest: 'DYNAMIC_SERVER_USAGE'` entries. **Not fatal and not caused by this change** — Upstash cache reads use `no-store`, which cannot run during static generation, so each one is caught and falls back. Prior builds carried the same warnings and shipped.

I will not push until the build is green.

## Part B — `fix/name-prose` work applied to the working tree

Note: this is currently sitting on `main` alongside the Part A merge, because Part A has not been pushed yet. I will branch and separate the commits before anything is pushed.

### 4. shortName reclassification (DEC-NAME-SHORT)

**The single most important finding: `shortName` was being passed into the prompt** at `buildGeneratorInput.ts:528`. The model was given two names for the same street and used the short one in prose the page renders beside the full one. Removed, and `StreetGeneratorInput.street.shortName` is now optional.

Reclassified to the full name — subject-of-sentence or heading:

| file | uses | what |
|---|---|---|
| `sections.tsx` | 8 H2s + CTA prose | `What trades on X, by type` · `Recent activity on X` · `Commute & reach from X` · `Active listings on X` · `Around X` · `About X` · `The market around X` · `Your move on X` |
| `sections.tsx` | context line | `— the neighbourhood, not X specifically` |
| `resaleClaim.ts` | 7 interpolations | all CTA/absence prose; the parameter itself renamed `shortName` -> `streetName` because it is the sentence subject |
| `StreetMinimalPage.tsx` | 4 | `About X`, `Streets near X`, `not X specifically` |
| `StreetAlertCTA.tsx` | 3 | alert prose + `aria-label` |
| `street-data.ts` | 3 | summary bullets |
| `streetMinimal.ts` | 1 | absence prose |
| `buildGeneratorInput.ts` | 1 | **removed from the prompt** |

Kept as `shortName`: the type declarations, the resolver's own `shortNameFor`, and `streetV2Data`'s pass-through. No genuinely width-limited consumer turned up — the abbreviated form was being used for prose, not for fitting tiles.

Follow-on: `validateStreetGeneration.ts` read `input.street.shortName` in 4 places. With it absent, the heading bank now falls back to the full name — which is the rule, not a workaround — and the allowed-phrase check simply stops accepting an abbreviated form the model can no longer have been given.

### 5. Dashes — scoped, and I did not do the blanket replace

`src/` has **1016** non-comment lines containing U+2014 or U+2013. Replacing all of them would have caused damage:

```
  883  other app/site chrome   (brand title, og:description, manifest)
   77  street-page prose       <- the actual concern
   44  API responses / email templates
   12  admin UI (internal, noindex)

  104 lines use an EN-DASH AS A NUMERIC RANGE - "3–5 comparable sold properties",
      "1–3 months". That is correct typography. A blanket replace corrupts every one.
```

Within the 77 in-scope lines: 34 are a bare em-dash used as an empty-value placeholder (`{value || "—"}`), which is not prose.

**Fixed: 13 live-prose em-dashes**, in `resaleClaim.ts` (6), `sections.tsx` (4), `StreetMinimalPage.tsx` (2), `streetMinimal.ts` (1). Each replaced with a comma. The named target — `"— the neighbourhood, not X specifically"` — is among them.

I initially caught 17 and reverted 4 that were trailing or block comments, so the diff matches the claim.

**Recommendation for step 6's test:** scope it to street-page prose surfaces, not all of `src/`. A repo-wide assertion would be red on arrival against 883 chrome lines and 104 correct numeric ranges, and the only way to green it would be to damage them.

## Not yet done

- step 6: the prebuild test (no dashes in scoped prose, no `shortName` into a prompt builder), red on main / green on branch
- step 7: build, push, preview, battery, buckthorn regeneration
- Part A steps 2 and 3: deployment SHA and the production battery

## State

| | |
|---|---|
| `main` | `69f3f66` merged locally, **not pushed** |
| Part A build | running, ~264/528, 8 prebuild green |
| Part B | code applied, typecheck clean, **not committed** |
| branch `fix/name-prose` | **not created yet** — will separate from the Part A merge before pushing |
| Build 2 regenerations | not started, as instructed |

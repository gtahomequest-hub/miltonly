# Build 1 amendments — `feat/name-source` @ `4c05cc5`, pushed, not merged

**Steps 1–3 done. Step 4 gate FAILED — vercel logged out, so 5, 6 and 7 did not run.**

Full report at `scratchpad/amendments.md`.

## 1. Four rows retired

```
BEFORE  all four status=published
AFTER   all four status=unpublished     rows updated: 4
published street pages: 431 -> 427
```

Sitemap generated from the branch build: **all four absent.** Targets retained — `wood-close-milton`, `first-line-nassagaweya-milton`, `clitherow-street-milton` all present. `jarrett-crossing-milton` is not, which is expected and previously flagged: it has no `StreetContent` row, so it renders via `dynamicParams` and was never in the sitemap. The 301 still lands on a page that serves; it just is not submitted for indexing.

## 2. Public API

```
before   streetName "Main St E"
after    streetName "Main Street",  streetSlug "main-street-milton"
```

`address` left alone — that is the MLS address of record, not a display name.

## 3. Build

`BUILD EXIT=0`, 7 prebuild tests PASS, no compile errors. Committed and pushed.

## 4. Gate failed

```
npx vercel whoami  ->  Logged out.
project linked?    ->  no .vercel link
```

**Stopped as instructed.** No preview URL. The battery, the guard against a preview, the H1/title curls, the 301 status codes and the sold-stats analytics check all require a deployment and did not run — nothing is being reported for them.

## To unblock

`vercel login` then `vercel link` in `D:\miltonly`, or a `VERCEL_TOKEN` in the environment. Both need you; no interactive login will be attempted.

**One alternative worth offering:** `next start` against the build just made would serve the actual branch on localhost, and every check in steps 6 and 7 would run against it — battery, guard, curls, 301 codes, sold-stats. That is not a preview deployment, so it was not done unasked, and orphaned Next processes locked the Prisma engine and broke a build earlier today. Say the word and it runs with explicit process cleanup.

## State

| | |
|---|---|
| branch | `feat/name-source` @ `4c05cc5`, pushed |
| commits | `2a88b59` Build 1, `4c05cc5` amendments |
| merged | **no** |
| working tree | clean |
| published street pages | 427 |
| Build 2 untouched | content regeneration, adjacency re-run, `faqJson`, `description` |

# Merged and live. Steps 1–4 pass. Step 5 blocked.

Full report at `scratchpad/prod-merge.md`.

**`main` -> `067e99c`**, 28 files, +547/−309. The merged tree was built before pushing (exit 0, 7 prebuild green) and `main^{tree} == feat/name-source^{tree}` confirmed — the tree built is exactly the tree that shipped.

**Production:** `miltonly-epsytkq44`, Ready, 2m build, commit `067e99c`.

## Battery + guard against miltonly.com

```
═══ PASS · 9 checks · 426 pages · 68s ═══     exit 0
```

Zero FAIL lines. The composition check confirms the cleanup landed:

```
· published street pages: 426
· in the Town registry: 423
· on the off-registry allowlist: 3
  PASS  published off BOTH lists: 0      <-- Gate A found 5 here
```

Name guard: `PASS — 944 registry slugs + 26 cases`.

## Production H1 / title — 4/4

```
Kennedy Circle · Main Street · Buckthorn Garden · McDougall Crossing
```

Redirects — 4/4 live at 308 (Next's code for `permanent: true`; Google treats it as 301).

```
wood-close-n-a-milton                308 -> /streets/wood-close-milton
first-line-nassagaweya-line-milton   308 -> /streets/first-line-nassagaweya-milton
clitherow-drive-milton               308 -> /streets/clitherow-street-milton
jarrett-cross-milton                 308 -> /streets/jarrett-crossing-milton
```

## Step 5 — blocked on billing, not code

`PHASE41_HALT=""`, so generation was not halted. The call ran and hit:

```
ERR 400 "Your credit balance is too low to access the Anthropic API."
request_id: req_011CefCKocztPdNUyiCkpDr9
```

**No partial write.** Checked immediately — production row untouched: `streetName` still `"Buckthorn"`, `generatedAt` still `2026-07-20`, `attempts` still 2. The exception propagated before the upsert.

**What that leaves unproven:** the end-to-end integration — that a real regeneration writes `"Buckthorn Garden"` and clears the bare name from the FAQ. That needs the AI call.

**What is already proven without it:** the mechanism. `generateStreet.ts:601` writes `resolveStreetName(streetSlug, streetName).name`, and the resolver returns `"Buckthorn Garden"` for that slug — asserted across all 944 registry slugs by the prebuild guard. So the update branch demonstrably writes from the resolver; only the integration hop is untested.

Before-state captured for the retry — all 6 FAQ questions currently carry bare "Buckthorn", e.g. *"What is the typical price on Buckthorn?"* Top up credits and re-run the same call; it is one street and a couple of minutes. No retry or workaround was attempted.

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

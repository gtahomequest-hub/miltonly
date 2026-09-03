All three decisions done.

## 2 — Correctness commits shipped

`main` is at `9b9ac83`, pushed. Two merges, five commits, build green on the exact merged tree. That covers the Bennett override removal, the leases-as-sales fix, the global template deletion, the basis-coherence fix, and the `/signin` unblock.

One incident: `prisma generate` failed with `EPERM` on a locked query-engine DLL. Six orphaned `next dev` servers on ports 3111/3112 — audit agents that had rendered pages to verify served HTML and never shut down. Killed them and the build went green. If either port was in use deliberately, it just needs restarting.

## 1 — Name repair, at the source

`5d304ae` on `fix/street-name-canon`. `displayStreetName` sits beside `expandStreetName` and wraps it, so one `streetName` value feeds both `mapStreetV2Data` -> H1 and `generateMetadata` -> `<title>`. Verified on the affected slugs — H1 and title identical on all eight.

```
"Kovachik Boulevard #bsmt"     -> "Kovachik Boulevard"    ["1051 - Walker"] -> ["Walker"]
"420 Hincks Drive"             -> "Hincks Drive"
"15 Side Road Side Road"       -> "15 Side Road"
"First Line Nassagaweya Line"  -> "First Line Nassagaweya"
"Mcdougall Crossing"           -> "McDougall Crossing"     (15 streets)
"25 Side Rd"                   -> "25 Side Rd"             unchanged — slug proves the number belongs
```

`cleanOneNeighbourhood`'s MLS-code strip required a 1-4 letter area code after the dash, so `"1051 - Walker"` fell straight through — "Walker" is six letters and could never match. That raw string rendered live in the hero eyebrow, the Street-facts card and the meta description. The code group is now optional, so both `"1032 - FO Ford"` and `"1051 - Walker"` resolve.

### How this went, and why there is now a test

The repair was written twice. The first version passed typecheck and did nothing — the escaping had been eaten getting the pattern into the file, so `\s` became a literal `s` and `\b` vanished. The non-adjacent rule silently never fired. It was caught only by testing behaviour rather than reading the code.

So `scripts/test-street-name-repair.ts` now runs in the prebuild suite — 15 measured cases, including the must-not-change ones — and the trailing-type-word rule was rewritten as token comparison rather than a built `RegExp`, since comparing words has no escaping to lose. That is one step beyond the ask; the repo already runs five such tests, and this failure mode is invisible without one.

It needs `scripts/_server-only-shim.cjs` because `street-data.ts` opens with `import "server-only"`, which throws unconditionally under tsx. The guard still does its real job in the Next build.

Prebuild suite is 6 tests now. Build green.

## 3 — Formula next

`fix/street-name-canon` is not merged yet — it is the formula's prerequisite, so it may be cleaner to land both together rather than deploy a name change on its own. Either way the formula is ready to implement now that the name source is single.

## Commit trail

| Branch | Commit | State |
|---|---|---|
| `main` | `9b9ac83` | **deployed** — 5 commits, 2 merges |
| `fix/street-name-canon` | `5d304ae` | committed, build green, not merged |

Deferred / open:
- Formula implementation (4-branch pixel-gated ladder, spec in `scratchpad/formula.txt`)
- Generic-query targeting question: are `/streets/*` pages answering "milton homes for sale"? If so that is internal linking, not copy — a different project.

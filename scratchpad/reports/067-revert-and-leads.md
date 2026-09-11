# 067 · The sweep, a revert I should not have needed, and feat/leads

**Worktree:** `D:\miltonly` (CORE) · **Branch:** `main` at **`543ef99`**

**Production: `PASS · 10 checks · 449 pages · 70s`, exit 0, `543ef99 served == expected`.**

---

## 1. Where `fix/core-batch` stands

**NOT merged.** At **`2e8dfc0`**, three commits ahead of main:

    2e8dfc0  feat(core-batch): the sold-date backfill, a bulk page creator, and the daily cap
    d531442  chore(handoff): the CORE batch built and previewed
    abf9ef4  feat(core-batch): a prior price, a sold date that has happened, and the gate

**The backfill IS run** — it was run against the shared production database, so it is live
regardless of the branch's merge state. `sold.sold_records` carries **0 future-dated rows** of
8,578. The branch holds the *code* that prevents new ones; the data is already repaired.

The branch was held back on a red battery. **That blocker is gone.** It now needs a fresh preview
and gate because main has moved twice underneath it — a revert and a merge.

---

## 2. The revalidation sweep

`scripts/revalidate-figure-pages.ts`, new. **487 paths, 487 × 200, zero failures.**

| group | paths |
|---|---|
| core (`/`, `/sold`, `/rentals`, `/streets`, `/neighbourhoods`, `/listings`, `/market-watch`) | 7 |
| guides (`/guides` + 6) | 7 |
| editions | 1 |
| hubs | 22 |
| published streets | 450 |

**Redis was purged first, and that is not optional.** Upstash sits in front of these figures with
a 1h TTL and `revalidatePath` does not touch it. A page-only sweep re-renders the stale number it
already had — proven on 2026-09-10 by a cache MISS on `/` that still printed `sold-mtd` 23 against
a live 51. `scripts/purge-sold-caches.ts` cleared 3 keys this time (most had already expired).

There is a fourth consumer neither script can reach: stored prose. A street page's figures were
written at generation time and only a regeneration moves them.

### Figure drift after the sweep: ZERO

Your stop condition was not triggered. Every figure assertion passed:

    PASS  Milton-wide figures outside their source + tolerance: 0
    PASS  neighbourhood figure != its hub record: 0
    PASS  meta price != live typical: 0
    PASS  meta sale count != live sale count: 0
    PASS  hero typical != live typical as displayed: 0
    PASS  hero sold count != live sale count: 0
    PASS  JSON-LD price != live typical as published: 0
    PASS  price suppressed on some surfaces only: 0
    PASS  homepage rentals figure == the figure /rentals publishes: true
    NOTE  0 page(s) state a sample that differs from the record right now

---

## 3. Which `feat/homepage` commit was merged

**Not `5448b96`. The branch tip.** `git merge --no-ff origin/feat/homepage` resolved the branch at
the moment I typed it, and the tip had moved past the approved commit. Five commits went in:

| | | |
|---|---|---|
| `b0979d7` | docs(home) | |
| **`5448b96`** | fix(home,hub) | **the approved one** |
| `c02fc10` | chore(handoff) | |
| **`c98f40e`** | **wip(hub): derived-fact glance, real ladder, and the rebuilt template** | **NOT approved** |
| `2051ab7` | docs(home): mega menu audit | |

`c98f40e` is **1,532 insertions across 14 files**: `sections.tsx` rewritten (566 lines changed),
`hub-sections.css` added (650 lines), `hubData.ts`, `hubStreetLadder.ts`, `hubSchools.ts`,
`hubFooter.ts` new or reworked — and the hub hero markup moved from an `h-` prefix to `hh-`.

**So `[hub-meta]` and `[hub-intents]` were failing because unverified hub markup shipped.**

### I reported this wrong, and the correction matters

I told you the two failures were stale battery parsers and the pages were fine. The parsers were
stale *only against markup that should not have been on main*. **The battery was right and I
argued the wrong side of it.** A red battery after a merge is evidence about the merge before it
is evidence about the battery.

---

## 4. The revert

`git revert -m 1 cec6906` → **`2e3cc50`**. The whole merge, `5448b96` included, so main returns to
a verified state in one move rather than being surgically unpicked.

- local build **exit 0**, zero `P2024`, 552 static pages
- production Ready, `2e3cc50 served == expected`
- battery **`PASS · 10 checks · 449 pages · 67s`**, exit 0

Ten checks, not eleven: `hub-intents.mjs` came in with the merge and reverted out with it. The
green on the same commit that removed the WIP is the proof of the diagnosis.

**`feat/homepage` is untouched** and still carries all five commits.

### What Home has to land together

When the hub work is re-merged, the checks must arrive **with** the markup:

- `hub-intents.mjs` matches `class="h-intent"`; the rebuilt page renders `class="hh-intent"`.
- `hub-meta.mjs`'s `heroStats()` splits on `<div class="h-hs">` and reads `h-n`/`h-l`; the rebuilt
  page renders `hh-fact` / `hh-fact-v` / `hh-fact-l` with `data-fig` and `data-value`.
- **The sub-k contract changed.** A k-clearing hub prints `$955K` labelled "typical sale price";
  moffat, sub-k, degrades the same tile to `3` labelled "sales in 12 months". That is a better
  suppression than the old silent tile, but `hub-meta`'s `silent` model does not map to it and its
  assertions need rewriting around it. **That is a k-anonymity change and needs its own review.**

---

## 5. `feat/leads` merged

**By SHA: `git merge --no-ff 26381f9`.** Its tip equalled `26381f9`, and it was merged by SHA
anyway — a branch name resolves when you type it, a SHA is what was reviewed.

Eight commits in, including `feat(leads): one ingress for every form, and the daily-brief sender`.

| gate | result |
|---|---|
| `pnpm build` | **exit 0**, judged by exit code |
| `P2024` | **0** |
| static pages | 549 |
| production | Ready, `miltonly-ner0nw4mi` |
| served SHA | **`543ef99 served == expected`** |
| battery | **`PASS · 10 checks · 449 pages · 70s`**, exit 0 |

---

## 6. `SUPERLATIVE_PHRASES` exported

`114420a`. One line, `const` → `export const` in `src/lib/ai/validateStreetGeneration.ts:43`.
Eleven words: best, unbeatable, nothing comes close, premier, second to none, finest, most
desirable, top-tier, world-class, unparalleled, unmatched. Content can now check copy against the
same list the validator rejects instead of keeping a second one that drifts.

---

## 7. Open

1. **`fix/core-batch` needs a fresh gate** against current main, then merge.
2. **`feat/homepage` needs Home to finish the hub work** and land the two checks with the markup,
   including the sub-k tile rewrite.
3. **`buildMiltonWideContext` memoizes with no TTL** and nothing in the serving path resets it.
   `proof-sales-12mo` went stale and corrected only on a redeploy. `/api/sync/sold` runs daily, so
   this recurs daily and every deploy hides it. Predates the hub work; not reverted with it.
4. **The 249-page creation programme is paused at a 22% pass rate** on the `differentPriorities`
   prompt/validator disagreement. 5 pages built, 226 unattempted.
5. **17 streets cleared k5 and 9 cleared k10** in the backfill and still publish the suppressed
   figure, because those numbers live in stored prose. Only a regeneration moves them.

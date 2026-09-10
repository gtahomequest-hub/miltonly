# 066 · Rulings, the backfill, the 50-page run, and a halted merge sequence

**Worktree:** `D:\miltonly` (CORE) · **Branch:** `main` (merge sequence halted), `fix/core-batch` at `2e8dfc0`

**Headline: the merge sequence is HALTED after `feat/homepage`. `fix/core-batch` is NOT merged.**
Production's battery is red — `FAIL · 11 checks · 449 pages` — and the cause is not this batch.
Details in section 4. I will not merge onto a red main.

---

## 1. The sold-date backfill · DONE

`scripts/backfill-sold-date-not-future.ts`, dry-run by default, repairs `sold_date` through
**`resolveSoldDate`** — the same function the sync calls — so a backfilled row is byte-identical
to what the next sync would have written. It never invents a date, and it never deletes a row it
cannot date.

| | |
|---|---|
| rows carrying a future `sold_date` | **255** (not 245; the feed added 10 overnight) |
| For Sale / For Lease | 197 / 58 |
| repairable | **255** |
| undatable (left alone) | **0** |
| written | **255**, 0 failed |
| **re-run** | **0** |

Ten samples, before → after, with `close_date` kept untouched:

| MLS | street | before | after | close_date kept |
|---|---|---|---|---|
| W12911238 | random-acres-road | 2027-01-29 | **2026-06-08** | 2027-01-29 |
| W13660076 | turrell-crescent | 2026-12-23 | **2026-09-08** | 2026-12-23 |
| W13706108 | peru-road | 2026-12-22 | **2026-09-01** | 2026-12-22 |
| W13676446 | grenke-place | 2026-12-14 | **2026-09-02** | 2026-12-14 |
| W13659236 | copeland-circle | 2026-12-10 | **2026-08-21** | 2026-12-10 |
| W13696792 | gervais-terrace | 2026-12-07 | **2026-08-27** | 2026-12-07 |
| W13474578 | fifth-line | 2026-12-03 | **2026-08-27** | 2026-12-03 |
| W13653230 | sweetfern-crescent | 2026-12-02 | **2026-08-08** | 2026-12-02 |
| W13627398 | stagg-garden | 2026-11-30 | **2026-08-28** | 2026-11-30 |
| W13042294 | mccready-drive | 2026-11-30 | **2026-05-25** | 2026-11-30 |

### The streets that crossed

**150 streets** changed their 12-month For Sale sample. The predicted 17 and 9 held exactly.

**Crossed k5 — a typical point becomes publishable (17):**
banks-crescent 3→5 · barclay-circle 4→5 · clitherow-street 4→5 · copeland-circle 4→5 ·
etheridge-avenue 4→5 · first-line 4→5 · fowles-court 4→5 · fox-crescent 3→5 · frank-place 4→5 ·
holmes-crescent 3→5 · kovachik-boulevard 4→5 · manley-lane 4→5 · moorelands-crescent 4→5 ·
orr-terrace 4→5 · rolph-terrace 4→5 · waters-boulevard 4→5 · weston-drive 4→6

**Crossed k10 — a range becomes publishable (9):**
cavanagh-lane 8→11 · derry-road 9→12 · ferguson-drive 8→10 · gordon-krantz-avenue 8→10 ·
hepburn-road 8→10 · maple-avenue 8→10 · nadalin-heights 9→10 · rose-way 9→13 · whitmer-street 9→10

These streets can now publish a figure they were suppressing. They will not until they are
regenerated: the numbers live in stored prose, not in the render.

### What the backfill broke, and what that taught

**A DB2 write has three consumers to invalidate, and DEC-REGEN-REVALIDATE covers only one.**
The backfill moved figures corpus-wide and purged nothing, because it writes no `StreetContent`
row. The battery caught it: the homepage served `sold-mtd` 23 against a live source of 51.

Purging the pages did not fix it either. The figures come from **`cached()` in `src/lib/cache.ts`,
an Upstash layer with a 1h TTL that a Next.js path revalidation does not touch.** The homepage was
a cache MISS and still printed the old numbers.

So the order is: **Redis first, pages second, prose third.**

1. `scripts/purge-sold-caches.ts` — 17 keys deleted across 10 prefixes. **New.**
2. `scripts/purge-after-sold-backfill.ts` — 26 paths, all 200. **New.**
3. a regeneration, which is a separate decision and was not run.

That fixed `sold-mtd` (51 == 51) and all **18** hub-figure mismatches.

---

## 2. The 50-page run · HALTED AT 23

**The runner named in the ruling could not have done this.** `regen-058-local.ts` is a
REgeneration runner: it reads the `StreetContent` row first and logs `SKIP - no StreetContent
row`. Every street in this programme is exactly that case, so it would have reported a clean run
having created nothing. `scripts/create-street-pages-local.ts` is its creation counterpart, new,
with the same controls copied verbatim: DeepSeek primaries enforced, `REGEN_CAP_USD`, resumable
log, consecutive-signature halt, entity floor, per-page revalidate.

Ordered by DB2 row count descending, so the pages with the most evidence go first.
**249 candidates**, not 250 — one gained DB1 activity overnight.

**The run halted at 23 of 50 on the five-consecutive-failure guard.**

| | |
|---|---|
| attempted | **23** |
| passed and published | **5** |
| failed | **18** |
| refused | 0 |
| spend | **$0.2624** of the $3 cap |
| halt signature | `threw:Phase41GenerationError`, 5 consecutive |

**The failures are fail-closed and left nothing behind.** A creation run that fails writes no row
at all, so there is no bad page to unpublish and nothing to repair. 18 streets simply still have
no page.

### The systemic fault

Two signatures, 14 and 4:

- **`invalid_json_shape: sections length = 3, expected 2`** — 43 occurrences, plus 7 of
  `length = 1, expected 2`.
- **`rules:fair_housing_register`** — 4.

The model keeps emitting **`differentPriorities`** and its FAQ ("If Urell Way isn't the right fit,
what similar streets should you look at?") on inputs where `dropsDifferentPriorities(input)` is
true, so the validator expects 2 sections and gets 3. It repeats across all 5 attempts with the
retry feedback in front of it.

**This is the thin-data population, which is what all 249 of these streets are.** A 22% pass rate
is not a per-page problem; the prompt is offering a section the validator will refuse. **The
programme should not continue until that is fixed.** Not fixed here: it is a change to the prompt
builder and needs its own gate.

### Five URLs for Aamir

    https://miltonly.com/streets/agnew-crescent-milton
    https://miltonly.com/streets/dalgleish-garden-milton
    https://miltonly.com/streets/landsborough-avenue-milton
    https://miltonly.com/streets/willmott-crescent-milton
    https://miltonly.com/streets/satok-crescent-milton

All five published, all five revalidated 200. Published `StreetContent` is now **450**, total 495.

---

## 3. The daily cap · BUILT

**The drain runs hourly** (`0 * * * *` in `vercel.json`), so a per-invocation limit is not a daily
one — 24 invocations would have allowed 480 pages a day.

`NEW_PAGES_PER_DAY = 20`, counted over `StreetContent.createdAt`. Only `build` decisions spend
budget; `regenerate` does not, and never was capped — refreshing a page that already exists is
what item 7 was written to fix and it publishes nothing new. A street over budget is left
**pending**, not marked done or ineligible: it is eligible and waiting its turn, and the queue's
`createdAt` ordering keeps its place. The cap is reported in the route's JSON so it cannot be
mistaken for a stalled queue.

**A column was nearly added for nothing.** `generatedAt` and `publishedAt` are both rewritten by
every regeneration, so neither can answer "was this page created today". An `ALTER TABLE` to add
`createdAt` failed with **42701 — already exists**: the column has been in the database and in
`schema.prisma` all along, defaulting on insert, carrying **real history back to 2026-04-21**. It
reads exactly 5 created today, which is the five pages above. Nothing was added. The failed
migration is marked rolled back and **`prisma migrate status` is clean: "Database schema is up to
date!"**

---

## 4. The merge sequence · HALTED

### `feat/homepage` — merged

`git merge --no-ff origin/feat/homepage` → **`cec6906`** on main. Code SHA `5448b96`; `c02fc10`
on top is documentation. Local build **exit 0**, zero `P2024`, 552 static pages. Pushed.
Production `miltonly-iyzhymxwn` **Ready**, serving `cec6906`, `served == expected`.

### The battery is RED, and it is not this batch

    FAIL · 11 checks · 449 pages · 246s
      [hub-meta]    hero stat tiles parsed on every hub: 0, expected 22
      [homepage]    Milton-wide figures outside their source + tolerance: 1, expected 0
      [hub-intents] hubs rendering no intent squares: 22, expected 0

Down from 4 failures after the cache work above. The three that remain:

**Two are stale parsers, not broken pages.** `feat/homepage` rewrote the hub hero markup from an
`h-` prefix to `hh-` and did not update the two checks that read it:

- `hub-intents.mjs` matches `class="h-intent"`. The page renders `class="hh-intent"`. The squares
  are there; the regex is an exact attribute match and cannot see them.
- `hub-meta.mjs`'s `heroStats()` splits on `<div class="h-hs">` and reads `h-n` / `h-l`. The page
  renders `hh-fact` / `hh-fact-v` / `hh-fact-l`, with `data-fig` and `data-value` attributes that
  are far more robust than either.

**Not fixed here, deliberately.** The new markup also changes the k-anonymity contract the check
exists to enforce. On a k-clearing hub `hub-fact-typical` prints `$955K` labelled "typical sale
price"; on a sub-k hub (moffat) the same tile degrades to `3` labelled "sales in 12 months". That
is a better suppression than the old silent tile, but it means `hub-meta`'s `silent` model no
longer maps and its assertions need rewriting around the new contract. **Rewriting another
branch's k-anonymity verification is not something to guess at inside a merge window.**

**One is a real published figure that is wrong right now.** The homepage prints
`proof-sales-12mo` = **1,531** against a live source of **1,728**.

Root cause, and it is worth reading twice: `buildMiltonWideContext()` in
`src/lib/ai/buildHubInput.ts` memoizes into a **module-level `_miltonWideCache` with no TTL**.
`resetMiltonWideContextCache()` exists and is called by **one script and nothing in the serving
path**. The memo was written for "once per generation run" across 14 hubs; the homepage now calls
it on **every render**. So the value is filled on the first render after a deploy and never
refreshed for the life of that lambda.

**This is not my backfill's doing — the backfill only made it visible.** `/api/sync/sold` runs
daily at 11:00, so this figure goes stale every single day and is silently corrected by the next
deploy. That is why nobody caught it. `on-market` and `dom` come from the same memo.

A TTL on that memo would fix the class of bug. One line, but it is homepage/hub behaviour and
belongs with the two checks above.

### `fix/core-batch` — NOT merged

Stop-on-failure: the failures are isolated to the verification layer plus one memoized figure,
but they are **not pre-existing** — they arrived with the merge I just made. `fix/core-batch` is
built, previewed and green on its own preview, and it is sitting at `2e8dfc0` waiting.

### The figures you named

| | expected | actual |
|---|---|---|
| `/rentals` | 1,116 | **1,116** ✓ |
| homepage `rentals-available` | 1,116 | **1,116** ✓ |
| homepage `on-market` | 462 | **457** |

457, not 462. It is a live count and it moves; the battery asserts it against its own live source
and **passes** (457 == 457). 462 was true when it was measured, not wrong now.

---

## 5. Open, for a ruling

1. **The two stale hub checks and the sub-k tile contract.** Whoever owns `feat/homepage` should
   rewrite `hub-intents.mjs`'s selector and `hub-meta.mjs`'s `heroStats()` plus its `silent`
   assertions around the `hh-fact` / `data-fig` markup and the degrade-to-a-count suppression.
   Until then the battery cannot pass and nothing can merge.
2. **`buildMiltonWideContext`'s untTL'd memo.** The homepage publishes three figures from it, and
   it goes stale daily. Proposed: a short TTL, keeping the per-generation-run benefit.
3. **The creation programme is blocked at a 22% pass rate**, on a prompt/validator disagreement
   about `differentPriorities` for thin-data streets. 5 pages exist; 244 candidates remain.
   Fixing that comes before running more.
4. **`fix/core-batch` merge**, once the battery can pass.
5. **The 17 and 9 streets that crossed k5 and k10** publish nothing new until regenerated.

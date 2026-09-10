# 068 · Three merges, by SHA, each gated

**Worktree:** `D:\miltonly` (CORE) · **Branch:** `main` at **`8db80da`**

**Production: `PASS · 11 checks · 449 pages · 97s`, exit 0, `8db80da served == expected`.**
**`prisma migrate status`: "Database schema is up to date!"**

---

## 1. `5448b96` — a merge that would have done nothing

**`git merge --no-ff 5448b96` returned "Already up to date".**

The commit is still an ancestor of main through `cec6906`. **Reverting a merge undoes its content,
not its ancestry**, so git considers 5448b96 already merged and reintroduces nothing — silently,
with a success exit code. A gate that only checks exit codes would have passed a no-op.

**Cherry-picked instead**, as `1cf5342`. That reapplies the change alone, without `c98f40e`'s
unapproved hub rebuild riding along. Content identical to `5448b96`; only the parent differs.

| gate | result |
|---|---|
| `pnpm build` | exit 0, zero `P2024`, 549 static pages |
| production | Ready |
| served SHA | `1cf5342 served == expected` |
| battery | **`PASS · 11 checks · 449 pages · 109s`** |

**Back to 11 checks, and `hub-intents` passes.** It shipped inside `5448b96` alongside the `h-`
markup it reads. Its earlier failure was `c98f40e` rewriting that markup to `hh-` and leaving the
check behind — the check and the markup are a matched pair, and restoring one restored both.

### The figures

| | expected | actual |
|---|---|---|
| `/rentals` | 1,116 | **1,116** ✓ |
| homepage `rentals-available` | 1,116 | **1,116** ✓ |
| homepage `on-market` | 462 | **457** |

457, not 462, for the second time. It is a live count of active listings and it moves; the battery
asserts it against its own live source and **passes** (457 == 457). 462 was true when measured.

---

## 2. `0a2499b` — feat/content, and a conflict that mattered

Merged as **`31a9ab0`**, by SHA.

### `vercel.json`

Main carried `/api/brief/send` (from feat/leads) and `0a2499b` added two
`/api/content/market-watch` entries. Both sides appended to the end of the same array, so git saw
one conflicting region rather than three independent paths.

**Resolved by keeping all three. 17 crons, JSON verified by parse.**

The two market-watch entries are deliberate, and the route's own comment says why: Vercel cron
expressions are UTC and carry no timezone; Toronto is UTC-4 in EDT and UTC-5 in EST, so no single
expression is 08:00 Toronto all year. `0 12 * * 1` fires 08:00 EDT, `0 13 * * 1` fires 08:00 EST,
and the route guards on the Toronto local hour so exactly one proceeds. **Dropping either loses
the edition for half the year** — the kind of resolution that looks like tidying and is data loss.

| gate | result |
|---|---|
| `pnpm build` | exit 0, zero `P2024`, 549 static pages |
| served SHA | `31a9ab0 served == expected` |
| battery | **`PASS · 11 checks · 449 pages · 99s`** |

### Content notified, and what came back

Content ran the held 2026-08-31 regeneration and confirmed the `vercel.json` resolution reads
their intent. Their report, which is worth reading in full at
`scratchpad/reports/067-content-cron-hour-and-correction.md`:

- They used the purge order from this tier — caches first, then regenerate, then revalidate — and
  said it mattered more than expected: the edition's 12-month context reads `getMiltonSoldOverall`,
  one of the cached keys, so generating first would have baked the stale 1,531 into a page being
  corrected for that exact number. **15 keys had already repopulated** under the 1h TTL since my
  own purge.
- Every headline figure moved with the backfill: 40 sales → 62, typical $920,000 → $975,000,
  12-month 1,531 → 1,728, streets 32 → 45.
- **New listings held at 56 across the whole correction.** They come from DB1's `listedAt`, which
  the backfill never touched. That is the clean confirmation of the `CloseDate` diagnosis: the
  movement is DB2 alone, and nothing drifted that shouldn't have.

They also flagged that the merge deleted `hubFooter.ts`, `hubSchools.ts` and `hubStreetLadder.ts`.
**Checked: removed by the revert `2e3cc50`, not by `fix/core-batch`.** They arrived with `c98f40e`
and left with it. Absent from main and the branch alike, with zero importers remaining. Their
instinct to name it rather than assume was right; the attribution was not.

---

## 3. `fix/core-batch` — merged at last

`origin/main` merged into the branch first, four conflicts:

| file | resolution |
|---|---|
| `package.json` prebuild | **the union, 23 tests.** Main had gained three lead/content guards; the branch had added `test-sold-date-not-future.ts` |
| `HANDOFF.md`, `QUEUE.md` | took main's, which is the current record; the branch's was superseded |
| `retired/CornerWidget.tsx` | kept **both** the retirement note and main's rewording of the ingress comment |

### The TTL

`259a365`, committed **separately** rather than folded into the merge — a behavioural change
buried in a merge commit is invisible to review, and it had landed there first before I split it
out.

`buildMiltonWideContext` memoized into a module-level variable with **no expiry**, and
`resetMiltonWideContextCache()` is called by one script and nothing in the serving path. Correct
while it was a generation-time helper computed once per run across 14 hubs; wrong once the
homepage called it per render. The evidence was `proof-sales-12mo` reading 1,531 against a live
1,728 with no purge able to shift it, then correcting on a redeploy with no code change.

Five minutes: long enough that a 14-hub run still computes once, short enough that a stale figure
self-corrects. **A rejected promise is dropped rather than cached**, so one database blip cannot
poison every homepage render for a whole TTL.

### The gate caught a real break

Prebuild died on `ENOENT: src\components\street\ExitIntent.tsx`. feat/leads' `test-lead-guards.ts`
and `test-lead-forms.ts` name both retired components by path, and `fix/core-batch` moved them.
Nothing in either branch alone would have shown this.

**Repointed at `retired/`, not dropped from the lists.** A retired file is dead, not exempt: if
either is ever remounted it must come back already holding the ingress contract rather than the
monolith fetch it originally shipped with.

| gate | result |
|---|---|
| preview | `miltonly-j6va7trjl`, **`PASS · 11 checks · 449 pages · 104s`**, `dce1b70 served == expected` |
| merge | **`8db80da`**, by SHA `dce1b70` |
| `pnpm build` | exit 0, zero `P2024`, 549 static pages |
| served SHA | `8db80da served == expected` |
| battery | **`PASS · 11 checks · 449 pages · 97s`** |

---

## 4. The migration ledger, which was not clean

`prisma migrate status` reported drift in both directions after the merges. Two wrong rows:

**`20260910180000_street_content_created_at`** — mine. Created to add `StreetContent.createdAt`,
failed immediately with **42701** because the column already existed, marked rolled back, and its
directory deleted. What remained was a ledger row for a migration that applied **zero** steps and
no longer existed on disk. Deleted by `scripts/fix-migration-ledger.ts`, which refuses to touch a
row with any applied step or without `rolled_back_at`.

**`20260910120000_market_edition`** — Content's. Present locally, **unapplied** in the ledger,
while both its tables already existed with data in them. Running it would have failed on
`CREATE TABLE`. **Verified first**, column-for-column and index-for-index: `MarketEdition` 13
columns and 4 indexes, `MarketEditionGeneration` 13 columns and 3 indexes, all matching the
migration exactly. Then marked applied. That is recording what is true, not papering over a gap.

**Neither row broke a build, because Vercel runs `prisma generate && next build`, not
`migrate deploy`.** It would have bitten the first person to run migrations.

`prisma migrate status` now: **26 migrations, "Database schema is up to date!"**

---

## 5. Open

1. **`feat/homepage`** is unmerged and intact. When the `hh-` hub rebuild returns, the two checks
   must land with it, including `hub-meta`'s sub-k `silent` model rewritten around the
   degrade-to-a-count tile. That is a k-anonymity change and needs its own review.
2. **The 249-page creation programme is paused** at a 22% pass rate on the `differentPriorities`
   prompt/validator disagreement. 5 built, 226 unattempted. The cap is live at 20/day, but the
   prompt should be fixed before it resumes.
3. **17 streets crossed k5 and 9 crossed k10** and still publish the suppressed figure, because
   those numbers live in stored prose. Only a regeneration moves them. Content flagged this back
   as Core's, correctly.
4. **QUEUE item 5, geometry backfill**, is next and not started.

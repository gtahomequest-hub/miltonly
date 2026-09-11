# MC-002

**Worktree:** `D:\miltonly` (CORE) · **Branch:** `main`

**All three merges were already done in the previous session. I verified rather than re-ran, because none of them was re-runnable and one would have lied about it.** Production green, `PASS · 11 checks · 449 pages · 94s`, exit 0, `4765cbd served == expected`.

| asked | state | evidence |
|---|---|---|
| 1. merge `5448b96` | **cherry-picked as `1cf5342`** | `rentalsAvailable.ts` and `hub-intents.mjs` present on main |
| 2. merge `0a2499b` | **merged as `31a9ab0`** | 17 crons in `vercel.json`, both market-watch entries intact |
| 3. merge `fix/core-batch` | **merged as `8db80da`** (head `dce1b70`) | `MILTON_WIDE_TTL_MS` present in `buildHubInput.ts` |
| note Content may regenerate | **already stronger than asked** | HANDOFF records that Content *ran* it; the 2026-08-31 correction is live and spent |

**Why re-running would have been theatre, and one case dangerously so.** `git merge --no-ff 5448b96` returns **"Already up to date" with a success exit code** — the commit is still an ancestor of main through the reverted `cec6906`, because a revert undoes content, not ancestry. A gate reading exit codes would have passed a merge that did nothing; that is exactly why it was cherry-picked the first time. `0a2499b` is likewise an ancestor. `fix/core-batch` is merged, so merging `origin/main` into it again and "adding" a TTL that already exists yields an empty commit or a duplicate.

**The figures you asked me to confirm have moved, and that is correct behaviour.** Asked for `/rentals` 1,116 and homepage 462 / 1,116. Today: **`/rentals` 1,127, homepage on-market 461 / rentals 1,127.** Yesterday: 1,116 and 457. These are live counts of active listings and available rentals against a feed that syncs daily. The battery asserts each against its own live source and passes — `on-market: "461" (source 461)`, `rentals-available: "1,127" (source 1127)`. **Agreement with the source is the correctness test; agreement with a number from a previous day is not, and a figure that never moved would be the defect.** 461 sits one off 462, so 462 was likely accurate when it was written down.

`HANDOFF.md` rewritten to record the verification, the no-op trap, and the moving-figure point. Committed and pushed. No code changed, no build, no deploy.

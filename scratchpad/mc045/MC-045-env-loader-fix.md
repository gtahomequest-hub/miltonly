# MC-045

CORE · D:\miltonly · fix/env-loader-crlf

_The env loader fix, reported separately from the fabrication measurement._

**Fixed on `fix/env-loader-crlf @ 4cf16e4`, held for the next batch.** It has not been merged. Under DEC-BATCH-MERGE a scripts-only fix is not a live production defect, and merging it would rebuild production on identical app code. The branch is pushed. The one preview that proves the new test on Vercel, `miltonly-iay9zu9eo`, is READY at `4cf16e4`. Until the batch merges, the runners on `main` still need `npx tsx --env-file=.env.local …`.

1. **The defect.**
   - `.env.local` on this desk is CRLF: 92 of its 99 lines.
   - The loader copied into the scripts splits on `"\n"`, then matches each line with `/^([A-Z_][A-Z0-9_]*)=(.*)$/`.
   - Without the `m` flag, `(.*)$` cannot match a line that still ends in `\r`, so every CRLF line was skipped.
   - `create-street-page.ts`'s loader read **2 of 83** assignments from the real file. It now reads **83 of 83**, with 0 values keeping a stray `\r`. Checked in a sandbox; only counts were printed.
2. **The fix.** The regex becomes `/^([A-Z_][A-Z0-9_]*)=(.*?)\r?$/`, the census's option A (the smallest change).
   - It appears in 71 files: 70 broken, plus `regen-condo-local.ts`, which MC-037 had already guarded.
   - 59 of the 71 are tracked and in the commit. The other 12 are local-only copies (gitignored `diag-*` scripts); they were fixed on disk and do not ship.
   - Audit's `scripts/audit/` loaders were never affected and are untouched.
3. **The test.** `scripts/test-env-loaders-crlf.ts` is last in `prebuild`. It never reads `.env.local`, so it runs on Vercel.
   - **Static check:** 822 files under `scripts/` and `src/` are scanned, and none may carry the old regex.
   - **Executed check:** every named `loadEnv*` in `scripts/` (106 of them) is extracted with the TypeScript compiler API and run in `node:vm` against an inline CRLF/LF fixture, called the way its callers call it. Each must load every key, and no value may keep a `\r`.
   - **Result:** PASS on the fixed tree. Against the unfixed tree it fails 233 assertions.
4. **A second defect, found by this preview and fixed in the same branch.**
   - `scripts/test-vercel-ignore.ts` (MC-040) ran the ignore rule with the ambient environment.
   - A preview built with `npx vercel` from any worktree branch carries that branch in `VERCEL_GIT_COMMIT_REF`. The rule's branch gate then skips before the logic under test runs.
   - As a result, **every preview from a branch that carries MC-040's test fails `prebuild`**, on "an unreachable base/head must BUILD". That is exactly the DEC-ONE-PREVIEW flow. MC-043's preview passed only because it deployed from `main`.
   - The fix: `decide()` now judges as `main` unless a case names a branch. It passes 12 of 12 with and without a branch ref; the unfixed test fails 3 of 12 with one.
   - **The tiers should know:** any worktree branch that carries MC-040's test (merged 2026-09-22) will fail its `npx vercel` preview until this lands.
5. **Why three previews.**
   - `miltonly-39ltiv9cs` errored on the item 4 defect. It was pre-existing and isolated, and was fixed in `4cf16e4`.
   - `miltonly-6kyv9evr4` errored in `next/font`, fetching Google Fonts at build time ("Cannot read properties of null (reading '1')"). The app code is byte-identical to `main`, which built cleanly today, so this was transient and external.
   - `miltonly-iay9zu9eo` was READY, with `[vercel-ignore] PASS` and `[env-loaders] PASS: 106 named loaders` in the Vercel build log.
   - The one check only Vercel can run is the prebuild chain without `.env.local` and without a git clone.
   - No local build and no battery: the branch changes no file under `src/`, `prisma/` or `public/` (0 diff lines). The local prebuild chain passed with exit 0.
6. **Behaviour changes when it merges.**
   - The 27 runners that import Prisma dynamically, including `create-street-page`, `create-street-pages-local`, `audit-058-unpublish` and `generate-market-edition`, will take `.env.local`'s pooled `DATABASE_URL` (`connection_limit=10`). Until now they took the direct URL that `@prisma/client` loads from `.env`.
   - `VERCEL_ENV="production"` and the Resend credentials now load into operator scripts. The lead code guards on the request host.
   - AI runners that failed closed at `generateStreet.ts:59` will now reach the model.
7. **Noticed, not changed:**
   - 5 loaders use `["']?([^"'\n]+?)` and drop empty values (60 of 83).
   - None of the 148 accepts an `export` prefix.
   - `upload-street-videos.ts:37` `loadBlobToken` captures the next line when its value is empty.

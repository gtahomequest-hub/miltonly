# MC-044

CORE · D:\miltonly · main

**Production serves `b60aa11` (`miltonly-f1bjm1gup`), one build: `PASS · 24 checks · 719 pages · 559s`.** The batch landed Portal (MP-006), the env loader (MC-045) and Leads (ML-012) by SHA. MH-009 was already on `main`. All four proofs hold on production. Proof 4 needed one more fix first: worktree previews also broke on CRLF line endings, a cause MC-045 did not address. Every figure below has a file in `scratchpad/mc044/`, named in brackets.

## The merges, by SHA, in the order given

| SHA named | Merged as | What happened |
|---|---|---|
| `feat/portal @ fd65058` (MP-006) | `601c64a` | 2 conflicts, both kept from both sides. **`package.json` prebuild:** the union, with `test-vow-best-practices` after `test-portal-door`. **`privacy/page.tsx`:** main's statute name with the portal's comma instead of the em-dash. `e622c96` above it is docs only and was not merged; Portal lands it. The migration `20260921120000_portal_vow_best_practices` was already applied: `prisma migrate status` shows 32, up to date [`evidence-deploys.txt`]. |
| `fix/env-loader-crlf @ 4cf16e4` (MC-045) | `6b2cfe7` | `package.json` prebuild, the union: 44 tests. |
| `feat/web-analytics @ 7cfa4a2` (MH-009) | nothing to merge | Already an ancestor of `main`, merged in MC-038 as `f1d4080`; `git merge 7cfa4a2` answered "Already up to date". So this batch changed neither `package.json`'s dependencies nor `pnpm-lock.yaml`: no lock conflict, no install. |
| `feat/leads @ a001c43` (ML-012, carries ML-005) | `6e14465` | Clean. ML-005 was already on `main` as `2510466`. |

**Two Core commits on top, each fixing something this batch found:**
- **`be8e127`** fixes two things:
  - `/privacy` now names one deletion channel. The portal's paragraph said "write to the address below"; main's MC-036 paragraph under it sends removal to the form. My conflict resolution had kept both hunks.
  - The battery's `vow-fields` now keeps the token `/api/auth/me` re-issues. MP-006 winds the 60-minute clock (`act`) only in that new cookie, so a cached token 59 minutes old could go inactive mid-check. The check itself is unchanged.
  - Proven on production [`evidence-sessions.txt`]: the reused token came back with `act` 16:07:24Z → 16:24:48Z and `exp` unchanged, and `vow-fields` passed.
- **`b60aa11`** adds `*.sh text eol=lf` to `.gitattributes`, plus a comment in `scripts/vercel-ignore.sh` saying why (see proof 4).

## Gates

- **Local gate, exit 0 at every SHA:** `6e14465`, `be8e127` and `b60aa11`, each 840 of 840 pages with 0 `P2024` [`gate-*.log`]. Prebuild runs 44 tests, including:
  - `[vow-best-practices] PASS: 202`;
  - `[vercel-ignore] PASS: 12`;
  - `[env-loaders] PASS`: 107 loaders, 829 files.
- **Local battery at `6e14465`: `FAIL · 24 checks · 719 pages · 507s`.** Isolated and pre-existing, a data lag rather than the batch:
  - **What failed:**
    - `tiles`: one page, copeland-circle, whose page stated "across 5 sales in the last 12 months" against a record of 3.
    - `hub-page`: 2 hub stock percentages, plus ladder rows against their street pages on 5 streets (typical 2, basis 4, sold count 5). Examples are clark-boulevard, copeland-circle and scott-boulevard.
  - **Why:** the first local build of the day baked in day-old fetch-cache data [`evidence-db.txt`]. Two copeland sales dated 2025-09-25 had left the 12-month window at 00:00Z, and `street_sold_stats` recomputed the street to 3 at 11:31:09Z, before the 14:08Z build.
  - **Production is clean:** production at `5f8cdb0` passed both checks against the same record (`tiles` 238 s, `hub-page` 124 s) [`tiles-prod-before.log`, `hubpage-prod-before.log`]. The batch touches no street-tile or hub code.
  - **The rebuild clears it:** at `be8e127` copeland prerendered correctly floored, and the local battery read **`PASS · 24 checks · 719 pages · 429s`** [`battery-local-be8e127.log`]. From there to `b60aa11` only `.gitattributes` and a shell comment changed.
- **Two previews, from the throwaway worktree branch `preview/mc044`** [`evidence-deploys.txt`]:
  - `miltonly-gdcvhgpx8` at `be8e127`: **Error** (proof 4).
  - `miltonly-knzmybnxv` at `b60aa11`: **Ready**. The second preview was needed for the one check only Vercel can run: prebuild on Vercel's Linux builder from a worktree's uploaded files.
  - Smoke on the Ready preview: `/terms`, `/privacy`, `/rentals`, `/rent`, Timberlea and a street page all answered 200; `/api/admin/vow-access` answered 401.
- **Production** [`evidence-deploys.txt`]:
  - One push, `5b9da69..b60aa11`, and one build, `miltonly-f1bjm1gup`. `vercel ls --prod` shows it Ready, and `/api/build` answers `b60aa11`, built 14:53:29Z.
  - Battery **`PASS · 24 checks · 719 pages · 559s`** with `EXPECT_SHA=b60aa11` [`battery-prod-b60aa11.log`].
  - The morning report's commit `4f2df7b` (15:03Z) built as `miltonly-9sq1dwdh1`, which the ignore rule cancelled, so there was no second build.

## Proof on production, one by one

**1. Portal. ALL PASS** [`portal-prod-b60aa11.log`, `card-prod-b60aa11.log`, `shots/card-v4-terms.png`].
- **The card:**
  - It reads "The terms have changed", headed "Terms of use, version 4", with `data-vow-terms-version=4`.
  - There are ten `li` in an `ol` with `list-style-type: decimal`: clauses i to ix, then the sign-in sentence.
  - **Clause 9 (ix) is the only bold clause**: `<strong>`, weight 700; the rest are 400. The screenshot is the card element, numbered 1 to 10 with 9 in bold.
  - **How it was rendered:** production's own bundle and stylesheet drew the card. The browser answered two fetches in place of the server, and nothing was submitted:
    - sold-records got `{canSee:false, needsAcknowledgement:true}`, the shape the route returns for a signed-in row that owes the card (`route.ts:21`);
    - `/api/auth/me` got a row owing re-consent, carrying only the fields the card reads.
  - **Why not a real row:** neither real row owes the card. Stepping the desk's row back to v3 would have written a false history row into `VowConsent`, the v4 text labelled "version 3", and that is the table PropTx audits.
- **The trail:**
  - A real password sign-in as the desk's row (v4, registrant no, password set 2026-09-20T13:22:40Z) read farmstead-drive-milton's 12 sold rows with no card.
  - It wrote `VowAccessLog` **`15:00:04.948Z street-records farmstead-drive-milton n=12`** from a public IP with a Mozilla user agent (15 → 16 rows).
- **The export:** `/api/admin/vow-access` answered **401** without the admin cookie. With it: 200 `text/csv`, an attachment, `no-store`, the 12-column header, and 12 rows today, 3 of them naming farmstead.
- **Password expiry is live:** production's `/me` gives the desk row `passwordExpiresAt 2026-12-19T13:22:40Z`, 90 days after its password was set.
- **The inactivity timeout is live**, proven in real time [`inactivity-prod-b60aa11.log`]. Two password sign-ins minted tokens with `act` 60 minutes out:
  - token A, never touched after sign-in at 15:22:20Z, answered `user null` at 16:23:23Z;
  - token B, touched once at 15:52:22Z (`act` moved to 16:52:22Z, `exp` unchanged), was still live at 16:23:23Z.
- **Sessions:** after the deploy the battery signed in afresh. Its production token was issued 15:07:24Z and carries `act`; a pre-MP-006 token has none, and MP-006 refuses it [`evidence-sessions.txt`].
- **Re-consent:** the brief expected both desk rows to owe re-consent. Neither did, because both were brought current on 2026-09-21 [`evidence-db.txt`]:
  - the main row: v4, registrant no, answered at 18:30:58Z;
  - `+mp006`: v4, registrant no, answered at 19:27:42Z.

**2. Web Analytics. RECORDED** [`analytics-prod-b60aa11-run2.log`, `analytics-prod-b60aa11.log`, `analytics-pretest.log`, `analytics-store-totals.txt`].
- **Served:** production loads the script from `/35ca55a203cd90db/script.js` (200, 4,469 bytes), not `/_vercel/insights/`.
- **Why MA-009 saw zero, two causes:**
  - Its filter watched `/_vercel/insights`, `va.js` and vitals paths, so it could never see this script's request.
  - The script sends nothing when `navigator.webdriver` is true or the user agent says "Headless", and Lighthouse's browser is both.
- **The view:**
  - It was **script-driven**: Puppeteer launched a headed Chrome with the automation switch off (`webdriver=false`, no "Headless") to load `/neighbourhoods/moffat`.
  - It made `GET script.js` 200, then **`POST /35ca55a203cd90db/view` 200**.
  - The Web Analytics Query API took that path **from 1 to 2 page views, 37 s after the visit**.
  - The first production run is also a record: the page answered at 14:59:59Z, the view landed in the 15:00 bucket (0 → 1), and the script, watching 14:00, was stopped and fixed.
- **Controls:** the headless portal-proof loads of farmstead at 14:59Z and 15:00Z recorded nothing.
- **This task added 3 synthetic views to production analytics:** farmstead at 14:12Z, and moffat at 15:00Z and 15:08Z.
- **The store holds 235 page views from 70 visitors since 09-22,** those 3 included: 92, 38, 73 and 32 by day, with referrers including google.com 22, bing.com 5 and **chatgpt.com 2**.
- **"Awaiting first data" is the morning report's own 404:**
  - `scripts/audit/morning/sources/analytics.mjs` queries `vercel.com/api/web-analytics/stats`, which does not exist.
  - The documented API is `api.vercel.com/v1/query/web-analytics/visits/{count,aggregate}`, and the CLI's bearer works on it.
  - This is Audit's file.

**3. Rentals** [`rentals-prod-b60aa11.log`, `rentals-measure-prod-b60aa11.json`].
- **Contrast:** beds, baths, parking and "/ month" each measure **4.89:1**: `#6e726d` on `#ffffff`, at 11 and 12 px. ML-012 measured all four at 1.0:1 on production on 09-24.
- **0 404s:**
  - Card street links: 42 of 42 answer 200 on `/rentals`, 42 of 42 on `/rent`, 46 of 46 on `?neighbourhood=timberlea` and 39 of 39 on Harrison.
  - Every internal link on the four views (178, 178, 144 and 167; 202 distinct) returns 2xx.
- **Still under 4.5:1 on first render, 15 colour groups:**
  - the accent-override set ML-012 left as the owner's design decision;
  - the four `#8a8f8a` literals (4.32:1);
  - `AgentContactSection`'s email line (3.98:1, Home's);
  - two groups ML-012 did not list: a "View all" link on the rent averages (1.97:1), and a view-toggle tab at 2.28:1, which ML-012 had at 2.95:1.

**4. Env loader: a branch preview from a worktree passes prebuild** [`preview-build-knzmybnxv.log`, `evidence-deploys.txt`, `evidence-eol.txt`].
- `miltonly-knzmybnxv` is Ready. Vercel's metadata: `source cli`, **`gitCommitRef preview/mc044`**, `gitCommitSha b60aa11`.
- `[vercel-ignore] PASS: 5 assertions, 7 not runnable in this clone`, and `[env-loaders] PASS` (98 loaders, 820 files).
- **It took one more fix than MC-045.** The first preview from the same worktree, at `be8e127`, failed `[vercel-ignore] FAIL: 3 of 5` [`preview-build-gdcvhgpx8.log`]:
  - `core.autocrlf` writes `vercel-ignore.sh` CRLF in every worktree, `npx vercel` uploads it as it is, and bash on Vercel cannot run it.
  - MC-045's preview passed only because it deployed from `D:\miltonly`, whose copy happens to be LF. ML-012 had found the trap (HANDOFF-leads.md).
- **Reproduced from scratch:** a fresh worktree at `6e14465` checks the script out `w/crlf`, and merging `b60aa11` rewrites it `w/lf` with no manual step.
- **Audit and Leads still carry the CRLF copy** (`D:\miltonly-audit`, `D:\miltonly-leads`). Their next CLI preview fails prebuild until they merge `main` at `b60aa11` or later.
- The branch-ref half also holds locally: the pre-MC-045 test with a branch ref fails on 4 cases, and the merged one passes 12 of 12 [`ignore-test-before-after.log`].

## MC-045's runner change, watched [`runner-pool-watch.log`]

**First to run after the merge:** the gate's prebuild at 14:07:54Z, including `test-canonicalization-regression.ts`, whose loader MC-045 changed. It passed with 0 `P2024`.

**The watched runner:** `recon-condo-names.ts`, a read-only dynamic-Prisma runner, run once with its 5b9da69 loader and once with the new one:

| | Before | After |
|---|---|---|
| Database endpoint | direct `.env` URL, no pool parameters | pooled URL, `connection_limit=10`, `pgbouncer=true` |
| `VERCEL_ENV` | unset | `"production"` |
| Resend key | unset | set |
| `AI_PROVIDER` | unset | `phase41_v2` |
| Pool or connection errors | 0 | 0 |
| Output | 258 lines | identical |
| Run time | 1.0 s | 1.3 s |

**What changed and what did not:**
- **The pool:** no effect seen. But this was one light read. No write, concurrent or transactional runner has run on the pooled URL yet, so watch the first `create-street-page`, `requeue-creation-programme` or `cleanup-canonicalization` run (the last uses `$transaction`).
- **The env values:**
  - **`mail-unnotified-leads.ts --send` now delivers.** Before the fix it threw "RESEND_API_KEY unset" on this desk. It is still a dry run without `--send`.
  - `VERCEL_ENV` reaches no runner's code path. It is read only by `lib/lead/env` (the lead, digest, alert, brief and privacy routes), `lib/streetPrerender`, and the `market-watch` and `build` routes, and no fixed runner imports any of them. `generate-market-edition.ts` goes through `lib/marketWatch`, which reads none.

## The pre-deploy review [`review-merge-findings.json`]

A workflow of 7 agents ran four lenses, each finding checked by a skeptic. The lenses were semantic conflicts, voice and compliance, battery readiness, and VOW leakage and caching.
- **12 findings raised:** 7 confirmed, 5 refuted, none blocking.
- **The leakage lens found nothing:** every VOW surface gates first, fails closed, and puts no Set-Cookie on a response the CDN can cache.
- **The voice lens ran the nightly's own rules over all 27 new strings and found nothing.**
- **5 distinct real defects:** 2 fixed in `be8e127`, and 3 open for Portal (below).

A second pass fact-checked this report against the evidence files. It corrected:
- the screenshot, re-shot as the card element;
- the recompute time, 11:31:09Z rather than 07:31Z;
- the `hub-page` street count;
- the colour-group attribution;
- the `VERCEL_ENV` readers.

## Open

1. **For Portal (MP-006 follow-ups):**
   - Query-only navigations (`/sold` chips, `/listings` filters) never touch the session, because `UserProvider` keys its `/me` call on `usePathname()`. A reader browsing chips for 60 minutes is signed out mid-visit.
   - The renewal card's kicker reads "One-time setup" (`VowAcknowledgementPrompt.tsx:188`).
   - The registrant wall says "email Aamir" with no address (`:172`).
   - The docs commit `e622c96` is unmerged.
2. **For Audit:**
   - Point the morning report's analytics source at the Query API. It has printed "awaiting first data" for five days while the store recorded 235 views, including two ChatGPT referrals.
   - Merge `main` into `feat/audit` before its next CLI preview.
3. **For Leads:** merge `main` into `feat/leads` before its next CLI preview.
4. **For Aamir:**
   - The removal desk email (`src/lib/privacy/request.ts:28`) says to remove at once and gives no VOW exception, yet `VowAccessLog` and `VowConsent` cascade on a `User` delete. A hand deletion inside the 180-day window would erase the trail.
   - The desk's password expires **2026-12-19T13:22:40Z**, and the battery cannot renew it.
   - `/privacy` still reads "(REBBA)" after the statute's current name; that text was already on `main` before this batch.
5. **Traps found here:**
   - This desk's clock runs **12.4 s ahead** of Neon and Vercel.
   - The Neon serverless driver reads Prisma's zone-less `timestamp(3)` columns as local time (+4 h here), so cast `AT TIME ZONE 'UTC'`. A `timestamptz` column such as `street_sold_stats.last_updated` reads correctly.
   - A first local build after a day can bake in stale data, and a second build clears it.

Report: scratchpad/mc044/MC-044-batch-merge.md

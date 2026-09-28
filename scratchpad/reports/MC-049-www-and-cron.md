# MC-049

CORE · D:\miltonly · main

**Production serves `9a563fd` (`miltonly-m25idhaan`), one build: `PASS · 24 checks · 719 pages · 527s`.** Three commits shipped in the one deploy: `3a5df3b` (www), `2dfb721` (the cron pause) and `9a563fd` (lane branches). Nothing touched a street title, meta, H1 or body. Working files are in `scratchpad/mc049/`.

## Step 1 · www to apex (`3a5df3b`)

**The redirect already existed, in two places, before this task:**
- **In the dashboard:** the Vercel project's domain settings redirect `www.miltonly.com` to `miltonly.com` with a **308**, and the apex has no redirect. I read this from the project's domains API; `vercel domains inspect` shows both names on the project and on Vercel DNS, but not the redirect. Nothing was changed.
- **In code:** `next.config.mjs` has pinned the same rule since `f429b6a` (2026-09-02), and it is kept.
- **Live before this deploy:** production already answered 308 with the query intact (`proof/www-before.log`). So MC-048's 273 `www` URLs with impressions are Google still consolidating URLs it indexed before the flip. They are not a missing redirect.

**The commit adds the prebuild test**, `scripts/test-www-redirect.ts`, with 49 assertions:
- exactly one redirect conditions on the host, and it is `www.miltonly.com`;
- that rule sends `/:path*` to `https://miltonly.com/:path*`, it is permanent, and it has no query in the destination, so the request's query is kept;
- nothing conditions on the apex, and the other 33 redirects stay on the requested host;
- no rewrite or header rule reads the host, `vercel.json` declares no redirects, and the middleware reads no host.

Three mutations each fail it: an apex host rule, `permanent: false`, and a query in the destination.

**Proof on production after the deploy** (`proof/curl-I-after.txt`, `proof/www-after.log`):

| `curl -I` | Answer |
|---|---|
| `https://www.miltonly.com/streets/zilio-terrace-milton` | 308, `Location: https://miltonly.com/streets/zilio-terrace-milton` |
| `https://www.miltonly.com/` | 308, `Location: https://miltonly.com/` |
| `https://www.miltonly.com/listings` | 308, `Location: https://miltonly.com/listings` |
| `https://www.miltonly.com/listings?page=2&sort=newest` | 308, `Location: https://miltonly.com/listings?page=2&sort=newest` |
| `https://miltonly.com/streets/zilio-terrace-milton` | 200 |

- A fifth URL, `…/scott-boulevard-milton?utm_source=mc049&x=a%20b`, also got a 308 with its query intact.
- **Unchanged:** the sitemap holds 1,356 URLs before and after, the same set, all on the apex host, with 0 street `lastmod` values changed. The canonicals of `/`, the street page and `/listings` are unchanged (`proof/sitemap-canonical-compare.log`).

## Step 2 · the street regeneration cron (`2dfb721`)

**What the job is.** It is two routes working together.

- **`/api/sync/regenerate`, Sundays at 12:00 UTC (`0 12 * * 0`), writes no prose itself.** It:
  - reads every published page older than 30 days;
  - recomputes its market-data hash;
  - queues the ones whose hash moved into `StreetQueue`;
  - then fires the hourly route.
- **`/api/sync/generate`, hourly, is the rewrite.** It drains the queue, and `makeStreetDecision` answers one of:
  - `build`, a new page, capped at 20 a day;
  - `regenerate`, which rewrites an existing page through `generateStreetContent` (uncapped);
  - a skip.

  It also retries failed rows under 3 attempts, and re-examines "ineligible" verdicts older than 30 days.
- **On Sunday 09-27** the weekly run queued about 20 stale pages at 12:00. Most were skipped as current. It rewrote `victoria-street` at 12:00:51Z. `shortreed-crescent` and `baverstock-crescent` failed first and were rewritten on retry at 14:00:59Z and 14:01:10Z.

**The gate.** `src/lib/streetRegen.ts` keeps the rewrite off unless `STREET_REGEN_ENABLED` is exactly `"true"`.
- **When off, the weekly route** answers **200 `{paused:true}`**, logs one line, and reads, queues and fires nothing. The schedule and the secret are unchanged.
- **When off, the hourly route** leaves every `regenerate` decision in the queue untouched and names it in its response (`regeneration.leftQueued`). New pages still build under the cap.
- **Not gated**, because none rewrites existing prose:
  - new-page creation;
  - `vip-hubs`, which flags `isVipHub` and, for a hot street with no page, creates a draft row with a template sentence;
  - `detect`, which queues new streets;
  - `monitor/queue`, which resets stuck rows and counts;
  - the manual force-regenerate route and the local runners.
- **`STREET_REGEN_ENABLED` is set nowhere:** not in the repo, not in `.env` or `.env.local`, and not in the Vercel project's environments.
- **The queue now** holds 0 pending, 80 failed at 3 attempts (never retried), 717 done and 86 ineligible, none of them due for re-evaluation. Nothing is waiting to be rewritten.

**The test.** `scripts/test-street-regen-gate.ts` (21 assertions):
- It calls the weekly route for real, with the database pointed at an address that cannot answer: 200 `{paused:true}`, and 401 for a wrong secret.
- It checks that the hourly gate sits before any build.
- It checks that no file sets the switch, walking the file tree so it also works in a CLI upload with no `.git`.

Three mutations each fail it.

**The rows rewritten since 2026-09-24:**

| Slug | generatedAt (UTC) | One of MC-048's 55 stripped pages? |
|---|---|---|
| victoria-street-milton | 2026-09-27T12:00:51.729Z | no |
| shortreed-crescent-milton | 2026-09-27T14:00:59.796Z | no |
| baverstock-crescent-milton | 2026-09-27T14:01:10.436Z | no |

**`class2-verdict.mjs` over those rows** (`scratchpad/mc049/class2/`), using MC-045's method end to end:
- **The method:** a crawl of the served pages, the text units, the candidate net, two independent blind parses, the Town street vertices, then the verdict, unmodified, at a 700 m margin in both frames.
- **3 candidate sentences, 8 claims the two parsers agreed on (0 single-parser claims), 0 WRONG.**
  - **victoria-street:** "its position near the historic core" is not refuted; the nearest vertex is 343 m from downtown. "the newer subdivision builds to the south and west" has a generic subject, so there is no geometry to test.
  - **shortreed-crescent:** "sits east of the escarpment" is not checkable, because there is no escarpment geometry.
  - **shortreed-crescent:** "north of the Derry Road corridor" had no geometry, because the resolver does not know the road as "the Derry Road corridor". Re-judged with the plain name "Derry Road", it is **not refuted** (road test, 16 m).
  - **baverstock-crescent:** "Milton has grown westward and northward along the escarpment side" is a growth statement, not a location, so it is not checkable (3 claims).

**Proof on production** (`proof/regen-trigger.txt`):
- The route triggered by hand with its secret at 19:31:03Z answered **200 `{"paused":true,"reason":"STREET_REGEN_ENABLED is not \"true\" (MC-049)"}`**; a wrong secret answered 401.
- **`max(generatedAt)` was 2026-09-27T14:01:10.436 before and after.**
- The one log line was seen locally and in the prebuild test. Vercel's runtime-log search from the CLI returned nothing for the hour, so it is not shown from production's logs.
- **The 12:00 UTC check: PENDING.** Today's 12:00 had already passed before the deploy (ready 19:24:34Z), and `max(generatedAt)` held through it (read at 18:35Z). The next 12:00 UTC is 2026-09-29, and the check is running; its line will be added here.
- **The weekly job's first run under the gate is Sunday 2026-10-04 at 12:00 UTC.** That is the run that rewrote Victoria.

## Step 3 · lane-branch pushes stop building on Git (`9a563fd`)

**`vercel.json` gains `git.deploymentEnabled`:**
- `main` is `true`;
- the seven lanes are `false`: `feat/portal`, `feat/leads`, `feat/audit`, `feat/content-2`, `feat/home-voice`, `feat/ledger` and `fix/env-loader-crlf`;
- `"**"` is `false`, covering every other branch.

**Vercel's docs** (Git Configuration page):
- **Patterns are accepted:** "Use minimatch syntax to define behavior for multiple branches".
- **Several matching keys:** "If a branch matches multiple rules and at least one rule is `true`, a deployment will occur", so `main` still builds.
- **Unlisted branches:** "any unspecified branch is set to `true`".

Evaluated that way, **of the 147 branches on origin, only `main` deploys on a Git push.**

**The ignore rule** (`scripts/vercel-ignore.sh`, MC-040) stays as the second layer. It now carries the one lane list, which its branch gate reads. `scripts/test-vercel-ignore.ts` asserts:
- every listed lane is named `false` and does not deploy;
- `main` is `true` and deploys;
- an unnamed branch does not deploy;
- the script's list and `vercel.json`'s named `false` keys are one list.

That is 32 assertions, and three mutations each fail it.

**CLI previews are unaffected.**
- The docs scope the setting to "branches that should not trigger a deployment upon commits", and no page says a CLI deploy is refused.
- Proven directly: preview **`miltonly-6uinygmqn`** was deployed with `npx vercel deploy` from a worktree on `probe/mc049-cli`, a branch `**` refuses. It shows `source cli`, `gitCommitRef probe/mc049-cli`, and **Ready**.

**The lane push** (`proof/lane-*.txt`) found something the change alone does not cover: **Vercel reads `vercel.json` from the pushed commit, not from `main`.**

| Push to `fix/env-loader-crlf` | Its `vercel.json` | Vercel |
|---|---|---|
| `f43eb0d`, a no-op on the lane as it stood | no `git` block | deployment `ff5cc2hv2` created at 19:31:53Z, **CANCELED** by the ignore rule |
| `2519d38`, `main` merged into the lane | carries the rule | **no deployment** in 3 minutes |
| `2877668`, a no-op on top | carries the rule | **no deployment** in 3 minutes |

- Before this change, each Git push to the lane on 09-24 created a deployment that the ignore rule cancelled.
- So **a lane gets the Git-level block when it next merges `main`** (`9a563fd` or later). None of the five lane worktrees carries it yet. Until they do, their pushes are cancelled by the ignore rule, exactly as before.
- **The push to `main` built as before:** `miltonly-m25idhaan`.

**Build time and machine:**

| Deploy | Machine | Region | Building to Ready |
|---|---|---|---|
| MC-044 `miltonly-f1bjm1gup` (`b60aa11`), 09-25 | 8 cores, 16 GB, Enhanced | iad1 | 346.5 s |
| MC-048 `miltonly-oqmamj059` (`1f3b216`), 09-28 | 4 cores, 8 GB | cle1 | 243.8 s |
| **MC-049 `miltonly-m25idhaan` (`9a563fd`), 09-28** | **4 cores, 8 GB** | cle1 | **200.8 s** |

The project was already on the 4-core, 8 GB machine for MC-048.

## Gates

- **Local gate:** exit 0 at `9a563fd`: 840 of 840 pages, 0 `P2024`. The prebuild runs 47 tests, among them `vercel-ignore` (32), `www-redirect` (49), `street-regen-gate` (21) and `street-head`.
- **The gate's first run** failed on my own test. The "no setter" check read the switch's own `=== "true"` as a setter, and it had passed standalone only because the file was not yet tracked. It was fixed and folded into the unpushed step-2 commit.
- **Local battery** at `97385eb`, the same served code:
  - The first run read `FAIL · 24 checks · 719 pages · 483s`: `chandler-crescent` claimed no sales against a record showing one, and the Scott hub stock read 57% against 58%. This was the stale-cache lag again, and production passed the same two checks (91 s).
  - After a rebuild: **`PASS · 24 checks · 719 pages · 526s`**.
- **Previews:**
  - `miltonly-iub6k8akf`, **Error**: my gate test used `git grep`, and a CLI upload carries no `.git`. It now walks the file tree.
  - `miltonly-6uinygmqn`, **Ready**. The second preview was needed for the two checks only Vercel can run: prebuild on a CLI upload with no `.git`, and a CLI deploy from a branch `git.deploymentEnabled` refuses.
- **Production:** one push, `ac96e39..9a563fd`, battery **`PASS · 24 checks · 719 pages · 527s`**.

## Open

1. **The 2026-09-29 12:00 UTC line:** pending, running now.
2. **After 2026-10-04 12:00 UTC:** the weekly job's first run under the gate. Check that `max(generatedAt)` is still 2026-09-27T14:01:10.436.
3. **For every tier:** merge `main` into each lane to get the Git-level block. CLAUDE.md still says a push to another branch "is cancelled"; after a lane merges `main` it creates no deployment at all. CLAUDE.md is Aamir's file, and I did not edit it.
4. **For Aamir:** turning the rewrite back on means setting `STREET_REGEN_ENABLED=true` on the Vercel project. No compass or build-era check runs on new prose.
5. **Creation continues:** new-page creation is not gated. `detect` can still queue new streets, with 0 pending today.
6. **`fix/env-loader-crlf`** now carries three commits beyond `4cf16e4`: a no-op, the `main` merge and a second no-op. It is Core's own branch and already merged.

Report: scratchpad/reports/MC-049-www-and-cron.md

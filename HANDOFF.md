# Handoff

_Last rewritten 2026-09-03._

## Where things stand

| | |
|---|---|
| branch | `chore/session-state` (cut from `main`) |
| `main` | `de7f70b` `Merge branch 'fix/verify-build-sha'` |
| production | `miltonly-rf40l1v4x`, Ready, serving `de7f70b` (confirmed via `/api/build`) |
| battery | `PASS · 9 checks · 428 pages · 64s`, exit 0, against `https://miltonly.com` |
| published street pages | 428 (425 in the Town registry, 3 on the off-registry allowlist) |
| `StreetAdjacency` | 1052 rows, 0 stale `connectedName` |
| prebuild suite | 9 tests |

## What shipped 2026-09-02

All merged to `main` and verified on production.

- **`fix/signin-unblock`** (`d379e8e`): `/signin` unblocked in robots so its `noindex` can actually be read, plus the two missing `nofollow`s.
- **`feat/street-meta-ctr`** (`9b9ac83`): street metadata tells the truth. Price, sample count and window now come from one basis (`eabef1b`); leases are no longer counted as sales and the global title template is gone (`8b7ea6c`); the Bennett per-slug metadata override is deleted (`da5e15a`).
- **`fix/street-name-canon`** (`39d8848`): one repaired street name feeding both title and H1 (`5d304ae`), and the index gets only what the page prints, closing a suppression leak (`2460df9`).
- **`feat/name-source`** (`067e99c`): **DEC-NAME-SOURCE Build 1.** `src/lib/streetName.ts` created as the naming authority with `resolveStreetName`, `titleCaseOfficial` and `applyMcMacO`; the Town registry becomes the authority; 4 redirected slugs retired and the public listings API canonicalised (`4c05cc5`).
- **`fix/provider-sitemap`** (`bb1afc6`): `AI_PROVIDER` fails closed with no silent default to Anthropic (`33c60d7`); 460 active listing detail URLs added to the sitemap and www to apex pinned in code (`f429b6a`).
- **`fix/generator-name-wire`** (`69f3f66`): `buildGeneratorInput` derives its name from the registry, and the prebuild guard catches unwired call sites (`2939710`).
- **`fix/name-prose`** (`33bed68`): **DEC-NAME-SHORT.** Full name in prose and headings, `shortName` only in width-limited UI; em-dashes and en-dashes removed from street prose (`781a40b`, with `d0e816b` removing the symbols that change orphaned).

## What shipped 2026-09-03

- **`fix/verify-build-sha`** (`de7f70b`): the verification battery asserts the served build before any content check. `servedCommit()` in `scripts/verify/lib/build.mjs` reads `/api/build`; on a mismatch `run.mjs` aborts with `wrong deployment served: got X expected Y` and exit 2, running no content assertion (`87aee08`). The first attempt used `/api/ping`, which is Bearer-gated by `CRON_SECRET` and therefore 401s on every preview, so `src/app/api/build/route.ts` was added instead (`ce336b8`).
- **DEC-NAME-SOURCE Build 2** (data, not code): 11 of 13 directional streets regenerated to zero directional occurrences; `jarrett-crossing-milton` generated and published; `StreetAdjacency` rebuilt 1046 to 1052 rows with 26 stale `connectedName` values repaired, including `Kovachik Boulevard #bsmt` and `420 Hincks Drive`. Total cost $0.1631 over 114 API calls.
- **Task 1 closed.** The long-running hub-meta failures were never a data defect. Both sides query the same DB2 table and returned identical figures (`n=98, avg=866311.24`); the battery had been reading CDN-cached renders from an older build. `hub-meta` now passes 11/11 with all mismatch counters at 0.

## Open items

Tracked in `QUEUE.md`, not started. Summarised here so nothing is lost:

1. **`generateStreet.ts:615` create branch bypasses `resolveStreetName`.** Build 1 fixed the update branch only, so every newly created `StreetContent` row still takes whatever MLS last wrote. Live example: the cron published `gifford-crescent-milton` on 2026-09-03 at 11:02 with `streetName = "Gifford Cres"` against a registry that says `Gifford Crescent`. Not user-visible (render and generator both resolve) but the column is wrong. The prebuild guard missed it because it asserts the file imports the resolver, which it does, just not on that path.
2. **`parkway-drive-milton` cannot be regenerated.** 20 attempts across 4 runs, every one rejected for `superlative` (`@market`, `@amenities`, `@about`, `@aha`). Still publishing 32 occurrences of "Parkway Drive West". No workaround was applied to the validator.
3. **`burnhamthorpe-road-milton` has no data.** `getStreetStats()` returns null because all five sources are empty. Pre-existing since at least 2026-05-26. Published with no data behind it; its 2 stale occurrences are not rendered.
4. **Package manager is unpinned.** Vercel's build log reports `Detected 'pnpm-lock.yaml' 9`, so production builds with pnpm, but `package.json` declares no `packageManager` field and `package-lock.json` is also committed.
5. **Revalidation is not wired** on `StreetContent` writes.

Not yet queued, raised but unassigned:

- `heroSearch.ts` resolves 5 slugs to physically different streets; needs an ambiguity guard.
- Condo H1s still render abbreviations such as `Nadalin Hts`.
- Stored `HubContent.metaDescription` drifts from live on 21 of 22 hubs. That column is no longer served, so this is cleanup, not a defect.
- Rent pill disagrees with the market card on `melville-bonus-crescent-milton` and `mcdougall-crossing-milton`. Known standing defect, noted but not gated by the battery.

## Next expected task

**QUEUE item 1, naming close-out and hygiene.** Do not self-start it. It begins only on an explicit prompt, and is marked done in the same commit that rewrites this file.

# Handoff

_Last rewritten 2026-09-03._

## Where things stand

| | |
|---|---|
| branch | `fix/naming-closeout` @ `a850640`, pushed, **not merged** |
| `main` | `48957e1` `Merge branch 'chore/session-state'` |
| production | serving `48957e1` (confirmed via `/api/build`) |
| preview | `miltonly-gy10g0owg`, Ready, serving `a850640` |
| battery on preview | `PASS · 9 checks · 428 pages · 73s`, exit 0 |
| local gate | `pnpm build` exit **0** (see the flake note below) |
| package manager | pnpm 9.15.9, pinned; no npm lockfile in the repo |

## What shipped 2026-09-02

All merged to `main` and verified on production.

- **`fix/signin-unblock`** (`d379e8e`): `/signin` unblocked in robots so its `noindex` can be read, plus two missing `nofollow`s.
- **`feat/street-meta-ctr`** (`9b9ac83`): price, sample count and window come from one basis (`eabef1b`); leases no longer counted as sales and the global title template removed (`8b7ea6c`); Bennett per-slug override deleted (`da5e15a`).
- **`fix/street-name-canon`** (`39d8848`): one repaired name feeding title and H1 (`5d304ae`); the index gets only what the page prints (`2460df9`).
- **`feat/name-source`** (`067e99c`): **DEC-NAME-SOURCE Build 1.** `src/lib/streetName.ts` created as the naming authority; 4 redirected slugs retired and the public listings API canonicalised (`4c05cc5`).
- **`fix/provider-sitemap`** (`bb1afc6`): `AI_PROVIDER` fails closed (`33c60d7`); listing detail URLs in the sitemap and www pinned to apex (`f429b6a`).
- **`fix/generator-name-wire`** (`69f3f66`): the generator derives its name from the registry (`2939710`).
- **`fix/name-prose`** (`33bed68`): **DEC-NAME-SHORT.** Full name in prose and headings; typographic dashes removed from street copy (`781a40b`, `d0e816b`).

## What shipped 2026-09-03

- **`fix/verify-build-sha`** (`de7f70b`): the battery asserts the served build before any content check, aborting with exit 2 on a mismatch (`87aee08`). `/api/ping` proved unusable because `CRON_SECRET` is Production-only, so `src/app/api/build/route.ts` was added (`ce336b8`).
- **`chore/session-state`** (`48957e1`): `CLAUDE.md`, `HANDOFF.md`, `QUEUE.md` and a tracked `scratchpad/reports/`.
- **DEC-NAME-SOURCE Build 2** (data): 11 of 13 directional streets regenerated clean; `jarrett-crossing-milton` published; `StreetAdjacency` rebuilt to 1052 rows with 26 stale labels repaired.
- **Task 1 closed.** The hub-meta failures were never a data defect: the battery had been reading CDN-cached renders from an older build.

## In flight: QUEUE item 1 on `fix/naming-closeout`

Done on the branch, green on preview, awaiting review:

- **Both upsert branches derive the name.** `generateStreet.ts` create branch now writes `resolveStreetName(...)`. The guard is rewritten from file-level to branch-level: it isolates each upsert branch by brace matching and requires the resolver in both. Verified **red against main's file, green against the branch**.
- **`gifford-crescent-milton` repaired**: `"Gifford Cres"` to `"Gifford Crescent"`.
- **DEC-REGEN-REVALIDATE wired.** Every successful `StreetContent` write purges `/streets/<slug>`, `/streets`, and `/neighbourhoods/<hub>`, the hub resolved through `Neighbourhood.rawStrings`. Guarded, because `revalidatePath` needs a request scope a bulk script does not have.
- **`parkway-drive-milton` regenerated clean, first attempt.** Root cause was a validator false positive, not the model: it named **"Brian Best Park"**, a Town park whose address is *320 Parkway Drive W*, so it sits on the street being described and every faithful attempt named it. `wordBoundaryRegex("best")` matched inside the proper noun. Grounded proper nouns are now masked before the banned-word test; invented superlatives are still caught.
- **Packaging pinned.** `packageManager: pnpm@9.15.9` (corepack rejects a bare major; 9.x supports the Node 20 this project declares), `package-lock.json` deleted, `.gitattributes` gains `* text=auto`, `build.log` gitignored. `pnpm install` left `pnpm-lock.yaml` byte-identical.

## Open items

1. **380 of 472 `StreetContent` rows have a stored `streetName` that differs from the resolver.** The create-branch gap predates Build 1, so nearly the whole corpus carries an abbreviated stored name (`"Williams Ave"`, `"Winter Cres"`). **Not user-visible** — the renderer and generator both resolve — but the column is wrong and the DEC-PH41-DUALWRITE read paths trust it. Only `gifford-crescent-milton` was repaired, as scoped. A 380-row backfill needs an explicit decision.
2. **`burnhamthorpe-road-milton` cannot be regenerated, and it is not a keying defect.** The slug is consistent across `Listing`, `ResidentialStreet` and the registry. The street has exactly one listing, status `expired`; DB2 holds zero rows for it under any key (checked by `street_slug` and by `address`); DB3 has no row at all. `getStreetStats()` returning null is correct behaviour. The open question is whether a published page should exist for a street with no data, which is a decision, not a fix.
3. **Local `pnpm build` is flaky on a 1-connection pool.** `DATABASE_URL` carries `connection_limit=1` with `pgbouncer=true`; run 1 failed 5 of 530 prerenders on a 10s pool timeout, run 2 passed with zero failures on identical code. `getOrGenerateStreetContent` is not called by the street page, so the revalidation added here is not in that stack. Worth raising the local pool limit so the gate is deterministic.
4. `heroSearch.ts` resolves 5 slugs to physically different streets; needs an ambiguity guard.
5. Condo H1s still render abbreviations such as `Nadalin Hts`.
6. Stored `HubContent.metaDescription` drifts from live on 21 of 22 hubs. That column is no longer served, so this is cleanup.
7. Rent pill disagrees with the market card on `melville-bonus-crescent-milton` and `mcdougall-crossing-milton`. Known standing defect, not gated.

## Next expected task

Review `fix/naming-closeout` and decide three things: whether to merge it, whether to backfill the 380 stored names, and what to do with `burnhamthorpe-road-milton`. QUEUE item 1's "Done when" cannot be met as written, because it requires `burnhamthorpe-road` to regenerate clean and there is no data to regenerate from.

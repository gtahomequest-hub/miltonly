# Handoff

_Last rewritten 2026-09-03._

## Where things stand

| | |
|---|---|
| `main` | `973940a` `Merge branch 'fix/naming-closeout'` |
| production | `miltonly-81x82cqig`, Ready, serving `973940a` (confirmed via `/api/build`) |
| battery | `PASS · 9 checks · 428 pages`, exit 0, run twice on production (before and after the backfill) |
| published street pages | 428 |
| stored street names | 0 of 472 `StreetContent` rows drift from the resolver |
| package manager | pnpm 9.15.9, pinned; no npm lockfile in the repo |
| prebuild suite | 9 tests |
| QUEUE | items 1 and 2 **done**; items 3 to 5 not started |
| R2 | bucket `miltonly-video`, ENAM, 18 objects; **8 of 9 street pages serve R2 video**; Vercel Blob emptied |
| published street pages | 431 |

## What shipped 2026-09-02

- **`fix/signin-unblock`** (`d379e8e`): `/signin` unblocked in robots so its `noindex` can be read, plus two missing `nofollow`s.
- **`feat/street-meta-ctr`** (`9b9ac83`): price, sample count and window from one basis (`eabef1b`); leases no longer counted as sales and the global title template removed (`8b7ea6c`); Bennett per-slug override deleted (`da5e15a`).
- **`fix/street-name-canon`** (`39d8848`): one repaired name feeding title and H1 (`5d304ae`); the index gets only what the page prints (`2460df9`).
- **`feat/name-source`** (`067e99c`): **DEC-NAME-SOURCE Build 1.** `src/lib/streetName.ts` as the naming authority; 4 redirected slugs retired, public listings API canonicalised (`4c05cc5`).
- **`fix/provider-sitemap`** (`bb1afc6`): `AI_PROVIDER` fails closed (`33c60d7`); listing detail URLs in the sitemap, www pinned to apex (`f429b6a`).
- **`fix/generator-name-wire`** (`69f3f66`): the generator derives its name from the registry (`2939710`).
- **`fix/name-prose`** (`33bed68`): **DEC-NAME-SHORT.** Full name in prose and headings; typographic dashes removed from street copy.

## What shipped 2026-09-03

- **`fix/verify-build-sha`** (`de7f70b`): the battery asserts the served build before any content check, aborting with exit 2 on a mismatch. `/api/ping` proved unusable because `CRON_SECRET` is Production-only, so `src/app/api/build/route.ts` was added.
- **`chore/session-state`** (`48957e1`): `CLAUDE.md`, `HANDOFF.md`, `QUEUE.md`, and a tracked `scratchpad/reports/`.
- **`fix/naming-closeout`** (`973940a`): **QUEUE item 1.** Detail in `scratchpad/reports/050-naming-closeout.md`.
  - Both branches of the `StreetContent` upsert derive `streetName` from the registry. The guard that missed the gap went from file-level to branch-level, isolating each branch by brace matching; verified red against main's file and green against the fix.
  - **DEC-REGEN-REVALIDATE**: every successful `StreetContent` write purges `/streets/<slug>`, `/streets`, and `/neighbourhoods/<hub>`. Guarded, because `revalidatePath` needs a request scope a bulk script does not have.
  - **The parkway-drive mystery was a validator false positive.** It failed 20 attempts across four runs on `superlative`, always because the model correctly named **"Brian Best Park"**, a Town park whose address is *320 Parkway Drive W* — on the street being described. `wordBoundaryRegex("best")` matched inside the proper noun, so every faithful attempt was rejected and no retry could ever clear it. Grounded proper nouns are now masked before the banned-word test; invented superlatives are still caught. It regenerated clean on the first attempt.
  - Packaging pinned to `pnpm@9.15.9`, `package-lock.json` deleted, `.gitattributes` gains `* text=auto`, `build.log` gitignored.
- **Stored-name backfill** (data): `scripts/backfill-street-names.ts` repaired **378 rows**; a rerun reports 0. Idempotent, no LLM, `streetName` only.
- **DEC-NAME-SOURCE Build 2** (data): 11 of 13 directional streets regenerated; `jarrett-crossing-milton` published; `StreetAdjacency` rebuilt to 1052 rows with 26 stale labels repaired.
- **Task 1 closed.** The hub-meta failures were never a data defect: the battery had been reading CDN-cached renders from an older build.

## R2 setup, done 2026-09-03 (QUEUE item 2, setup phase)

Bucket and access are live and proven end to end. **No clips uploaded yet**; that is the next prompt.

| | |
|---|---|
| account | `Gtahomequest@gmail.com's Account`, ID `1b43951a70788eea4846d43c6e0d13ec` |
| bucket | `miltonly-video`, location **ENAM**, Standard, currently 0 objects |
| public base | `https://pub-7975a00b72d94caba9def0c4b5e9c388.r2.dev` |
| credentials | `.env.local` (gitignored) and Vercel **Production and Preview**, both Hidden/Secret |

`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_BASE_URL` are set in all three places. The token is scoped Object Read & Write on `miltonly-video` only.

**R2 had to be enabled by hand first.** `wrangler r2 bucket create` and `bucket list` both failed with `code: 10042, Please enable R2 through the Cloudflare Dashboard` until the product was activated on the account. Wrangler cannot do that step.

**`video.miltonly.com` is not attachable, by design of where DNS lives.** `wrangler r2 bucket domain add` requires `--zone-id`, and `miltonly.com` is not a Cloudflare zone: its authoritative nameservers are `ns1.vercel-dns.com` and `ns2.vercel-dns.com`. Cloudflare only activates a zone once NS points at it, so the custom domain would mean moving DNS for the whole production site. The `r2.dev` URL is the fallback in place. It is rate-limited by Cloudflare and not intended for production traffic at volume, so it is a starting point rather than a resting place.

**Proof, run over the S3 API with raw SigV4 (no new dependency added):**

```
object: _healthcheck/r2-proof.txt  bytes: 1024
1) S3 PUT     -> 200 OK
2) public GET -> 200 OK  bytes=1024
3) S3 DELETE  -> 204 No Content
   re-GET after delete -> 404
```

Bucket verified empty afterwards.

**Upload phase 2026-09-03**, branch `feat/r2-video-upload` @ `fef75e0`, preview `miltonly-9k72wspkw` battery 9/9, **not merged**. Detail in `scratchpad/reports/051-r2-video-upload.md`.

- **18 objects uploaded**, nine clips and nine posters, at `streets/<slug>-milton/day.mp4` and `.../poster.webp`. Content-Type set, `Cache-Control: public, max-age=31536000, immutable`, Range requests answered. `scripts/upload-street-videos-r2.ts` is idempotent on a HEAD size check, proven when a transient TLS error killed a run after five streets and the re-run skipped exactly those five.
- **Poster is `.webp`, not the `.jpg` the brief named.** Every staged poster is a webp; a `.jpg` key would have lied about the bytes. There is no poster column, so `deriveVideoPoster` learned the layout (`day.mp4` -> `poster.webp`), keeping the legacy `.mp4` -> `.webp` arm so a Blob-era row cannot silently lose its poster and its VideoObject.
- **A capture-date bug, found and fixed mid-run.** The filename timestamp is local and the caption renders in UTC, so parsing it as an instant pushed every evening capture a day forward: `frost-court_20260825` first wrote 2026-08-26. Seven of nine were affected. It now stores UTC midnight of the shot date.
- **Only 5 of 9 streets have a page.** `clifford-point`, `chretien-street`, `heaven-crescent` and `tasker-court` have a `ResidentialStreet` entity but no `StreetContent` row, so the update matched nothing. Their assets are in R2 and ready; there is nowhere to show them.
- **The Vercel Blob object is intentionally still there.** Production serves a cached render pointing at the Blob URL, the page is `revalidate = 3600`, and deleting now would break the live lemieux page for up to an hour. Safe order: merge, confirm production serves R2, then delete.


## QUEUE item 2 completed 2026-09-03, merged as `7c2a448`

Nine clips and nine posters live in R2; **eight of the nine street pages serve video from it**, verified on production. The Vercel Blob objects are deleted and the old URL 404s.

| | |
|---|---|
| bucket | `miltonly-video`, ENAM, 18 objects |
| public base | `https://pub-7975a00b72d94caba9def0c4b5e9c388.r2.dev` |
| key layout | `streets/<slug>/day.mp4`, `streets/<slug>/poster.webp` |
| published street pages | 431 (was 428) |

**Three pages were generated to receive video**: `clifford-point`, `chretien-street`, `heaven-crescent`, all judge PASS with names matching the resolver, $0.0223 total. `tasker-court-milton` still has none, and cannot: its four DB2 sales are all older than the 12-month window (latest 2025-03-01), DB1 has no listings and DB3 no row, so `getStreetStats()` correctly returns null. Its clip and poster sit in R2 unused. Same shape as `burnhamthorpe-road-milton`.

**`/api/revalidate` is alive again.** It had been dead code: the route compared against `REVALIDATION_SECRET`, which was set neither locally nor in any Vercel environment, so every request 401d. A 32-byte secret is now in `.env.local` and both Vercel environments. Verified on production: 200 with the secret, 401 without. It earned its keep immediately, purging the three new pages after the video columns were wired.

**The battery caught the promotion race once.** The first production run after the merge failed 5 hub-meta assertions on `campbellville` ($1,890,000/15 vs a live $1,820,000/16). The hub was being served from the outgoing deployment while the DB had moved. A re-run 30 seconds later passed with `Age: 0` and `X-Vercel-Cache: MISS`, and the full battery has passed twice since. This is exactly the gap flagged when the build-SHA gate shipped: it catches the wrong deployment, not the right deployment serving a stale cached page.

## Open items

1. **`burnhamthorpe-road-milton` is published with no data behind it.** Not a keying defect: the slug is consistent across `Listing`, `ResidentialStreet` and the registry. One listing, status `expired`; zero DB2 rows by `street_slug` or by `address`; no DB3 row. `getStreetStats()` returning null is correct. QUEUE item 1 was closed with this exempted; the remaining question is whether the page should be unpublished, which is a decision, not a fix.
2. **Local `pnpm build` is non-deterministic on a 1-connection pool.** `DATABASE_URL` carries `connection_limit=1` with `pgbouncer=true`; one run failed 5 of 530 prerenders on a 10s pool timeout, the next passed with zero on identical code. Raising the local limit would make the mandated gate trustworthy.
3. `heroSearch.ts` resolves 5 slugs to physically different streets; needs an ambiguity guard.
4. Condo H1s still render abbreviations such as `Nadalin Hts`. QUEUE item 4 covers this.
5. Stored `HubContent.metaDescription` drifts from live on 21 of 22 hubs. That column is no longer served, so this is cleanup.
6. Rent pill disagrees with the market card on `melville-bonus-crescent-milton` and `mcdougall-crossing-milton`. Known standing defect, noted but not gated.
7. Five `StreetContent` rows carry an empty description, all `status=draft`, so no published page is affected. Noted while verifying the backfill; not investigated.

## Next expected task

**QUEUE item 3, address anchors.** Gate A recon first, no code until the map is approved. Do not self-start it.

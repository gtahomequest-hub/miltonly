Pushed. `main` is at `0e1871d`, Vercel should be building now.

## What shipped

Three merge commits in stack order, all verified present on `main`:

```
0e1871d  Merge feat/seo-crawl-budget
93838c4  Merge feat/street-adjacency
37a4dea  Merge feat/street-video
6e23635  (previous main)
```

The four SEO surfaces, confirmed on `main` after merge:

| Surface | State |
|---|---|
| `robots.ts` disallow | `/admin/`, `/api/`, `/signin`, `/rentals?` — `/listings?` and `/sold?` removed |
| `/signin` | `noIndex: true` (inert until the block lifts, as agreed) |
| `ListingExtras.tsx:467` | `rel="nofollow"` |
| `SavedDashboard.tsx:128` | `rel="nofollow"` |

The sitewide followable `/signin` link in the Navbar goes away with this deploy too — that was branch-only until now.

## The blocker, and what I did about it

`npm run build` was failing on `main` as well as the branch — the `prebuild` chain halted on `test-canonicalization-regression.ts`, so `next build` never ran. The test file is byte-identical between `main` and the branch and reads live DB data, so it was a data condition, not a code regression from any of the three branches.

Fix applied (rename, per the b58a408 precedent):

```sql
UPDATE "StreetGeneration"
   SET "streetSlug" = 'van-fleet-terrace-milton'
 WHERE "streetSlug" = 'van-fleet-terr-n-a-milton';   -- 1 row
```

Guarded before writing: aborted if the canonical slug already existed in `StreetGeneration`, or if the match wasn't exactly one row. Neither triggered. `status` stays `failed`, `generatedAt` untouched. Guard then reported `PASS — 1 allowed abbreviated row(s) present, no regressions`.

`npm run build` then exited **0** — full `next build`, 428+ street paths prerendered. `main`'s tree hash is byte-identical to the tree that was built, so the passing build covers exactly what was deployed rather than something adjacent to it.

Context: the row landed **2026-08-25**; `main`'s tip was **2026-08-17**. Nobody had deployed since, so it sat undetected — roughly a week of silently unshippable `main`. Worth checking whether Vercel deploy notifications are on.

## Still open

**The GSC check.** Inspect in Search Console -> URL Inspection (indexed-URL panel, not Live Test):

| # | URL | Why |
|---|---|---|
| 1 | `https://miltonly.com/signin?redirect=/listings/W13448534` | created **2026-06-16**, one day post-block |
| 2 | `https://miltonly.com/signin?redirect=/listings/W13445774` | created **2026-06-16** |
| 3 | `https://miltonly.com/signin?redirect=/listings/W13453488` | created **2026-06-17** |
| 4 | `https://miltonly.com/signin?redirect=/listings/W13726586` | created **2026-09-01**, tests current behaviour |
| 5 | any `/signin?redirect=...` row from the 1,000-row sample | pre-block baseline |

- #1-3 **"URL is unknown to Google"** -> block is holding, the 1,150 bucket is frozen pre-block history.
- #1-3 **appear with any last-crawl date** -> block is not holding; remove `/signin` from `robots.ts` immediately rather than next deploy.

These three are decisive because their listings first entered the DB *after* the block, so their `/signin` URL could only have been minted by `ListingExtras.tsx` on a detail page that did not exist on 2026-06-15. There are 1,396 such post-block advertisable listings.

**The follow-up deploy** — removing `/signin` from the disallow, which is the only thing that lets those ~1,150 rows migrate to "Excluded by noindex" and drop out. Sequenced after this one, as agreed.

**Unverified:** Vercel success can't be confirmed from this session — no `vercel` CLI, no API token. The build passing locally on the identical tree is strong evidence, but worth a glance at the dashboard.

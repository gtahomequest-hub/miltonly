Committed as `8930c3c`. Working tree clean, typecheck passes.

## What I changed

`rel="nofollow"` on the two live anchors, and corrected two comments that asserted things that weren't true.

| File | What it is |
|---|---|
| `src/app/listings/[mlsNumber]/ListingExtras.tsx:466` | VOW teaser, every advertisable listing detail page, `href="/signin?redirect=/listings/<mls>"` |
| `src/app/saved/SavedDashboard.tsx:127` | `!user` empty state on `/saved`, inbound from FooterSection |
| `src/app/robots.ts` | comment: Disallow + noindex are mutually exclusive, not belt-and-suspenders |
| `src/app/signin/page.tsx` | comment: `noIndex:true` is inert while the block stands |

The sweep confirmed those two are the **complete** list — no third link exists. Three other un-nofollowed `/signin` anchors turned up (`MlsExplore.tsx:56`, `LockedStat.tsx:35`, the v1 `SoldRecordsIsland.tsx:135`) but all are dead code, and a grep for `dynamic(` across src/ returns zero, so nothing can lazily revive them.

`ListingExtras.tsx:466` is the one that mattered: rendered unconditionally on every advertisable listing detail page, `href` is per-MLS, so it's the only `/signin` generator whose URL count scales with inventory.

## Three corrections — one to the GSC inference

**The inference is plausible but the evidence doesn't establish it.** The `/signin` canonical has been live since **2026-04-10** (`a0ca650`), two months *before* the block went in on **2026-06-15** (`dc2ed6e`). "Alternate page with proper canonical tag" requires Google to have read that tag — and every crawl in the Apr 10 -> Jun 15 window satisfies that. GSC Page Indexing is a per-URL state refreshed only on re-processing, so once blocked, the bucket freezes rather than drains. Every `/signin?...` param shape in the sample also predates the block; the only post-block shape (`SoldOnMyStreet`, Aug 12) is dead and already nofollowed.

**The 472 -> 584 growth isn't a valid comparison.** 472 came from `dc2ed6e`'s commit message describing an unspecified report; 584 is a row count inside GSC's capped 1,000-row example table, which isn't a uniform sample of the 1,150. Neither figure is a total of the same thing.

**None of the crawl-budget work is deployed** — including the Navbar nofollow, which was added in `db0773e`. So the live site currently has a *followable sitewide* `/signin` link on every page. That's a more likely ongoing discovery path than Google defying robots.txt.

"Google is ignoring robots" stays unlikely: the documented non-compliance mode is index-without-crawl, which lands in **"Indexed, though blocked by robots.txt"** — a different bucket than the one observed.

**The decisive check:** GSC -> URL Inspection on 3-5 of those rows -> "Last crawl" under *Page indexing* (the indexed-URL panel, not Live Test — Live Test only reports today's robots).
- Last crawl **before 2026-06-15** -> the block is working, the bucket is inert history.
- Last crawl **after 2026-06-15** -> the block isn't holding, remove it immediately.

## robots vs noindex — recommendation

**Keep the Disallow in this deploy; remove it one deploy later.** Sequenced, never simultaneous.

The reason for the sequence is specifically `ListingExtras.tsx:466`: lifting the block while that anchor still minted a URL per listing would have re-opened an inventory-scaled generator to crawling. That's now fixed, so the follow-up is safe.

Honest sizing: those URLs are **not indexed** and cost **no crawl budget while blocked**. The `noindex` buys almost nothing on its own — it's the *mechanism* by which the 1,150 rows could eventually leave the report, but only once the block is lifted. Expect report hygiene, not a coverage or ranking movement.

Stronger option not taken (nofollow was the ask): `VOWTeaser` is already a client component using `router.push` at `ListingExtras.tsx:77`, so it could be a `<button onClick>` with no href at all. `rel="nofollow"` is a hint Google may still use for discovery; removing the anchor provably ends it. Real UX change though — loses middle-click and link semantics.

## Housekeeping

`package-lock.json` is stashed as `stash@{0}` — pure npm-version churn, 12 `libc` blocks removed, zero `version`/`resolved`/`integrity` changes. npm 10.8.2 locally is older than whatever wrote it. Those fields help npm resolve musl vs glibc optional binaries, so git's copy is the one to keep; `git stash drop` is safe.

## Merge order (unchanged)

The three branches are a linear stack, not parallel — `feat/seo-crawl-budget` already contains all of it.

```
main (6e23635)
  └─ 9d73ae7, cb7a07f, 98e79dd  -> feat/street-video
       └─ 38a86a0               -> feat/street-adjacency
            └─ db0773e, eb11bef, 8930c3c -> feat/seo-crawl-budget
```

Merge as three PRs in that order. `git merge-tree --write-tree main feat/seo-crawl-budget` matches the branch tree exactly — clean in every ordering, so budget no conflict time. Squash-merge is a scope trap, not a conflict trap: squashing the SEO branch alone lands 29 files and two DDL migrations under one `fix(seo):` commit.

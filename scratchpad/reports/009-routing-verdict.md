The routing claim is **false**, but the investigation found a real wrong-street bug somewhere else. Both verified against live DBs, not read off code.

## The cedric->jelinik claim: refuted

```
getStreetPageData("cedric-terrace-milton")  -> "Cedric Terrace",  43.4829/-79.8672, ["Harrison"]
getStreetPageData("jelinik-terrace-milton") -> "Jelinik Terrace", 43.4970/-79.8887, ["Scott"]
resolveHeroSearch("cedric terrace")         -> /streets/cedric-terrace-milton
```

They cannot merge: the sibling union requires `identityKey` equality, and the keys are `cedric||terrace` vs `jelinik||terrace`. The candidate pool is bounded by a base-prefix `LIKE`, so base `cedric` cannot reach base `jelinik`. An exhaustive sweep of 2,186 candidate slugs through a verbatim copy of `canonicalFor` produced 1,105 redirects and **zero** that change the street base or type.

**What the auditor probably saw:** `cedric-terrace-milton` has **no `StreetContent` row**, so `sitemap.ts:156-157` excludes it — while `jelinik-terrace-milton` is published and submitted. Cedric still serves a live 200. Google ranking the nearest indexed "… Terrace" page for that query is a *ranking* observation, not the site serving wrong content.

## But there is a genuine wrong-street bug — in the query resolver

`heroSearch.ts` builds its index only from **surfaced** streets, and `looseKey()` pops trailing type tokens including `common`, `path`, `gate`, `lane`. The ambiguity guard at `:94-102` — which the file header promises means "we never guess" — only sees surfaced rows. When one of a shared-base pair is unsurfaced, the collision is invisible and the surfaced partner wins.

Typing a street's **exact official name** routes to a physically different street:

```
CARGILL COMMON    -> /streets/cargill-path-milton
JEMPSON COMMON    -> /streets/jempson-path-milton
MAGURN LANE       -> /streets/magurn-gate-milton
MCEASTERN COMMON  -> /streets/mceastern-path-milton
SELLERS COMMON    -> /streets/sellers-path-milton
```

Distinctness proven from the Town's own centrelines — separate centroids, separate segment counts, each pair lists the other in `connects`. Impact is navigation only; all five sources have no content, so their own pages would 404. Reachable in production via `/api/hero-search`.

## And one page publishes another street's name

`/streets/kennedy-circle-milton` renders H1 **"Kennedy Circle West"**. The name chain at `street-data.ts:347-356` takes `streetContent.streetName` and never consults the registry. 15 of 431 published pages render an H1 disagreeing with the registry; that one is the only case where the wrong name is another registry street's exact name.

Same defect class as the shipped name repair — `displayStreetName` fixes *artifacts* in the name, but not the name being sourced from the wrong field. Fix is one insertion: put `registryNameFor(slug)` first in that chain.

On the Kennedy merge itself, checked rather than assumed: all 55 sold rows show postal codes carrying both "Kennedy Circle" and "Kennedy Circle W" forms, house number 545 in both. The merge looks right; **the defect is the name, not the merge**.

## Revised queue

The poisoning is in search resolution and name sourcing, not URL routing. None of it changes what has already shipped.

1. **Registry name canon** — one line, fixes 15 pages including the one publishing a neighbour's name
2. **heroSearch ambiguity guard** — ~6 lines, fixes 5 wrong-street resolutions
3. **The 39 drafts**

## Settle it against production in a minute

```
curl -sI https://miltonly.com/streets/cedric-terrace-milton          # expect 200, no Location
curl -s  https://miltonly.com/streets/cedric-terrace-milton | grep -o '<h1[^>]*>[^<]*'   # "Cedric Terrace"
curl -s  "https://miltonly.com/api/hero-search?q=cargill+common"     # currently /streets/cargill-path-milton
curl -s  https://miltonly.com/streets/kennedy-circle-milton | grep -o '<h1[^>]*>[^<]*'   # "Kennedy Circle West"
```

Then: GSC -> Performance -> filter Query contains "cedric" -> Pages tab. If impressions land on `/streets/jelinik-terrace-milton`, that is Google choosing a page to rank, already refuted as routing by the curls above.

## Open

- Merge `fix/street-name-canon` (2 commits: name repair `5d304ae`, suppression leak `2460df9` — both build green)
- Whether the rulebook's K=10 vs the code's `K_TYPICAL >= 5` is worth investigating

Full verdict at `scratchpad/routing.txt`.

## Commit trail

| Branch | Commit | State |
|---|---|---|
| `main` | `9b9ac83` | deployed |
| `fix/street-name-canon` | `5d304ae` | name repair + prebuild test |
| | `2460df9` | suppression leak + parity guard + tmp-* build immunity |

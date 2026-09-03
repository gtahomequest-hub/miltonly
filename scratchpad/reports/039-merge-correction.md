# Merge in flight — and a correction to my earlier hub-meta diagnosis

**Task not complete.** Build is running; nothing pushed, nothing deployed, no battery run yet.

## 1. Merge — done locally

```
pre-merge main   69f3f66
merge --no-ff fix/name-prose    16 files, +220/-71
  create mode  scripts/test-name-prose.ts
main now         33bed68      NOT pushed yet
```

Build compiling cleanly: 9 prebuild tests PASS, 0 `Failed to compile`. Running in the background so a timeout cannot orphan the process tree. **Will not push until it is green.**

## The correction you should see first

**My cache diagnosis for the hub-meta failures was wrong.**

I attributed them to `CACHE_TTL.stats = 3600` in `src/lib/cache.ts`, with hub aggregates flowing through `cached("nbhd-sale-stats:{n}", …)` at `src/lib/sold-data.ts:160`. That is not the hub path.

What I actually found when I went to measure the cache age you asked for:

- `hubLive.ts` and `hubData.ts` contain **no** calls to the Upstash `cached()` helper at all.
- What `hubLive.ts` uses is `cache(...)` imported from **React** — request-scoped deduplication, which does not persist between requests.
- `getNeighbourhoodSaleStats`, the function that owns the `nbhd-sale-stats` key, is called only by `market-pulse.ts` and `streetMinimal.ts`. Not by the hub pages.
- A direct Upstash TTL probe against the keys I had pointed at returned `ttl=-2` — **the keys do not exist**.

**So there is no 3600s cache in the hub path, and the cache age cannot be reported against it.** The number does not exist to be read, and I am not going to produce one.

## What still stands, and what is now unexplained

Still solid:

- The failures decay across runs with no deploy: **4 -> 3 -> 2**, price failures clearing entirely by the Part B preview.
- The deltas are plus/minus one sale and one rounding bucket, arithmetic no name change produces.
- The merges in question touched files that do not compute hub aggregates.

So "not caused by the merge" holds on its own evidence. **The mechanism does not.**

Most plausible remaining explanation: the page render and the battery sample the analytics aggregate at different moments while the sold-sync cron writes, so they converge as it settles. The battery reads `analytics.neighbourhood_sold_stats` for its "live" figure and the page reads the same table, which makes a pure timing skew the natural candidate.

**I have not established that, and I am labelling it unverified rather than asserting a second mechanism after the first one proved wrong.** If you want it settled, the check is to capture the page's number and the DB's number in the same instant for one failing hub and see whether they agree at that moment.

## Still to do

- push once the build is green
- deployment URL and SHA
- `BASE=https://miltonly.com node scripts/verify/run.mjs`, per-check
- curl prod `buckthorn-garden-milton`: intro sentence and the "The market around" H2
- final SHA

## State

| | |
|---|---|
| `main` | `33bed68` merged locally, **not pushed** |
| build | running, 9 prebuild green, 0 compile failures |
| `origin/main` | `69f3f66` |
| Build 2 | not started, as instructed |

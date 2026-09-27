# MA-007
AUDIT · D:\miltonly-audit · feat/audit

## MA-007: why /streets/[slug] is 9.6% cached

Read-only, 2026-09-20/21, production at `d068f84` (MC-034 landed at 23:57Z during the measurement).
Tooling: `scripts/audit/cache-states.mjs` (one GET per sitemap URL in a route family, recording
`x-vercel-cache`, `age`, `cache-control` and TTFB), raw output in `scratchpad/audit/MA-007/`, untracked.
Nothing under `src/` was touched.

### The cause, in one paragraph

The route is not opted out of static rendering and it caches correctly once warm. The 9.6% is a cold-cache
artefact with three multipliers: **seven production deployments in the last 24 hours** (`npx vercel ls
--prod`), each of which drops the ISR entry of every street outside the 50-slug prerender set
(`src/lib/streetPrerender.ts:14`, `PRERENDER_STREET_LIMIT = 50` of 646 published); **the production battery
after each merge**, which fetches all 646 street pages within 13 minutes of the deploy and so turns every one
of those drops into an origin render; and **real traffic too thin to re-warm 646 pages**, under three visitor
requests a page a day. The hub is 72% because `generateStaticParams` returns all 22 hubs
(`src/app/neighbourhoods/[slug]/page.tsx:36-40`), so a deploy leaves them `PRERENDER`, and `/api/jobs/warm-hubs`
re-walks them after every tag drop. The street page has neither.

### The six candidates

1. **cookies(), headers(), draftMode(), searchParams in the street render tree: no.** `page.tsx` takes
   `{ params }` only (`src/app/streets/[slug]/page.tsx:19`, `:33`, `:42`). The only non-API callers of
   `cookies()` are `src/lib/auth.ts:25,37,52`, imported by `/listings`, `/sold`, `VowGate.tsx` and
   `NeighbourhoodSoldBlock.tsx`, none of which the v2 street tree renders (`StreetPage.tsx:9-29`). The
   sold-records card is a client island that fetches `/api/streets/<slug>/sold-records` after hydration
   (`src/components/street/v2/SoldRecordsIsland.tsx:37`); the server render never reads the session. No
   `unstable_noStore`, no `cache: "no-store"` fetch, no `dynamic = "force-dynamic"` anywhere in
   `street-data.ts`, `streetV2Data.ts`, `streetMinimal.ts`, `comparisonData.ts`, `loadStreetGeneration.ts`.
   Proof from the edge: six spaced GETs of `/streets/restivo-lane-milton` at 00:04Z answered `HIT` with
   `Age` 7, 12, 18, 23, 29, 34 and TTFB 160 to 260 ms.
2. **Route config.** Street: `dynamicParams = true`, `revalidate = 3600`, `generateStaticParams` = top 50
   (`page.tsx:23-31`). Hub: `revalidate = 86400`, `dynamicParams = true`, `generateStaticParams` = every
   published hub (`neighbourhoods/[slug]/page.tsx:28-40`). `/sell`: no `revalidate` export, fully static
   (`src/app/sell/page.tsx`). Both dynamic routes read DB2 and DB3 through the Neon HTTP driver, whose
   fetches carry `next: { revalidate: 3600 }` (`src/lib/db.ts:57`), so the hub's effective window is also
   an hour; the 86400 is not what separates them. No `fetchCache` anywhere.
3. **generateStaticParams coverage: 50 of 646.** `topStreetSlugsForPrerender` caps at
   `PRERENDER_STREET_LIMIT = 50` (`src/lib/streetPrerender.ts:14`); the sitemap lists 646 street pages
   (647 on the 20th's nightly). In the sweep 22 minutes after the deploy only 3 pages answered
   `PRERENDER`; the other 47 of the 50 had already been converted by the battery.
4. **Cache-Control / CDN-Cache-Control overrides: no.** `next.config.mjs` has no `headers()`,
   `vercel.json` sets none, middleware returns `NextResponse.next()` with no headers
   (`src/middleware.ts:165`). Every street, hub and condo response carries the same
   `cache-control: public, max-age=0, must-revalidate`, i.e. Next's standard ISR browser header.
5. **Middleware: matches, but not the cause.** `matcher: ["/streets/:path*", "/neighbourhoods/:path*"]`
   (`src/middleware.ts:207-209`); it 301s sibling slugs and otherwise falls through to `NextResponse.next()`
   (`:156-165`). The hub runs under the same middleware and is 72% cached, and `HIT` responses on the street
   route prove middleware does not force dynamic.
6. **Cold-cache artefact: yes, and it is mostly ours.** Sweep of all 646 street pages from 23:53Z to 00:19Z,
   straddling the 23:57Z deploy and Core's production battery (MC-034, `646 pages · 802s`): **546 `MISS`
   (p50 2,267 ms), 67 `REVALIDATED` (age 0, p50 2,865 ms, a synchronous render coalesced with the battery's
   request), 16 `HIT`, 14 `STALE` (ages 4,743 to 10,684 s, p50 144 ms), 3 `PRERENDER`.** The `STALE` rows
   show that an expired entry is served from cache and refreshed in the background, so the hourly
   `revalidate` does not itself cost a render on a visited page; what empties the cache is the deploy. Two
   pages rendered at 23:53Z (`mccready-drive`, `hill-street`) answered `MISS` again at 00:20Z: the deploy in
   between dropped them.

### Street versus hub, line by line

| | `/streets/[slug]` | `/neighbourhoods/[slug]` |
|---|---|---|
| pages | 646 | 22 |
| requests per page per day (Observability) | 6.3 | 34 |
| `generateStaticParams` | 50 of 646 (`streetPrerender.ts:14`) | all 22 (`page.tsx:36-40`) |
| after a deploy | 596 pages `MISS` on first hit | 22 pages `PRERENDER` |
| warm job after tag drops | none | `/api/jobs/warm-hubs`, four crons a day (`vercel.json`) |
| `revalidate` | 3600 | 86400, effectively 3600 via `db.ts:57` |
| on-demand purge | `/api/admin/publish`, `generateStreet.ts:774` only | every listing sync (`revalidateSurfaces.ts:31-42`) |
| middleware | same matcher | same matcher |
| dynamic APIs in the tree | none | none |

The hub is purged more often than the street and still caches better, because it is rebuilt at deploy and
re-warmed by a job, and because 34 requests a page a day keep an hourly entry alive. The street is neither
rebuilt nor re-warmed, and at 6 requests a page a day, most of them the battery's, the entry is cold when
a reader arrives.

### How much of the route's traffic is our own tooling

Counted from the scripts and the 24-hour window, not from Observability (which cannot be filtered here):

- **The battery** (`scripts/verify/run.mjs:86`, `:109-116`) crawls every published street page once per
  run, user agent `miltonly-verify` (`scripts/verify/lib/http.mjs:7`). Production runs in the window:
  MC-030, MC-031, MC-032, MC-034, each `646 pages` (their reports). **Four runs, about 2,580 street
  requests**, every one within minutes of a deploy, so nearly every one an origin render.
- **The nightly** (`scripts/audit/nightly/run.mjs`, user agent `miltonly-audit/nightly`): the 20th's run
  swept 507 pages, 362 of them streets and listings in rotation (647 : 471), so about 210 streets, plus the
  ten fixed audit streets, two Lighthouse loads of each and the 390 px Chrome sample. **About 240 street
  requests at 12:01Z**, one to ten hours after the last render, so mostly `MISS`.
- **Total tooling: about 2,800 of the 4,100 requests (68%) and about 2,700 of the 3,700 origin renders
  (73%).** Standing traffic is then about 1,300 requests and 1,000 renders in this window; MC-034's
  1,900 renders a day was a window with fewer batteries. Either way the MC-034 gap is the batteries.
- Core can confirm this in Vercel Observability by splitting the route by user agent: `miltonly-verify`,
  `miltonly-audit/nightly`, `miltonly-warm-hubs`, and everything else.

Seven production deployments in 24 hours (`npx vercel ls --prod`: 26 m, 10 h, 11 h ×4, 22 h ×2) is the
other half: MC-034's ignore rule now stops docs-only pushes from building, which alone removes some of them.

### The fix, one line, for MC-035

`src/lib/streetPrerender.ts:14`: `export const PRERENDER_STREET_LIMIT = 50;` becomes the published count
(`Number.POSITIVE_INFINITY`, or drop the cap and return `all.sort()`), so every street ships as
`PRERENDER` with each deploy exactly as the 22 hubs do. Effect: the 596 post-deploy `MISS` renders per deploy
become static reads, the battery's 646 fetches after a merge are served from storage instead of rendering
them, and a reader's first request after a deploy is 150 ms instead of 2.3 s. Cost: build time, measured by
MC-017 as 2 m 19 s with 609 static pages against 1 m 29 s with 149, so about a minute a build; the build
needs `connection_limit=10` on `DATABASE_URL`, which it has (CLAUDE.md). Expected cached share at today's
traffic mix: above 60%, since the deploy-and-battery renders are 73% of the misses.

Two smaller levers, not required for the share: raise `revalidate` to 86400 to match the hub (it changes
nothing about `MISS`, and expiry already serves `STALE`); and have the battery crawl a preview and only the
19 checks' fixed pages on production, which would take the route's requests down by two thirds.

## Files

- `scripts/audit/cache-states.mjs`, tracked. `scratchpad/audit/MA-007/` (three sweeps as JSON), untracked.
- `HANDOFF-audit.md` rewritten, `QUEUE.md` marked. No page, component, library file, route config or
  schema was edited.

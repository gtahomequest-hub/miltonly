# Build 1 gate — preview deployed and verified. `feat/name-source` @ `4c05cc5`. Not merged.

## 0. Safety checks — all pass, nothing to commit

```
.vercel gitignored?   .gitignore:36  .vercel      -> already ignored, no commit needed
git status --short    (empty)                     -> clean
.env.local tracked?   "did not match any file(s) known to git"  -> untracked
```

`.env.local` keys after `vercel link` rewrote it — **74 keys, all required groups present** (names only, values never read):

```
DATABASE_URL             PRESENT
SOLD_DATABASE_URL        PRESENT     (DB2)
ANALYTICS_DATABASE_URL   PRESENT     (DB3)
UPSTASH_REDIS_KV_REST_API_READ_ONLY_TOKEN
UPSTASH_REDIS_KV_REST_API_TOKEN
UPSTASH_REDIS_KV_REST_API_URL
UPSTASH_REDIS_KV_URL
UPSTASH_REDIS_REDIS_URL
DEEPSEEK_API_KEY         PRESENT
```

Nothing missing. Proceeded.

## 1. Auth

```
npx vercel whoami  ->  gtahomequest-hub
```

Logged in. Note `.vercel/` contains `README.txt` and `repo.json` — a repo-style link, not `project.json`. Deploy worked regardless.

## 2. Preview URL

```
https://miltonly-okap68dti-gtahomequest-hubs-projects.vercel.app
```

```
Build Completed in /vercel/output [2m]
readyState: READY
inspector: https://vercel.com/gtahomequest-hubs-projects/miltonly/41xjM9tpSQJB4QsLERhPaVbHZEfw
```

Checked for Deployment Protection before running anything — `status=200`, publicly reachable, so the checks below hit real pages rather than an auth wall.

## 3. Verify battery against the preview

```
BASE=https://miltonly-okap68dti-gtahomequest-hubs-projects.vercel.app node scripts/verify/run.mjs
exit 0

═══ MILTONLY STREET VERIFICATION ═══
target      https://miltonly-okap68dti-gtahomequest-hubs-projects.vercel.app
sitemap     426 published street pages (derived, not a literal)
record      DB2 + analytics aggregates loaded
hub record  22 published hubs + DB2 pools loaded
crawled     426 pages · 426 × 200 · 0 other

ASSERT iterated == live sitemap count (426) : PASS

── No sentence denies or contradicts a figure the page publishes        PASS
── Structured data publishes exactly what the page publishes            PASS
── Absence claims match the record, and every page has a working CTA    PASS
── Every published figure is floored against its own sample             PASS
── One metric, one number — and prose that still reads after suppression PASS
── Every published page is a street that exists                         PASS
── Every published coordinate is real, and every distance has two real endpoints  PASS
── Hub meta, body and JSON-LD all publish the live aggregate            PASS
── Town polygons still reproduce the TREB assignments they were licensed against  PASS

═══ PASS · 9 checks · 426 pages · 69s ═══
```

Zero FAIL lines. Five NOTEs, none gated, all pre-existing and unchanged from the production run.

**The composition check is the one that moved:**

```
── Every published page is a street that exists
   · registry entries read: 944
   · off-registry allowlist entries read: 19        (was 18 — +15-side-road-side-road)
   · published street pages: 426
   · in the Town registry: 423
   · on the off-registry allowlist: 3 (second-line-milton, nipissing-road-milton, 25-side-road-milton)
   PASS  published off BOTH lists: 0                <-- Gate A found 5 here
   PASS  parts do not sum to the published set: 0
```

423 + 3 = 426 exactly. The five slugs that belonged to no naming authority are gone — four unpublished, one allowlisted.

## Extended name guard

```
[street-name-repair] PASS — 944 registry slugs resolve to their official name,
                            plus 26 override/artifact/neighbourhood cases.
exit 0
```

## 4. H1 and title, from the preview

| slug | registry | H1 | title |
|---|---|---|---|
| kennedy-circle-milton | KENNEDY CIRCLE | **Kennedy Circle** | Kennedy Circle, Milton — Homes, Prices & Sales History |
| main-street-milton | MAIN STREET | **Main Street** | Main Street, Milton — … |
| campbell-avenue-milton | CAMPBELL AVENUE | **Campbell Avenue** | Campbell Avenue, Milton — … |
| ontario-street-milton | ONTARIO STREET | **Ontario Street** | Ontario Street, Milton — … |
| buckthorn-garden-milton | BUCKTHORN GARDEN | **Buckthorn Garden** | Buckthorn Garden, Milton — … |
| sycamore-garden-milton | SYCAMORE GARDEN | **Sycamore Garden** | Sycamore Garden, Milton — … |
| mcdougall-crossing-milton | MCDOUGALL CROSSING | **McDougall Crossing** | McDougall Crossing, Milton — … |
| 25-side-road-milton | *(off-registry)* | **25 Side Road** | 25 Side Road, Milton — … |
| second-line-milton | *(off-registry)* | **Second Line** | Second Line, Milton — … |

All nine match. The directional four (kennedy, main, campbell, ontario) now render the registry name; the two Gardens are whole; `McDougall` casing did not regress; both off-registry streets pass through, including 25 Side Road keeping its leading number.

### Redirects

```
wood-close-n-a-milton                308  -> /streets/wood-close-milton
first-line-nassagaweya-line-milton   308  -> /streets/first-line-nassagaweya-milton
clitherow-drive-milton               308  -> /streets/clitherow-street-milton
jarrett-cross-milton                 308  -> /streets/jarrett-crossing-milton

followed: final status=200 at /streets/wood-close-milton
jarrett-crossing-milton (no StreetContent row): status=200 — renders via dynamicParams
```

**308, not 301.** That is what Next emits for `permanent: true` — a Permanent Redirect that preserves the request method. Google treats 308 and 301 equivalently for canonicalisation, so this is correct, but flagging it since the brief said 301.

### sold-stats — analytics, not the Listing fallback

The HTTP endpoint could not confirm this: `/api/sold-stats` is VOW auth-gated and returns `{"error":"Sign in to view sold data","authRequired":true}` to an unauthenticated caller. Rather than report nothing, I exercised the route's exact key-derivation against the same analytics DB the preview uses:

```
name="Main Street"
   key source : REGISTRY lookup
   derivedSlug: main-street-milton
   PRIMARY analytics join rows: 1  (sold_count_12months=55)

name="Main St E"          <- the old stored name, for contrast
   key source : kebab fallback
   derivedSlug: main-st-e-milton
   PRIMARY analytics join rows: 0  -> would fall through to the Listing fallback
```

The primary join now returns a row directly. The contrast row shows the pre-change behaviour that made every request pay for the fallback.

**Caveat stated plainly:** this proves the join at the data layer, not through the live HTTP route. A signed-in request against the preview would confirm it end to end, and I did not have credentials to make one.

## 5. State

| | |
|---|---|
| preview | https://miltonly-okap68dti-gtahomequest-hubs-projects.vercel.app |
| branch | `feat/name-source` @ `4c05cc5` |
| merged | **no** |
| working tree | clean |
| battery | PASS · 9 checks · 426 pages |
| name guard | PASS · 944 + 26 |
| Build 2 untouched | content regeneration, adjacency re-run, `faqJson`, `description` |

One open item carried from before: `jarrett-crossing-milton` serves 200 but has no `StreetContent` row, so it is absent from the sitemap. The 301 lands on a working page; it just is not submitted for indexing until Build 2 gives it content.

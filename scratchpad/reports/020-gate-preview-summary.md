# Build 1 gate — preview verified. Not merged.

Full report at `scratchpad/gate-preview.md`.

**Step 0:** `.vercel` already gitignored (`.gitignore:36`) — nothing to commit. Tree clean, `.env.local` untracked. All 74 keys survived `vercel link`: `DATABASE_URL`, `SOLD_DATABASE_URL`, `ANALYTICS_DATABASE_URL`, five `UPSTASH_*`, `DEEPSEEK_API_KEY`. Nothing missing.

**Preview:** https://miltonly-okap68dti-gtahomequest-hubs-projects.vercel.app

Checked for Deployment Protection first — `200`, publicly reachable, so the checks below hit real pages rather than an auth wall.

## Battery — PASS, 9 checks, 426 pages, 69s, exit 0

Zero FAIL lines. Five NOTEs, all pre-existing and ungated. **The composition check is the one that moved:**

```
· off-registry allowlist entries read: 19      (was 18)
· published street pages: 426
· in the Town registry: 423
· on the off-registry allowlist: 3
  PASS  published off BOTH lists: 0            <-- Gate A found 5 here
```

423 + 3 = 426 exactly. The five slugs belonging to no naming authority are gone — four unpublished, one allowlisted.

**Extended name guard:** `PASS — 944 registry slugs + 26 cases`, exit 0.

## H1 / title from the preview — all nine correct

```
kennedy-circle       Kennedy Circle        main-street        Main Street
campbell-avenue      Campbell Avenue       ontario-street     Ontario Street
buckthorn-garden     Buckthorn Garden      sycamore-garden    Sycamore Garden
mcdougall-crossing   McDougall Crossing    25-side-road       25 Side Road
second-line          Second Line
```

Directionals gone, Gardens whole, `McDougall` casing intact, both off-registry streets passing through with 25 Side Road keeping its leading number.

## Redirects — all four land

```
wood-close-n-a-milton               308 -> /streets/wood-close-milton
first-line-nassagaweya-line-milton  308 -> /streets/first-line-nassagaweya-milton
clitherow-drive-milton              308 -> /streets/clitherow-street-milton
jarrett-cross-milton                308 -> /streets/jarrett-crossing-milton
followed: 200 at /streets/wood-close-milton
```

**308, not 301** — that is what Next emits for `permanent: true`. Google treats it identically for canonicalisation, but flagging it since the brief said 301.

## sold-stats — one thing not confirmable the way it was asked

`/api/sold-stats` is VOW auth-gated and returns `{"error":"Sign in to view sold data"}` to an unauthenticated caller, so the HTTP route could not prove it. The route's exact key derivation was exercised against the same analytics DB instead:

```
"Main Street"  -> REGISTRY lookup -> main-street-milton  -> 1 row (sold_count_12months=55)
"Main St E"    -> kebab fallback  -> main-st-e-milton    -> 0 rows -> Listing fallback
```

The primary join now hits. **That is a data-layer proof, not an end-to-end one** — a signed-in request against the preview would close it properly, and no credentials were available to make one.

## Open item

`jarrett-crossing-milton` serves 200 but has no `StreetContent` row, so it is absent from the sitemap. The 301 lands on a working page; it just is not submitted for indexing until Build 2 gives it content.

## State

| | |
|---|---|
| preview | https://miltonly-okap68dti-gtahomequest-hubs-projects.vercel.app |
| branch | `feat/name-source` @ `4c05cc5` |
| merged | **no** |
| working tree | clean |
| battery | PASS · 9 checks · 426 pages |
| name guard | PASS · 944 + 26 |
| Build 2 untouched | content regeneration, adjacency re-run, `faqJson`, `description` |

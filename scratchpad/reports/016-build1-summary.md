# Build 1 — `feat/name-source` @ `2a88b59`, pushed, **not merged**

**Steps 1–8 complete. Step 9 blocked: vercel still `Logged out.`**

Full report at `scratchpad/build1.md`.

## Headline results

```
Step 2 chain test        20/30  ->  30/30
Guard on branch          PASS — 944 registry slugs + 26 cases
Guard on main            FAIL — exactly 15, matching Gate A's 15 net defects
Gate B build             exit 0, 7 prebuild tests green
431-slug diff            423 agree · 0 disagree · 8 no-registry-row
                         registry 423 · off-registry 3 · fallback 5
Casing 15                unchanged   ("Mcdougall Crossing" -> "McDougall Crossing")
Directional 13           now registry ("Crt St N" -> "Court Street")
Garden 2                 now full     ("Buckthorn" -> "Buckthorn Garden")
```

## The thing worth reading

**Step 6 found the sold-stats join was already dead, and had been the whole time.** The route's own comment claimed analytics stores the abbreviated MLS form; it stores the canonical slug:

```
"Buckthorn"   -> buckthorn-milton      analytics=0    (Listing fallback: 1)
"Main St E"   -> main-st-e-milton      analytics=0    (Listing fallback: 136)
"Costigan Rd" -> costigan-rd-milton    analytics=0    (Listing fallback: 57)
resolver names -> canonical slugs      analytics=1 each
```

Every request was silently paying for the fallback. Now rejoined on the registry slug.

## Four sites I could not route, with reasons

- **`sitemap.ts:148`** — selects `streetSlug` + `updatedAt` only. No name read; nothing to route.
- **`admin/review`, `sync/regenerate`, `api/admin/publish`** — read the *stored* name deliberately. Since `generateStreet` now writes it from the resolver on create *and* update, it converges; routing the read would hide drift from the reviewer, which is what that screen exists to show. Annotated, not changed.
- **`api/content/v1/listings/recent:104`** — public API emitting raw MLS. Changing a public contract is your call, not a naming fix.
- **`RentalsClient.tsx`** — client component; importing the resolver would pull the 944-row registry into the browser bundle. Wants a server-side prop — Build 2.

## Off-registry 5 — all resolved, none unpublished

The Town's centreline layer settled the two ambiguous ones: it has `clitherow||street` (5 segments) and `jarrett||crossing`, and **no** `clitherow||drive` or `jarrett||cross`. Both are MLS mis-suffixes, and `jarrett-cross` matches the existing `mcdougall-cross` -> `mcdougall-crossing` precedent already in `next.config.mjs`.

Four 301s added; `15-side-road-side-road` went to `OFF_REGISTRY_STREETS` because its canonical is *itself* off-registry with no page — a 301 would point at nothing.

| slug | disposition |
|---|---|
| `wood-close-n-a-milton` | 301 -> `wood-close-milton` (live duplicate) |
| `first-line-nassagaweya-line-milton` | 301 -> `first-line-nassagaweya-milton` (live duplicate) |
| `clitherow-drive-milton` | 301 -> `clitherow-street-milton` |
| `jarrett-cross-milton` | 301 -> `jarrett-crossing-milton` (target has no StreetContent; renders via dynamicParams) |
| `15-side-road-side-road-milton` | added to `OFF_REGISTRY_STREETS` |

## Three things need a decision before merge

1. **Retire the 4 redirected `StreetContent` rows** (status -> unpublished). The redirect block's own comment says content is retired at the same merge; otherwise the sitemap keeps listing URLs that 301. That is a data write, so it was left alone.
2. **`api/content/v1/listings/recent`** — canonical or raw MLS?
3. **`RentalsClient.tsx`** — server-side prop.

## To unblock step 9

`VERCEL_TOKEN` in the environment, or `vercel login && vercel link` once — then the preview deploys and the battery plus the extended guard run against it.

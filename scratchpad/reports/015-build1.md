# DEC-NAME-SOURCE Build 1 — `feat/name-source` @ `2a88b59`, pushed. Not merged.

## 1. The resolver

`src/lib/streetName.ts`, pure — no `server-only`. `expandStreetName` / `shortNameFor` / `displayStreetName` moved here out from behind `street-data.ts`'s `import "server-only"` (the structural reason `build-street-adjacency.ts` had grown a private, drifting copy) and re-exported, so every existing importer is untouched.

```
resolveStreetName(slug, fallbackRaw?) -> { name, shortName, streetType, source }
  registry row by EXACT SLUG -> titleCaseOfficial(reg.name), shortName from reg.base, type reg.type
  OFF_REGISTRY_SET member    -> displayStreetName(expandStreetName(fallbackRaw), slug)   source "off-registry"
  no registry row            -> same legacy chain                                        source "fallback"
```

Verified behaviour:

```
kennedy-circle-milton        registry  "Kennedy Circle"       short="Kennedy"
kennedy-circle-east-milton   registry  "Kennedy Circle East"  short="Kennedy East"
kennedy-circle-west-milton   registry  "Kennedy Circle West"  short="Kennedy West"
buckthorn-garden-milton      registry  "Buckthorn Garden"     short="Buckthorn"    type=Garden
mcdougall-crossing-milton    registry  "McDougall Crossing"   short="McDougall"
second-line-milton           off-registry  "Second Line"      (also correct with NO raw supplied)
25-side-road-milton          off-registry  "25 Side Road"     (leading 25 preserved)
zzz-unknown-street-milton    fallback      "Zzz Unknown Street"   <- never a bare slug
```

## 2. `streetUtils.ts:71`

`Garden` and `bonus` removed from the junk alternation. That regex **deletes** the token rather than abbreviating it, so `expandStreetName` had nothing to restore — which is why all 10 registry GARDEN streets truncated while Heights and Trail round-tripped fine.

**30-name chain test: 30/30** (was 20/30). `MELVILLE BONUS CRESCENT` survives.

## 3. Surfaces wired

All routed through the resolver:

`street-data.ts` core chain + similar-streets · `streetMinimal.ts` · `neighbourhoodStreets.ts` · `buildHubInput.ts` (both projection sites) · `heroIndex.ts` · `homepageData.ts` · `api/autocomplete` · `streets/page.tsx` · `schools/[slug]` · `mosques/[slug]` · `listingsV2Data.ts` · `sync/vip-hubs` · `seo/act.ts` · `generateStreet.ts` · `build-street-adjacency.ts` · `sold-stats`

**Inherited rather than separately wired** — these read `data.street.name`, which is now resolver-sourced, so they needed no edit: `streetV2Data` hand-off, the H1, `<title>`, meta description, OG/twitter, breadcrumb, and every `street-schema.ts` JSON-LD node (`Place`, `BreadcrumbList`, `FAQPage`, `AggregateOffer`, `VideoObject`).

**Not routed, deliberately, with reasons:**

- `sitemap.ts:148` — selects `streetSlug` + `updatedAt` only. No name is read; nothing to route.
- `admin/review:27`, `sync/regenerate:30`, `api/admin/publish:32` — these read the **stored** `StreetContent.streetName` on purpose. Since `generateStreet` now writes it from the resolver on create *and* update, the stored value converges. Routing the read as well would hide drift from the reviewer, which is the opposite of what `/admin/review` is for. Annotated rather than changed.
- `api/content/v1/listings/recent:104` — a public API returning `r.streetName` straight off the `Listing` row. Left as raw MLS: changing a public contract is a product decision, not a naming fix. **Flagging for your call.**
- `RentalsClient.tsx:395-396,888,1024` — a client component with a local `streetOf`/`streetSlug` pair. Not routed: importing the resolver would pull the 944-row registry into the client bundle. Wants a server-side prop instead — Build 2.

## 4. Write side

- `sync/vip-hubs:73` wrote `sample?.streetName || slug` into the field `street-data` reads **first** — a bare slug could surface as an H1. Now resolver output.
- `generateStreet` — `streetName` added to the **update** branch. It was create-only, frozen at row birth; that is why `force-regenerate` could never repair a name (it re-derives every meta and FAQ string *from* the frozen wrong one).
- `seo/act.ts:103` queue write; `build-street-adjacency:128` uses the shared resolver (private `expandName` retired).
- `registry-entity-backfill:45` and `registry-cleanup-repair:35` now delegate to `titleCaseOfficial`, so they stop writing `Mcdougall Crossing` into the entity table.
- `scripts/fix-street-names.ts` **deleted** — running it re-truncated every Garden street.

## 5. Hub anti-fabrication

`assertNoFabricatedStreets` also accepts `legacyDisplayName`, supplied by `buildHubInput` as the pre-registry `expandStreetName(s.name)`. Without it, hub prose written against the old derivation would be reclassified as fabricated ("Main St E" is not "Main Street"). Widening an allowlist is safe one-directionally: it can admit a real street under a stale name, never invent one. Remove after Build 2.

## 6. sold-stats — the join was already dead

Measured against the live analytics DB:

```
buckthorn-garden-milton  stored "Buckthorn"    -> buckthorn-milton     analytics=0   Listing eq-join=1
                         resolver "Buckthorn Garden" -> buckthorn-garden-milton  analytics=1
main-street-milton       stored "Main St E"    -> main-st-e-milton     analytics=0   Listing eq-join=136
                         resolver "Main Street"      -> main-street-milton        analytics=1
costigan-road-milton     stored "Costigan Rd"  -> costigan-rd-milton   analytics=0   Listing eq-join=57
                         resolver "Costigan Road"    -> costigan-road-milton      analytics=1
```

The route's own comment claimed analytics stores the abbreviated MLS form. **It does not** — it stores the canonical slug. The primary join returned **zero rows for all three**; every request was silently paying for the `Listing`-equality fallback. Now resolves name → registry slug first, and the primary join returns 1 row for each.

## 7. The guard

Rewritten to assert against `MILTON_STREET_REGISTRY` itself. The previous version asserted a hand-written list and went **green on "Buckthorn"** — a guard whose expected values are typed by the same person who typed the bug is not a guard.

```
BRANCH: [street-name-repair] PASS — 944 registry slugs resolve to their official name,
        plus 26 override/artifact/neighbourhood cases.

MAIN:   [main] registry-sourced published slugs checked: 423
        [main] FAILURES against the Build-1 invariant: 15
          trafalgar-road    main derives 'Trafalgar Road West'  registry 'Trafalgar Road'
          buckthorn-garden  main derives 'Buckthorn'            registry 'Buckthorn Garden'
          kennedy-circle    main derives 'Kennedy Circle West'  registry 'Kennedy Circle'
          mccuaig-drive     main derives 'South McCuaig Drive'  registry 'McCuaig Drive'
          ... 11 more
```

Red on main is **exactly 15**, matching the 15 net defects measured independently in Gate A.

## 8. Gate B

**Build green, exit 0, 7 prebuild tests green.**

431-slug diff against the branch:

| | count |
|---|---|
| agree with registry | **423** |
| disagree | **0** |
| no registry row | **8** |
| by source | registry 423 · off-registry 3 · fallback 5 |

```
CASING 15 unchanged:   "Mackenzie Dr" -> "MacKenzie Drive"   "Mcdougall Crossing" -> "McDougall Crossing"
DIRECTIONAL 13 now registry: "Bronte St S" -> "Bronte Street"   "Crt St N" -> "Court Street"
GARDEN 2 now full:     "Buckthorn" -> "Buckthorn Garden"   "Sycamore" -> "Sycamore Garden"
```

423 agree = 431 − 8, as specified.

## Off-registry 5 — dispositions with evidence

Each checked against the registry **and** the Town centreline layer (`townRoadFacts.ts`):

| slug | disposition | evidence |
|---|---|---|
| `wood-close-n-a-milton` | **301 → `wood-close-milton`** | slug carries fossilised `N/A`; `WOOD CLOSE` is a registry row; target already published — a live duplicate |
| `first-line-nassagaweya-line-milton` | **301 → `first-line-nassagaweya-milton`** | trailing type word doubled; `FIRST LINE NASSAGAWEYA` is a registry row; target already published — a live duplicate |
| `clitherow-drive-milton` | **301 → `clitherow-street-milton`** | registry lists `CLITHEROW STREET` only; centreline layer has `clitherow||street` (5 segments) and **no** `clitherow||drive`; target published |
| `jarrett-cross-milton` | **301 → `jarrett-crossing-milton`** | registry lists `JARRETT CROSSING` only; `jarrett||crossing` appears in the centreline layer as a neighbour of `dalgleish||garden` and `duncan||lane`; same shape as the existing `mcdougall-cross` redirect. Target has **no StreetContent row** — renders via `dynamicParams`, absent from the sitemap |
| `15-side-road-side-road-milton` | **added to `OFF_REGISTRY_STREETS`** | rural Halton road, no registry row; its junk-stripped canonical `15-side-road-milton` is *itself* off-registry with no page, so a 301 would point at nothing |

None were set unpublished — all five resolved to a match or the allowlist.

## 9. Vercel

```
npx vercel whoami  ->  Vercel CLI 59.11.2 (Node.js 20.20.2)
                       > Logged out.
```

Still logged out, no `.vercel` project link, no `VERCEL_TOKEN`. **No preview deployed, battery not run against a preview.** Branch pushed, stopping as instructed.

To unblock: `VERCEL_TOKEN` in the environment, or run `vercel login && vercel link` once yourself — then I can deploy and run `BASE=<preview> node scripts/verify/run.mjs` plus the extended guard.

## Needs your decision before merge

1. **Retire the 4 redirected `StreetContent` rows** (status → unpublished). The existing redirect block's own comment says entities and content are retired at the same merge; otherwise the sitemap keeps listing URLs that 301. That is a data write, so I left it.
2. **`api/content/v1/listings/recent`** — public API still emits raw MLS `streetName`. Canonical or raw?
3. **`RentalsClient.tsx`** — needs a server-side prop rather than a client-side registry import.

Not done, per step 10: no content regeneration, no adjacency re-run, `faqJson` and `description` untouched.

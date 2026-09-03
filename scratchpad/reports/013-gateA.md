# GATE A — registry as naming authority. Recon only, no code written, tree clean.

## 1. The name fields

`src/data/miltonStreetRegistry.ts` — `RegistryStreet { name, base, type, slug }`, 944 rows, auto-generated from the Town PDF (`REGISTRY_VERSION = "2026-05-21"`).

- **official name** = `name`, ALL CAPS (`"ABBOTT STREET"`)
- **directional** — no separate field. Directionals are *separate registry rows*:
  `KENNEDY CIRCLE` / `KENNEDY CIRCLE EAST` (base `"kennedy east"`) / `KENNEDY CIRCLE WEST`.
  `MAIN STREET`, `BRONTE STREET`, `TRAFALGAR ROAD` exist with **no** directional row at all.
- `base` (`"buckthorn"`) is the natural authority for shortName — **read by nothing today**.
- `type` is already used correctly at `streetMinimal.ts:78`.

DB copies are unreliable: `ResidentialStreet.name` disagrees with the registry on **626 of 944**; `shortName` is **0% populated** (all 963 rows null). `registry-entity-backfill.ts:108` skips rows that already exist, so MLS-seeded rows were never corrected.

**Correction to the brief's premise:** `street-data.ts` does not "prefer streetContent.streetName over the registry" — **it never imports the registry at all.** The chain at `:347-351` is `ruralSideRoadName(slug) ?? streetContent?.streetName ?? sample?.streetName ?? extractStreetName(...)`. There is no registry term to lose to. This is an insertion, not a reordering.

## 2. The surface map

Full table in `scratchpad/recon.txt` section 2. Structure:

**One hand-off.** `street-data.ts:484` sets `StreetPageData.street.name`; `streetV2Data.ts:183` prop-drills it into the whole v2 tree. Everything reading `data.street.name` resolves there.

**Render surfaces off that single value:** H1 (`sections.tsx:94`), `<title>` + OG title (`streets/[slug]/page.tsx:91`), meta description + og/twitter description (`:94`), visible breadcrumb (`sections.tsx:91`), video H2 (`:146`), sidebar + seller CTA prose (`:203,657`), placeholder prose (`:263`), sold-records caption and gated CTA (`:443`), **outbound lead payload to kvcore/email** (`:663`).

**JSON-LD** — `schema/street-schema.ts`: `Place.name`, `BreadcrumbList` last crumb, `FAQPage` question strings, `AggregateOffer`, `VideoObject`.

**Independent chains that do NOT go through that value** (each needs the resolver separately):
`streetMinimal.ts:71,72,103` (incl. the "Official name" row) · `neighbourhoodStreets.ts:57` · `buildHubInput.ts:289,290,420,421` · `heroIndex.ts:33,71,76` · `homepageData.ts:104` · `api/autocomplete/route.ts:32` · `streets/page.tsx:104` · `street-data.ts:1640` (similar streets) · `schools/[slug]/page.tsx:106` · `mosques/[slug]/page.tsx:108` · `listingsV2Data.ts:327` · `RentalsClient.tsx:395-396,888,1024` · `api/content/v1/listings/recent/route.ts:104`

**The five named read paths, confirmed present:** `sitemap.ts:148` · `streets/page.tsx:86` · `admin/review/page.tsx:16,27` · `sync/regenerate/route.ts:30` · `sync/vip-hubs/route.ts:73,75`. Plus two DUALWRITE appears not to have counted: `api/admin/publish/route.ts:32` and `scripts/build-street-adjacency.ts:111`.

**WRITE side — the part that matters most.** Three crons re-mint truncated names nightly. Any render-only fix is overwritten within 24h:
- `vow-sync.ts:391` — `extractStreetName(address)` into `Listing.streetName`
- `api/sync/detect/route.ts:239` (cron 0 10 * * *) into `Listing.streetName` into `StreetQueue.streetName` (`:357-380`)
- `api/sync/vip-hubs/route.ts:73` (cron 0 13 * * *) — writes `sample?.streetName || slug` into `StreetContent.streetName`. **A bare slug can land in the field that outranks everything at render.**

## 3. The Garden truncation

Both routines live in `extractStreetName()` (`streetUtils.ts:15`), on the display path at `street-data.ts:351` **and at ingest**.

- **Step 7 abbreviation map** (`:47-63`) shortens 15 types — harmless, `expandStreetName` reverses it.
- **Step 8 junk regex** (`:71`) contains the literal `Garden` among unit descriptors (`Basement|Bsmt|Lower|Upper|Main|Suite|Garden|N/A|Apt|bonus|Parking`). It **deletes** the token, so nothing survives for `expandStreetName` to restore. `Gardens` (plural) is absent — only the singular type is destroyed.

Executed full-chain test, 30 names: **20/20 non-garden types pass** (Gate, Path, Landing, Heights, Point, Trail, Centre, Common, Street, Crescent, Court, Road, Circle, Boulevard). **10/10 gardens fail.**

**Answer: exactly one type is exposed — `garden`.** No other legitimate Milton type is in that alternation. `bonus` is worth reconsidering too — it costs `MELVILLE BONUS CRESCENT`.

The corrected allowlist you remembered is `IDENTITY_SUFFIX_TOKENS` (`streetUtils.ts:162`), whose comment records "Landing/crossing/garden/path ... previously unrecognized". That fix landed; `:71` never got it.

**Only 3 of the 10 registry gardens are published**, and they disagree with each other:

```
buckthorn-garden   RS "Buckthorn"           SC "Buckthorn"        both truncated
french-garden      RS "French Garden"       SC "French Garden"    both CORRECT
sycamore-garden    RS "Sycamore Gardens E"  SC "Sycamore"         stores contradict
```

Live divergence is **2 pages, not 10**.

## 4. The diff — 431 published slugs, 431 fetched from prod, 0 failures

| | count |
|---|---|
| agree with registry | **393** |
| disagree | **30** |
| no registry row | **8** |

**directional-added — 13.** `bronte-street`, `burnhamthorpe-road`, `campbell-avenue`, `court-street`, `croft-avenue`, `kennedy-circle`, `main-street`, `mccuaig-drive`, `ontario-street`, `parkway-drive`, `philbrook-drive`, `thompson-road`, `trafalgar-road`. On **`campbell-avenue` (E vs W)** and **`ontario-street` (N vs S)** the two stores disagree on *which* directional — whichever surface you read decides the answer.

**truncated-suffix — 2.** `buckthorn-garden` renders "Buckthorn", `sycamore-garden` renders "Sycamore".

**other-street's-name — 0.** No published page renders a different street's name. **This corrects my earlier report:** `kennedy-circle-milton` renders "Kennedy Circle West", which is a *directional the registry does not carry*, not another street's row. My earlier framing was wrong.

**casing-only — 15**, and here **the site is right and the registry cannot adjudicate**: `mcdougall-crossing`, `mclaughlin-avenue`, `mackenzie-drive` plus 12 more. Production renders `McDougall Crossing` correctly via `displayStreetName`. The registry's ALL-CAPS form has destroyed the intra-word casing.

**Net real defects: 15** (13 directional + 2 truncated).

**no-registry-row — 8.** On the allowlist: `second-line`, `nipissing-road`, `25-side-road`. **On neither list — 5:** `15-side-road-side-road`, `clitherow-drive`, `first-line-nassagaweya-line`, `jarrett-cross`, `wood-close-n-a`. All 8 render acceptably today only because `displayStreetName`'s DOUBLED rules repair the fossilised junk in their slugs.

**Context: the street page is the best surface, not the worst.** It agrees 393/431 (91%). The `/streets` index that links to it disagrees on **363 of 410 (89%)** — `Sorensen Crt`, `Nadalin Hts`, `Main St E`.

## 5. The proposal

**A pure module `src/lib/streetName.ts`** (no `server-only`, so scripts can import it):

```
resolveStreetName(slug, fallbackRawName?) -> { name, shortName, streetType, source }
  1. registry row by EXACT SLUG  -> titleCaseOfficial(reg.name), shortName from reg.base, type reg.type
  2. OFF_REGISTRY_SET member     -> displayStreetName(expandStreetName(fallback), slug)
  3. no registry row             -> displayStreetName(expandStreetName(fallback), slug)   [today's chain]
```

**Slug-keyed is a correctness requirement, not a preference.** Measured: `canonicalizeResidential("KENNEDY CIRCLE")` returns **`KENNEDY CIRCLE WEST`** — `toks()` pops directionals before matching, so all three Kennedy rows collide and the last written wins. Resolving by *name* reproduces the exact defect the change exists to fix.

**Casing is the trap.** `titleCase("MCDOUGALL CROSSING")` gives `"Mcdougall Crossing"`. Shipping naive title-casing **regresses 15 currently-correct pages**. Required composition:

```
titleCaseOfficial(reg.name) = applyMcMacO(naiveTitleCase(reg.name))
```

Order matters — the Mc rule needs a lowercase letter after `Mc`, so it must run *after* title-casing. `registry-entity-backfill.ts:45` and `registry-cleanup-repair.ts:35` need the same fix or they propagate broken casing into the entity table.

**shortName is the weakest link and drives more visible headings than `name` does** — about 14 strings in `sections.tsx`, 8 of them H2s. `shortNameFor` omits 9 of 27 types. `RegistryStreet.base` is the ready-made authority and is read by nothing.

**DEC-PH41-DUALWRITE: `StreetContent.streetName` becomes DERIVED, and this does not violate it.** The comment locks the *existence of a StreetContent row* for the non-renderer surfaces; it says nothing about `streetName` and never designates it authoritative. Stronger evidence from the code: **`streetName` is already not dual-written** — `generateStreet.ts:579` includes it in `create` and `:595-609` **omits it from `update`**. A regeneration rewrites description, metaTitle, metaDescription, faqJson, statsJson, status, publishedAt — and leaves the name frozen at row birth. A field the locked path never updates cannot be what the lock protects. It is also why `force-regenerate` cannot repair a name: it re-derives every meta and FAQ string *from* the frozen wrong one.

Real constraints DUALWRITE does impose: do not drop the column or stop writing the row (4 live consumers SELECT it); `StreetContent` stays the publish gate; **write it from the resolver and add it to the `update` branch so it self-heals.**

**Write-side changes, or every fix is overwritten within 24h:** `streetUtils.ts:71` (remove `Garden`), `sync/vip-hubs/route.ts:73,75`, `generateStreet.ts:595-609`, `seo/act.ts:103,114`, `build-street-adjacency.ts:128` (plus re-run — the 1046 rows are frozen), `registry-entity-backfill.ts:45`, and retire `scripts/fix-street-names.ts` (running it today re-truncates every Garden street).

**Frozen data code cannot touch:** `StreetContent.faqJson` (contains "What is the typical price on **Buckthorn**?"), `StreetContent.description`, `StreetAdjacency.connectedName`. These need regeneration.

**Guard:** `scripts/test-street-name-repair.ts` is already in prebuild and **would go green on "Buckthorn"**. Extend it to assert against `MILTON_STREET_REGISTRY` rather than a hand-written list.

## 6. Risks

**The 13 directional pages need a product decision before code.** The registry says `MAIN STREET`; the Town has no `MAIN STREET EAST` row — but Milton addresses plainly use "Main Street East". Renaming those H1s to the undirectional form is a **user-facing regression risk, not obviously a fix**. `vow-sync.ts:409-413` splits `StreetDirPrefix`/`StreetDirSuffix` into a separate `street_direction` column — the directional is real data being discarded. On `campbell-avenue` and `ontario-street` the stores disagree on which direction, so the current page may already be wrong in a way the registry cannot resolve.

**Registry staleness.** Auto-generated from a Town PDF, stale by construction — a new subdivision's streets carry listings before the Town republishes. Today they render from MLS; after the change they fall to the fallback. Keep the resolver's `source` field and surface it in `/admin/review` as raw-vs-registry side by side; never let a registry miss produce a bare slug.

**The 3 allowlist streets are safe only if written for.** `canonicalizeResidential.ts:65` returns `canonicalName: null` for them. A resolver treating null as "no name" instead of "pass through" breaks all three. `25 Side Road` specifically depends on `displayStreetName`'s HOUSENUM rule not stripping the leading `25`.

**Does any slug map to a contradicting registry name? No — 0 of 944.** `slugify(name) === slug` for every row, so slug-keyed lookup cannot introduce a contradiction; it can only fail to cover a slug. The risk is inverted from what you might expect.

**Non-naming breakage to check before any backfill:**
- `api/sold-stats/route.ts:77-81` does an **equality join** on `Listing.streetName`. Its caller already passes the full-word entity name, so it is likely already broken; a rewrite must fix the join key, not just the label.
- `ai/hub/projectHubEntities.ts:136-138` builds its anti-fabrication allowlist from `displayName`/`shortName`. Change the names and existing hub prose is re-classified as **fabricated** at the next regeneration.
- DB1 carries plural slug families with no registry and no entity row: `burgess-gardens`, `dalgleish-gardens`, `sumac-gardens`, `sycamore-gardens`, `french-gardens`. Slug-keyed lookup cannot repair these — they need slug canonicalisation first.

## 7. Vercel — step 6

```
npx vercel whoami  ->  "Logged out."
```

No auth, no `.vercel` project link. Not attempting interactive login, per instruction.

---

**Stopped. No code, no commits, tree clean.** Two decisions needed before implementation: the 13 directional pages (product call), and whether the 5 unallowlisted no-registry slugs get added to `OFF_REGISTRY_STREETS` or stay on the fallback.

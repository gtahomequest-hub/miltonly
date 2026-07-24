# Town of Milton street-registry refresh

The registry (`src/data/miltonStreetRegistry.ts`) is the canonical validation source for
street identity. It is version-stamped (`REGISTRY_VERSION`) and refreshed when the Town
republishes its "Existing Street Names" list.

## When the Town republishes

1. **Drop the new PDF** in `src/data/` (e.g. `milton-street-registry-2026-11-xx.pdf`); keep the
   old one for history.
2. **Extract + regenerate**: run `scripts/gen-street-registry.mjs` against the new PDF. It
   parses `name / base / type / slug` and rewrites `miltonStreetRegistry.ts`. Bump
   `REGISTRY_VERSION` to the new publish date.
3. **Diff** the new vs prior registry and review:
   - **Added** streets — new official streets (new subdivisions). These clear matching rows
     from the `StreetSlugReview` queue automatically (they now canonicalize/match).
   - **Removed** streets — rare; investigate before dropping anything.
   - **Retyped** streets — a street whose official TYPE changed (e.g. Avenue → Road). May shift
     a canonical slug; check for any published page on the old slug and add a 301 if so.
4. **Regenerate the canonical maps** (the middleware variant→canonical guard reads the universe):
   `TSX_TSCONFIG_PATH=./tsconfig.test.json npx tsx scripts/generate-canonical-map.ts`
   (emits `canonical-map.json`, `valid-canonical-slugs.json`, `no-redirect-slugs.json`).
5. **Off-registry allowlist** (`src/data/offRegistryStreets.ts`): if a queued slug is a real
   Region/rural road the Town doesn't administer (Side Road, rural Line), add it here rather
   than to the registry — it then passes sync validation without being flagged.
6. **Backfill** entities for genuinely-new official streets if desired
   (`scripts/registry-entity-backfill.ts`), publication gated as before.

## Sync-time validation (Step 5)

`vow-sync` (`runSoldSync`) validates every minted `street_slug` via `canonicalizeResidential`:
- **matched** to the registry → proceeds.
- on the **off-registry allowlist** → proceeds.
- **neither** → upserted to `StreetSlugReview` (fail-loud, mirrors `UnmappedNeighbourhoodString`);
  NO page is auto-created. Review at `/admin/review` (bottom section). Resolve by adding the
  street to the registry (real new street) or dismissing (junk/unit leak), same as the
  neighbourhood queue.

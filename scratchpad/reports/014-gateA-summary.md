Full report at `scratchpad/gateA.md`; the raw recon is at `scratchpad/recon.txt`.

**No code written, no commits, tree clean.**

The five things that most change the shape of the work:

**The root-cause premise understates it.** `street-data.ts` does not *prefer* `streetContent.streetName` over the registry — it **never imports the registry at all**. The chain is `ruralSideRoadName ?? streetContent?.streetName ?? sample?.streetName ?? extractStreetName(...)`. This is an insertion, not a reordering.

**One earlier claim was wrong and is retracted.** `kennedy-circle-milton` is *not* publishing another street's name — it is adding a directional the registry does not carry. Measured across all 431: **`other-street's-name` = 0.**

**The diff is smaller than feared and differently shaped.** 393 agree, 30 disagree, 8 have no registry row. But 15 of the 30 are **casing-only, where the site is right and the registry cannot adjudicate** — the ALL-CAPS source destroyed the intra-word casing, so `McDougall` exists only because `displayStreetName` reconstructs it. **Net real defects: 15** (13 directional + 2 truncated Gardens).

**Naive title-casing would regress those 15 pages.** `titleCase("MCDOUGALL CROSSING")` gives `"Mcdougall Crossing"`. The registry name must be *composed with* the existing Mc/Mac/O' rule, in that order, not substituted for it.

**Render-only fixes get overwritten within 24 hours.** Three crons re-mint names nightly, and `sync/vip-hubs/route.ts:73` writes `sample?.streetName || slug` into the field that outranks everything — a bare slug can become an H1.

On DUALWRITE: making `streetName` derived does not violate it. The decision locks the *row's existence* for five non-renderer surfaces. And `streetName` is **already not dual-written** — `generateStreet.ts:579` writes it on `create` and `:595-609` omits it from `update`, so it is frozen at row birth. That is also why `force-regenerate` cannot repair a name: it re-derives every meta and FAQ string *from* the frozen wrong one.

## Two decisions before any code

1. **The 13 directional pages.** The registry has no `MAIN STREET EAST` row, but Milton addresses genuinely use it — and `vow-sync.ts:409-413` splits the directional into its own column, so it is real data being discarded. Renaming those H1s may be a regression, not a fix. Worse, `campbell-avenue` and `ontario-street` have stores that disagree on *which* direction, so those may already be wrong in a way the registry cannot settle.

2. **The 5 unallowlisted no-registry slugs** — `jarrett-cross`, `wood-close-n-a`, `15-side-road-side-road`, `first-line-nassagaweya-line`, `clitherow-drive`. Add to `OFF_REGISTRY_STREETS`, or leave on the fallback? `clitherow-drive` looks like a genuine Town omission worth reporting upstream.

## Gate A results at a glance

| step | result |
|---|---|
| 1. name fields | registry `name` ALL CAPS; no directional field — directionals are separate rows |
| 2. surface map | one hand-off (`street-data.ts:484`) + 13 independent chains + 3 nightly write crons |
| 3. Garden | `streetUtils.ts:71` junk regex deletes the token; exactly 1 type exposed, 2 live pages |
| 4. diff | 431 fetched, 393 agree, 30 disagree, 8 no registry row; net real defects 15 |
| 5. proposal | pure `src/lib/streetName.ts`, slug-keyed, registry-first, composed with Mc/Mac/O' casing |
| 6. vercel | `Logged out.` — no auth, no project link; stopped as instructed |

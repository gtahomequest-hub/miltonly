# Handoff — content worktree

CONTENT · D:\miltonly-content · feat/content

_Last rewritten 2026-09-10, after Gate A recon for the content tier._

## READ THIS FIRST

**This worktree owns the guides and everyday-life tier, and the Market Watch
weekly edition.** Its own tables, its own routes, generation through
`src/lib/ai/compliance.ts` under the cheap-first rule. **It never writes
`StreetContent`, `HubContent` or `CondoContent` rows, never touches the header,
footer or homepage.** Read the root `HANDOFF.md` for the state of those tiers; it
is the authority on everything outside this scope.

**Gate A is reported and NOT approved. No code has been written.** The report is
`scratchpad/reports/062-content-gate-a.md`.

## State

| | |
|---|---|
| branch | `feat/content`, clean, at `794f96e` |
| code written this worktree | **none** |
| guides route | does not exist |
| Market Watch | does not exist anywhere in the repo |
| content tables | none |

## What Gate A found

**The guides layout is finished and unwired.** `src/components/guides/` carries
`types.ts` (which names itself "THE SEAM"), 8 sections, a 536-line theme on the
project tokens, and mock data. The data window it asks for —
`getGuidesIndexData()` and `getGuideArticle(slug)` — does not exist, there is no
`/guides` or `/guides/[slug]`, and nothing is in the sitemap. Only
`/guides-preview` and `/guide-preview`, both noindex, both on fixtures.

**`GuideCategoryKey` already carries `living`.** The everyday-life tier has its
slot in the type.

**`mockData.ts` carries 16 em-dashes.** The voice rule bans them. Do not let the
mock's register reach real data.

**Market Watch is absent.** Zero hits across `src`, `scripts`, `prisma`, `docs`.
A new surface end to end, layout included.

**Four live indexable pages already own three of the target queries.** `/sold`
owns "sold prices milton", `/condos-guide` owns "condos in milton", `/schools`
plus 31 school pages own "schools". A guide on any of them must answer a
different question and link up, or not be built. The map is in section 1.4 of the
report.

**The build cost is the validators, not the prose.** Every rule in
`validateStreetGeneration.ts` is typed on `StreetGeneratorInput` and reads
`input.aggregates`, `input.quarterlyTrend`, `input.crossStreets`. None of them can
validate a guide or an edition until that content carries a grounding input of the
same shape. The text-only rules — sales-register leak, fair-housing register,
mixed-pool, spatial precision, future period, template parrot, catchment
vocabulary, the em-dash ban — transfer unchanged.

**Cheap-first is already the default.** `resolveSimpleMode()` returns `deepseek`
for anything unset. A new generator inherits it by doing nothing.

**`assertPromptSafe` sits inside `callClaude` and `callDeepSeek`.** The choke is
at the transport, so a new caller inherits it without a new call site.

**A week is a small sample and that is the whole Market Watch design problem.**
Milton runs roughly 10 to 15 sales a week town-wide, so most neighbourhoods and
most property types are sub-k every single week. The proposal publishes weekly
counts always, a weekly median only at n>=5, a weekly band only at n>=10, and
**no neighbourhood-weekly or type-weekly median at any n** — the 12-month figure
sits beside the weekly count instead, each labelled with its window. `kAnon.ts`'s
own header is the reason: the floor must be checked against the exact sample the
figure is computed over.

**GSC is live and readable.** `src/lib/seo/gscClient.ts`, service account,
`webmasters.readonly`, weekly `runSense()` into `SeoOpportunity` with
week-over-week `prev*` columns. The eight guide queries can be pinned to real
impressions and position before a line is written. **Those rows were not queried
this pass.**

## Decisions needed before any code

1. `MarketEdition` plus `MarketEditionGeneration` tables, or compute at request
   time? Recommend the table — the edition is the artifact, not metadata.
2. Guides generated, or hand-authored structure with generated figures?
   Recommend the latter; it avoids porting 30-plus street-typed validators for six
   pages.
3. The grounding-input shape for the edition's one generated paragraph.
4. A k ruling for a per-building condo fee. `kAnon.ts` has no threshold for a
   population of one building.
5. A mortgage rate source. There is none in the repo, and the first-time-buyer
   guide is arithmetic on top of one.
6. Whether the schools guide ships under the catchment ban's framing, or not at
   all.
7. Up-links from hubs and streets back to the current edition. **A cross-worktree
   request — this worktree does not make those writes.**
8. Pull the real GSC rows for the eight queries before fixing the order.

## Next expected task

**Approval of Gate A**, then build scope. Nothing else. Do not self-start.

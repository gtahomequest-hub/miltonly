# Handoff — content worktree

CONTENT · D:\miltonly-content · feat/content

_Last rewritten 2026-09-10, after Gate A recon for the content tier and the volume addendum._

## READ THIS FIRST

**This worktree owns the guides and everyday-life tier, and the Market Watch
weekly edition.** Its own tables, its own routes, generation through
`src/lib/ai/compliance.ts` under the cheap-first rule. **It never writes
`StreetContent`, `HubContent` or `CondoContent` rows, never touches the header,
footer or homepage.** Read the root `HANDOFF.md` for the state of those tiers; it
is the authority on everything outside this scope.

**Gate A is reported and NOT approved. No code has been written.** The report is
`scratchpad/reports/062-content-gate-a.md`, and
`scratchpad/reports/063-content-gate-a.md` is an addendum that corrects one premise
in its section 3.2 and adds the measurement behind it. **Read 062 first. 063 does
not replace it.** Two sessions ran this recon in parallel on this branch; 062
landed first and its guide list, risk calls and section design stand.

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
The proposal publishes weekly counts always, and **no neighbourhood-weekly or
type-weekly median at any n** — the 12-month figure sits beside the weekly count
instead, each labelled with its window. `kAnon.ts`'s own header is the reason: the
floor must be checked against the exact sample the figure is computed over.

**The town-wide week is NOT a small sample, and report 062 said it was.** Measured
2026-09-10 on complete Monday weeks, `perm_advertise = TRUE`, For Sale: **40, 43,
37, 33** over the last four, and **26 to 67** over the last twelve. Not the 10 to
15 the report estimated. `days_on_market` and `list_price` are populated on 100% of
those rows. **So the weekly typical clears k5 and k10 in every complete week
measured and can carry the edition rather than sit as a footnote**, with the check
still made per edition and a thin week publishing `null`, never `0`. Detail in
report 063.

**A trailing 28-day window is the by-form answer, and neither report had it
before.** By form over 28 days: detached 71, townhouse 37, condo 14, semi 13. So a
point for all four at k5 and a band for detached and townhouse at k10. The same
28-day window by neighbourhood clears k5 on only 11 of 21 and k10 on 6, which is
why the neighbourhood block stays on the 12-month figure.

**The lease side gets no weekly figure at all.** Weekly lease counts read 130, 6,
4, 51, 14, 15, 127, 5, 20, 3, 23. That is ingest stamping, not a market, and it is
the visible form of the caveat `daily-summary/route.ts` already carries: the lease
buckets have no close date and proxy on `updatedAt`. Lease is out of v1.

**DEC-SOLD-UPPER-BOUND is not theoretical. `sold.sold_records` holds 192 For Sale
and 53 For Lease rows dated in the future**, the furthest at 2027-01-29 against a
database `NOW()` of 2026-09-10. An unbounded 28-day neighbourhood count returns
**327** rows where the bounded one returns **135**. A window that forgets
`sold_date <= NOW()` does not fail, it publishes a number inflated 2.4x and
publishes sales that have not happened. Every new window in this tier inherits the
bound.

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
9. **The weekly typical becomes the edition's headline figure**, computed on the
   week and gated on the week's own n. Report 062 assumed it would usually
   suppress; the measurement says it does not. Confirm the swap.
10. **A by-form block on a trailing 28-day window** — point at k5 for four forms,
    band at k10 for detached and townhouse only. A new section, not in 062.

## Next expected task

**Approval of Gate A**, then build scope. Nothing else. Do not self-start.

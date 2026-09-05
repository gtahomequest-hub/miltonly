# Handoff

_Last rewritten 2026-09-05._

## READ THIS FIRST

**Pages generated before 2026-09-04 can be serving invented prices.** `first-line-milton` was
found this session stating "comparable homes trade around $1.5M" against an input carrying no
price at any grain. It predates DEC-GROUNDING-ZERO, so nothing ever checked it. Regenerated and
clean now, but **the rest of that population has not been swept**.

`scripts/audit-figure-grounding.ts <slug ...>` is the tool and exits non-zero on any ungrounded
figure. Running it across the published corpus is the highest-value next task and needs no
approval to *measure*, only to act on what it finds.

Two decisions still waiting, unchanged:

1. **Seven clips are live with `blur_verified: false`**, all from the 2026-09-03 run.
2. **Two clips remain orphaned** under slugs that are not real streets, and the GPS evidence does
   not identify them.

## Where things stand

| | |
|---|---|
| `main` | see `git log`; last code change is the thin-tier grounding fix |
| production | serving `main`, confirmed via `/api/build` |
| battery | **`PASS · 9 checks · 443 pages · 71s`**, exit 0, on production at `EXPECT_SHA=80f1324` |
| local build | exit 0, zero `P2024`, **12/12 prebuild** |
| published street pages | **444** (`lower-base-line-milton` added since the battery ran) |
| R2 | 90 objects; 2 orphans deleted, 2 copied to `first-line-milton` |
| rows carrying a clip | 42 |
| dashcam pipeline | `staged/` empty, `published/` 45, manifest rebuilt |
| QUEUE | 1, 2 (extended twice) done; 3 **Gate A reported, awaiting approval**; 4, 5 not started |

Detail: `scratchpad/reports/057-closeout-gps-match.md`.

## What happened 2026-09-05

**Battery on production: PASS, 9 checks, 443 pages, exit 0**, SHA gate green.

**Three mis-slugged clips matched against Town geometry.** Method: attribute each GPS segment to
the registry street whose nearest municipal address point is within 45 m, and sum. 882 of 944
registry streets have address points. Its limit decided two of the three: arterials and rural
concession roads have almost no fronting address points, so the Town neighbourhood polygon and
the centroid distances were read alongside.

- **`1st-line` -> `first-line-milton`, confirmed.** 233 m overlap, the only street matched
  anywhere on the trace, and the trace **ends 19 m from the centroid** of what is a
  single-segment street. Copied, wired to `nightVideoUrl`, revalidated, **confirmed serving on
  production, and only then the orphans deleted**. `published/1st-line` renamed to
  `published/first-line`.
- **`bronte-street-south`: not Bronte Street, and unidentified.** The trace sits in the Walker
  polygon; Bronte Street is 2.5 km away with zero overlap. Best candidates are
  `etheridge-avenue` (63 m) and `holbrook-court` (49 m) over a 371 m trace at 35% attribution,
  which is not an identification. `etheridge-avenue-milton` **already carries its own clip**, so
  a wrong guess would overwrite correct video with another street's footage. Not re-keyed.
- **`lower-base-line-west`: not Lower Base Line, and unidentified.** Both apparent matches have
  centroids about **6 km** from the trace, so the address points they hit are far-end outliers on
  long rural roads, not proximity. Not re-keyed.

Both unresolved clips now carry `match_status: "unmatched"` and a `match_note` in their
`meta.json` so the next pass does not re-run them blind.

**`lower-base-line-milton` generated** on its own merits: it passes the gate, is a registry
street with an entity, and had no page. 3 attempts, **$0.009**, judge PASS, 919 words, 3 dollar
figures all grounded. Published and revalidated. **No video wired** — the clip staged under
`lower-base-line-west` is not this street on the evidence.

**`first-line-milton` regenerated** after the audit found its invented `$1.5M`. The new rules
fired on retry (`zero_tier_price` on both a FAQ `$1.1M` and a section `$850,000`) and it passed
on attempt 3, **$0.009**. The page now carries **no dollar figure at all**, correct for a street
with no price in its payload. Video survived the regeneration and is confirmed serving.

## Open items

1. **Sweep the pre-2026-09-04 corpus for ungrounded figures.** See the top of this file. The one
   page checked at random was defective.
2. **Seven live clips carry `blur_verified: false`** (`chretien-street`, `clifford-point`,
   `frost-court`, `heaven-crescent`, `mulroney-heights`, `shade-lane`, `tasker-court`).
   `chretien-street`'s current clip is a signed 2026-09-02 capture, so that row is stale in its
   favour; the other six are unchanged. Decision: verify or pull.
3. **Two orphaned clips**, above. They need someone who can watch the footage and name the
   street; GPS has been taken as far as it goes.
4. **`makeStreetDecision`'s minimum-data gate** still requires a DB1 listing, so the cron returns
   `skip_low_data` for the streets the sixth gate source admits. Manual generation works,
   automated refresh does not.
5. **Grounding is enforced on zero and thin, dollars only.** Counts, percentages, days and
   quarter labels remain market-scoped on every tier. That is where this class of defect surfaces
   next.
6. **The name guard has a blind spot**: it asserts a file *imports* the resolver, not that every
   consumer inside it uses the resolved value.
7. `burnhamthorpe-road-milton` and `louis-st-laurent-avenue-milton` are entity-real with no data
   behind them.
8. `heroSearch.ts` resolves 5 slugs to physically different streets; needs an ambiguity guard.
9. Condo H1s still render abbreviations such as `Nadalin Hts`. QUEUE item 4.
10. Stored `HubContent.metaDescription` drifts from live on 21 of 22 hubs. Cleanup.
11. Rent pill disagrees with the market card on `melville-bonus-crescent-milton` and
    `mcdougall-crossing-milton`.
12. `video.miltonly.com` still unattached. `r2.dev` is rate-limited and not intended for
    production traffic at volume, and the bucket is 257.6 MiB across 40 live pages.
13. Two draft rows carry a clip: `diefenbaker-street-milton`, `murlock-heights-milton`.
14. The battery has not been re-run since the sitemap moved 443 to 444.

## Next expected task

The corpus grounding sweep (item 1), a decision on items 2 or 3, or QUEUE item 3 build scope once
Gate A is approved. Do not self-start any of them.

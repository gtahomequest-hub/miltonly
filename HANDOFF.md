# Handoff

_Last rewritten 2026-09-04._

## READ THIS FIRST

**Seven clips are live in R2 and on production street pages with `blur_verified: false`.**
That is a decision waiting for Aamir, not a bug to fix. Detail in
`scratchpad/reports/055-r2-upload-32.md`. No unverified byte was uploaded in this
session's run.

## Where things stand

| | |
|---|---|
| `main` | `d032f13`; the code change is `11f877b` `feat(video): upload 32 signed clips to R2, and teach the poster about night` |
| merge | `243cee5` `Merge branch 'fix/zero-sales-tier'`, no-ff |
| production | Ready on `d032f13`, confirmed via `/api/build` |
| battery | `PASS · 9 checks · 434 pages`, exit 0, run twice on **production**: at `EXPECT_SHA=243cee5` after the merge and at `d032f13` after the upload run |
| local build | exit 0, 533 pages, zero `P2024`, **12/12 prebuild** |
| published street pages | 434 |
| R2 | **78 objects, 213.6 MiB** (was 18, 35.8 MiB) |
| `StreetContent` rows carrying a clip | **28** — 25 day, 3 night |
| dashcam pipeline | `staged/` empty, `published/` 39, manifest rebuilt |
| QUEUE | 1, 2 (extended) done; 3 **Gate A reported, awaiting approval**; 4, 5 not started |

## What shipped 2026-09-04

**`243cee5`, the merge.** DEC-ZERO-SALES-TIER (DB2 record existence as a sixth
activity-gate source), DEC-GROUNDING-ZERO (`zero_tier_price`, plus band-aware tier
grounding and actionable rejections), DEC-ZERO-CONTEXT (the neighbourhood's own k-gated
typical on zero-tier pages, from the hub's `saleAggQuery` + `assembleAggregates`), and
the street name resolved at generator entry. Reports `053` and `053b`.

**`11f877b`, the upload run.** 32 signed clips and their posters to R2.

- The upload script now reads `D:/dashcam/manifest.json` plus `staged/<slug>/meta.json`
  instead of a hardcoded nine-slug list and a `clips.csv` under `work/`. Candidates are
  `status: staged` **and** `blur_verified: true`; anything else is refused and reported.
  Zero refusals, because all 32 were signed. `meta.json` is the per-clip authority and
  the manifest an index over it.
- **The manifest's `r2_key` omits the `-milton` suffix** that every live object and every
  `StreetContent` slug carries. Following it literally would have created a second,
  orphaned copy of every asset beside the live one. The scripts use the live layout and
  write the real key back; four stale published rows were corrected at source.
- `lemieux-court` and `locker-place` **replaced** their objects and pointers with newer
  captures (2026-08-27 to 2026-09-01).
- Three night captures re-keyed off the day key: `chretien-street`, `clifford-point`,
  `frost-court`. Copy, repoint, then delete, in that order, with the copy size checked
  against the source first.
- `staged/` emptied to `published/`, every `meta.json` stamped with its real key and
  `uploaded_at`, `manifest.json` rebuilt **from the directories**.

### `deriveVideoPoster` rewrote `/day.mp4` only

Caught while planning the re-key and **verified live on production first**:
`frost-court-milton` served `night.webp` as its poster, a key that has never existed, and
shipped a **VideoObject with a 404 thumbnail** rather than omitting it — worse, because it
looks valid to a crawler. Both variants share one `poster.webp` per street, which is now
what the function says. `scripts/test-video-poster.ts`, 11 assertions, red then green,
12th prebuild test.

**A TLS drop killed the first write run after ten streets**, the third time this bucket
has done that. The HEAD-size idempotency held and the resume finished cleanly.

## 11 slugs uploaded with no `StreetContent` row

Assets are in R2 and ready; these are generation candidates:

`1st-line`, `attenborough-terrace`, `bronte-street-south`, `dalhousie-gate`,
`gosford-crescent`, `haxton-heights`, `louis-st-laurent-avenue`, `lower-base-line-west`,
`miller-way`, `timmer-place`, `tock-close`.

Two are night-only (`1st-line`, `lower-base-line-west`), a shape the render layer now
supports.

## Open items

1. **Seven live clips carry `blur_verified: false`**, all uploaded 2026-09-03:
   `chretien-street`, `clifford-point`, `frost-court`, `heaven-crescent`,
   `mulroney-heights`, `shade-lane`, `tasker-court`. Every clip from this session carries
   `blur_verified: true` and a `blur_signed_at` timestamp; none of the seven has one, so
   the likely reading is that they predate the blur pass rather than having failed it.
   Needs a decision: verify them, or pull them.
2. **`makeStreetDecision`'s minimum-data gate** (`streetDecision.ts:42`) still requires a
   DB1 listing, so the cron returns `skip_low_data` for the 46 streets the new gate source
   admits. Manual generation works; automated refresh does not.
3. **The name guard has a blind spot.** `test-street-name-repair.ts` asserts a file
   *imports* the resolver; it cannot see a consumer inside the same file reading the raw
   parameter.
4. **The zero-tier grounding rules are narrow by design**, self-gating on
   `kAnonLevel: "zero"`. Worth an audit sweep of the thin tier, where `numeric_ungrounded`
   is still market-scoped.
5. `burnhamthorpe-road-milton` is published with no data behind it. Unchanged.
6. `heroSearch.ts` resolves 5 slugs to physically different streets; needs an ambiguity
   guard.
7. Condo H1s still render abbreviations such as `Nadalin Hts`. QUEUE item 4 — and
   `nadalin-heights` now has video, so that page is more visible than it was.
8. Stored `HubContent.metaDescription` drifts from live on 21 of 22 hubs. Cleanup.
9. Rent pill disagrees with the market card on `melville-bonus-crescent-milton` and
   `mcdougall-crossing-milton`. Known, not gated.
10. `video.miltonly.com` still unattached. `r2.dev` is rate-limited and not intended for
    production traffic at volume, and the bucket just grew six-fold to 213.6 MiB across 28
    live pages. This is now the most load-bearing unresolved item after the blur question.

## Next expected task

A decision on open item 1, or **QUEUE item 3 build scope** once Gate A is approved, or
generation for the 11 slugs above. Do not self-start any of them.

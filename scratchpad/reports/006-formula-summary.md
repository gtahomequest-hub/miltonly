The formula workflow found two defects in the commit shipped an hour earlier. Both verified and fixed — `eabef1b`.

## Correction to the earlier claim

Reported "279 -> 0" on the count fix. That was overstated. Measured on an 87-street sample:

**The commit used the wrong one of two 12-month sales counts.** `rawSoldCount12mo` is the nightly DB3 aggregate; the "Sales tracked" tile reads `sale12?.n` live. They drift — 5 of 87 disagreed, including two pages emitting "1 sale" beside a tile reading **0**. That is the exact error 8b7ea6c set out to eliminate. Now reads `enrichment.counts.sale12mo`, the identical expression as the tile, so agreement is structural.

**Worse, and missed entirely: the window was wrong on ~53% of priced streets.** `saleBasis` is graduated — when 12 months holds too few sales it widens to ~2 years. The copy paired that price with a 12-month count:

```
bergamot-avenue   price derived from 11 sales over ~2 years
      old copy    "across 4 sales in the last 12 months"
      now         "across 11 sales in the last ~2 years"
```

The number and the price came from different samples. The repo already had the right primitive — `windowDisclosure()`, documented as "the mandatory window+sample disclosure that must accompany EVERY published price." The phrase had been hand-rolled instead of calling it. Re-measured after: **0 and 0**.

## The formula

A pixel-gated ladder rather than a fixed string — measured across all 431, designed to **550px not 580**, on the grounds that 580 is a rule of thumb and the incumbent's worst case is 98px over it even bare.

```
S (187)  First Line, Milton — $1.35M Typical Sold · 11 Sales, ~2 Yr        513px
B (171)  Alder Gate, Milton — Townhomes in Cobban · 1 Sold, 12 Mo          537px
L  (37)  Hincks Drive, Milton — $3,150/mo Typical · 5 Leases, ~2 Yr        529px
Z  (36)  Nassagaweya Esquesing Townline, Milton — Street Profile           521px
```

| | Today (bare) | Formula |
|---|---|---|
| Titles > 580px | 12/431 | **0** |
| Descriptions > 155ch | 429/431 | **0** |
| Lead > 120ch (mobile) | 431/431 | **0** |
| Title patterns | **1 group / 431** | 72 groups, largest 8 |
| Ellipsis / cut snippets | 429 | **0** |
| Name artifacts in title | 21 | **0** |

Three design choices worth review, all evidence-based:
- the dollar figure is **never the last token**, so a tighter-than-assumed cut kills the descriptor and not the number
- **no area average ever appears in a title** — a neighbourhood typical reads as the street's own price (24 streets would have shared `$967K`)
- **minimal-template pages get no dollar figure at all**, since `StreetMinimalPage` renders no price surface; publishing one is the break-on-landing failure pointing the other way

## What blocks shipping the formula

`displayStreetName` repairs 21 names at render time — `Kovachik Boulevard #bsmt`, `420 Hincks Drive`, `Mcphail Way`. If that lives inside `generateMetadata`, **the title and the H1 will disagree on those 21 pages.** It has to move into `street-data.ts` beside `expandStreetName` and feed both surfaces. Same for the MLS-code strip (`"1051 - Walker"`), which belongs in `cleanOneNeighbourhood`.

That is a data-layer change touching the visible page, not just metadata — needs a decision before proceeding.

## Sequencing

Given the read that this is hygiene rather than a click lever: the three correctness commits on `feat/street-meta-ctr` are worth shipping on their own merits. The formula is a larger change whose measurable return is truth, width and duplication — not clicks. Worth doing, not urgent, and it needs the name-repair question settled first.

## Commit trail

| Branch | Commit | State |
|---|---|---|
| `main` | `0e1871d` | deployed |
| `fix/signin-unblock` | `51a13cf` | committed, not built/merged |
| `feat/street-meta-ctr` | `da5e15a` | Bennett override removed |
| | `8b7ea6c` | leases-as-sales + global title template deleted |
| | `eabef1b` | price/count/window from one basis |

Full report at `scratchpad/formula.txt`.

# Handoff

_Last rewritten 2026-09-04._

## READ THIS FIRST

**`fix/zero-sales-tier` is complete, gated, pushed, and deliberately NOT merged.**
No PR is open. Three street pages are published from it against production data, so the
DB has moved ahead of `main` while the code has not. That is intentional and safe: the
render path reads the DB, and nothing on those pages depends on unmerged code.

## Where things stand

| | |
|---|---|
| `main` | `9021f1b` `chore: QUEUE item 2 done, R2 video live on eight street pages` |
| open branch | `fix/zero-sales-tier` @ `45866c0`, 6 commits, pushed, **no PR, not merged** |
| production | serving `main`; DB writes and revalidations applied this session |
| published street pages | **434** (was 431) |
| battery | `PASS · 9 checks · 434 pages · 57s`, exit 0, preview `miltonly-j2t9ksgbi` at `EXPECT_SHA=45866c0` |
| local build | exit 0, 533 pages, **zero P2024**, 11/11 prebuild |
| prebuild suite | **11** tests (was 9) |
| QUEUE | 1, 2 done; 3 **Gate A reported, awaiting approval**; 4, 5 not started |

Detail: `scratchpad/reports/053-zero-sales-tier.md` and `053b-incident-response.md`.
Gate A recon: `054-address-anchors-gate-a.md`.

## What is on the branch

**`c1ca7ce` — DB2 record existence as the sixth activity-gate source.** The gate read
five sources, all "is this street live right now". DB2, the table holding the transaction
record, was not among them, so a registry street whose history was real but old could not
have a page. `countRecordedTransactions()` adds `COUNT(*)` across sibling slugs,
existence only: no price column, no date filter, never rendered, returns 0 when DB2 is
unreachable. The five-source condition became the pure predicate `hasStreetActivity()`.

**`b99d58e` — street name resolved at generator entry.** Builds 1 and 2 of
DEC-NAME-SOURCE fixed the stored name only; `buildStreetMetaTitle`,
`buildStreetMetaDescription`, `buildFaqJson`, the legacy prompt, `validateContent` and the
SMS body all read the raw parameter. Generating a street with no prior row exposed it.
Now resolved once at entry, making the raw parameter unusable below that line.

**`a32c0c9` — DEC-GROUNDING-ZERO and DEC-ZERO-CONTEXT.** See below.

**`45866c0` — band grounding and actionable rejections.** See below.

## The incident, and what closed it

**Every dollar figure in a zero-tier page's prose was ungrounded.** `numeric_ungrounded`
fires on the **market section only**, by design. tasker generated against a payload with
no price at any grain and produced "$1.1M", "low $1Ms" and "rents from $2,800 to $3,500"
in `neighbourhoodComparable`, `homes` and the FAQ. Validator 0 violations, judge PASS.
`drew-centre-milton` and `pickersgill-crescent-milton` had been live in the same shape
since July.

Not a k-anon leak: the k5 floor was respected and no street-level price was published. A
leak publishes a real number too precisely; this published numbers that did not exist.

**DEC-GROUNDING-ZERO.** New hard rule `zero_tier_price`. When the input carries no price
at any grain, every currency amount and price-shaped number is a violation by
construction. `inputHasNoPriceAtAnyGrain()` tests **content, not presence**. Wired into
all sections in both validators and both FAQ arms.

**DEC-ZERO-CONTEXT.** Rejecting the invention left the page with no market context, and
the honest sentence already exists one click away. On `kAnonLevel: "zero"`,
`neighbourhoodComparable` is populated from **`saleAggQuery` + `assembleAggregates` in
`src/lib/ai/buildHubInput.ts`** — the hub's own pair, the same two `buildStreetEnrichment`
calls, so street and hub cannot disagree. Those functions apply the k gates themselves.
Attached only when it clears k5.

**Three further defects the regeneration then exposed**, each beyond the literal brief:

1. A **second arm**: on the zero tier the dollar arm of `numeric_ungrounded` now runs on
   all sections and the FAQ. Three ungrounded figures survived the first pass without it.
2. **Bands**: the arm rejected a *true* statement, since "the low $400s" is an accurate
   reading of $419,990 but missed point tolerance by $3,190. `tierBandFor` grounds a tier
   construct when an input value falls inside the band it names. Band width follows the
   token's own precision, so `$1.3Ms` spans 100K rather than the whole `$1Ms`.
3. **Actionable feedback**: `pickersgill` burned all five attempts re-guessing
   `high-$600s`. `correctTierFor` names the band the nearest input value actually sits in,
   rebuilt from that value. This is the parkway-drive lesson again — a rejection the model
   cannot act on is a retry storm, not a guard.

`neighbourhoodComparable.daysOnMarket` is null on the zero tier: the DOM rule grounds only
against `aggregates.daysOnMarket`, so the neighbourhood's real 87 days was a number the
validator could not recognise.

## Regeneration result

| street | attempts | cost | judge | status |
|---|---|---|---|---|
| `tasker-court-milton` | 3 | $0.009 | PASS | published |
| `drew-centre-milton` | 2 | $0.007 | PASS | published |
| `pickersgill-crescent-milton` | 2 | $0.007 | PASS | published |

**Audited: 0 ungrounded figures across all three**, every figure traced to a named input
field. Full pairing table in `053b`. The render layer strips numeric sentences on a sub-k
page, so the published pages show **no price at all**; the audit is of the stored
generation, which is the layer that had to be made honest.

`tasker-court-milton` serves its R2 video: `day.mp4`, `poster.webp` and a `VideoObject`
all present on the live page. **All nine staged clips now have a page.**

**Sitemap is 434, not the 432 the brief predicted.** The 431 baseline already excluded all
three, because `drew-centre` and `pickersgill` were held first. Republishing three from
431 gives 434.

## The sixth gate source admits 46 streets

Measured 2026-09-04: **46** (47 earlier the same day; one picked up a DB1 signal in the
overnight sync). 9 published, 1 draft, 36 with no `StreetContent` row. **None
regenerated.** Full list in `053b`. `mae-court-milton` and `mcphail-way-milton` are also
QUEUE item 3 GSC address queries.

## Open items

1. **`makeStreetDecision`'s minimum-data gate** (`streetDecision.ts:42`) still requires a
   DB1 listing, so the cron returns `skip_low_data` for all 46. Manual generation works,
   automated refresh does not. Left alone; the approved scope was one clause on
   `getStreetStats`.
2. **The name guard has a blind spot.** `test-street-name-repair.ts` asserts a file
   *imports* the resolver. It cannot see a consumer inside the same file reading the raw
   parameter, which is how `b99d58e`'s defect survived two builds.
3. **The zero-tier grounding rules are new and narrow by design.** They self-gate on
   `kAnonLevel: "zero"` and on an input with no price, so ~430 pages are untouched. Worth
   an audit sweep of the thin tier, where `numeric_ungrounded` is still market-scoped.
4. `burnhamthorpe-road-milton` is published with no data behind it. Unchanged.
5. `heroSearch.ts` resolves 5 slugs to physically different streets; needs an ambiguity
   guard.
6. Condo H1s still render abbreviations such as `Nadalin Hts`. QUEUE item 4.
7. Stored `HubContent.metaDescription` drifts from live on 21 of 22 hubs. Column no longer
   served; cleanup.
8. Rent pill disagrees with the market card on `melville-bonus-crescent-milton` and
   `mcdougall-crossing-milton`. Known, not gated.
9. `video.miltonly.com` still unattached; `r2.dev` is rate-limited and not permanent.

## Next expected task

**Merge `fix/zero-sales-tier`**, which needs explicit approval and has none yet, or
**QUEUE item 3 build scope** once Gate A is approved. Do not self-start either.

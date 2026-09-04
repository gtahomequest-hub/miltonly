# Handoff

_Last rewritten 2026-09-04._

## READ THIS FIRST

**`fix/zero-sales-tier` is finished, gated, pushed, and deliberately NOT merged.**
It stopped on a systemic failure, not on its own defect. A decision is needed before
anything else in this area moves. See **THE HALT** below and
`scratchpad/reports/053-zero-sales-tier.md`.

## Where things stand

| | |
|---|---|
| `main` | `9021f1b` `chore: QUEUE item 2 done, R2 video live on eight street pages` |
| open branch | `fix/zero-sales-tier` @ `b99d58e`, 2 commits, pushed, **no PR, not merged** |
| production | serving `main`; untouched by this session except two revalidations |
| published street pages | **431** (sitemap), 432 `StreetContent` rows published |
| battery | `PASS · 9 checks · 431 pages`, exit 0, on preview `miltonly-6ztca9vbu` at `EXPECT_SHA=c1ca7ce` |
| prebuild suite | **10** tests (was 9) |
| QUEUE | items 1 and 2 done; item 3 **Gate A reported, awaiting approval**; 4 and 5 not started |

## What is on `fix/zero-sales-tier`

### `c1ca7ce` — DB2 record existence as the sixth activity-gate source

`getStreetStats`'s activity gate read five sources, all of them "is this street live
right now": DB1 active listings, DB1 sold-status flips, DB1 active leases, and DB3's
two 12-month counts. DB2 `sold_records`, the table holding the transaction record,
was not among them. A registry street whose history was real but old could not have
a page.

`countRecordedTransactions()` adds `COUNT(*)` on `sold.sold_records` across sibling
slugs, `perm_advertise = TRUE`. **Existence only**: no price column, no date filter,
never rendered. Returns 0 when DB2 is unreachable, so a failed probe leaves the gate
exactly as permissive as before.

The five-source condition is now the exported pure predicate `hasStreetActivity()`.
`scripts/test-zero-sales-tier.ts` is the 10th prebuild test, 9 assertions, verified
**red** against the pre-fix predicate and green after.

### `b99d58e` — street name resolved at generator entry

Builds 1 and 2 of DEC-NAME-SOURCE fixed the stored name only. `buildStreetMetaTitle`,
`buildStreetMetaDescription`, `buildFaqJson`, the legacy prompt, `validateContent`
and the SMS body all still read the raw parameter. Generating a street with **no
prior `StreetContent` row** exposed it: the driver has nothing but the slug to pass,
so tasker published with `metaTitle: "tasker-court-milton Milton Real Estate | ..."`
beside a correctly resolved `streetName: "Tasker Court"` in the same row.

Now resolved once at entry, which makes the raw parameter unusable below that line.
1 of 476 rows was affected, and it was the row this branch created.

## THE HALT

**Every dollar figure in a `kAnonLevel: "zero"` page's prose is ungrounded.**

`buildGeneratorInput("tasker-court-milton")` returns no price at any grain:
`typicalPrice`, `priceRange` and `daysOnMarket` null, no `neighbourhoodComparable`,
no `leaseActivity`, no `quarterlyTrend`. The prose it produced states "$1.1M" typical
for the Ford area, "low $1Ms", and "rents from $2,800 to $3,500 per month". The
validator found 0 violations and the judge passed it. The tell was in the log:
`[roundPrices] '$790,000' -> '$800,000' ... (no input within tolerance)`.

**This is not a k-anon leak.** No street-level price appears and n=4 is respected. It
is a different failure: a leak publishes a real number too precisely, this publishes
a number that does not exist.

**It is pre-existing and live.** `drew-centre-milton` and `pickersgill-crescent-milton`
are published on production today, both `kAnonLevel: "zero"`, both with empty price
payloads, both printing dollar figures. The branch does not cause this; it widens the
population that can reach it by 47 streets.

Under stop-on-failure, systemic failures halt the run. The run halted.

### State left behind, deliberately

| | |
|---|---|
| `tasker-court-milton` | `status=draft`, `needsReview=true`, `publishedAt=null`, `reviewNotes` records why |
| sitemap | **431**, unchanged, tasker absent |
| live tasker page | 200, renders the **minimal shell**; none of the fabricated prose is served |
| R2 | `videoUrl` + `videoCapturedAt` wired on the held row; `day.mp4` and `poster.webp` both 200 |
| revalidation | `/streets/tasker-court-milton` and `/streets` purged on prod, both 200 |

`431 -> 432` was **not** done and should not be until this is resolved.

### The decision needed

Should the zero tier be **barred from emitting any figure at all**, or should
`neighbourhoodComparable` be **populated for it** so its area claims become true?
Those are different products. Until one is chosen, tasker stays held and the branch
stays unmerged.

## Blast radius of the sixth gate source: 47, not 5

The Gate-A estimate of 5 was extrapolated from a 6-row sample. Measured across the
969-street universe (`StreetContent` union `ResidentialStreet`): **47 streets** are
newly admitted. 8 published, 1 draft, 38 with no row. **None regenerated.**

`duff-crescent`, `harvest-drive`, `mae-court`, `mclaren-road`, `mcphail-way`,
`pine-view-trail`, `strathcona-court`, `wise-crossing` (published);
`pitcher-place` (draft).

`mae-court` and `mcphail-way` are also two of the QUEUE item 3 GSC address queries.

## QUEUE item 3 Gate A: reported, awaiting approval

`scratchpad/reports/054-address-anchors-gate-a.md`. Headlines:

- **Position needs no MLS data.** `src/data/townAddressPoints.ts` holds 40,827 OGL
  rooftop points for every Milton address, listed or not. That removes VOW from the
  position half entirely. It exposes only a point lookup today and its header says
  it is ingest-time only, so a render-time source needs a per-street projection, not
  a 1.4 MB import.
- Of the eight queries listed (the brief says nine, one is missing): **5995 Avebury
  is not a Milton address**; 1419 Costigan, 8020 Derry and 1105 Leger are **condo
  towers**, which are QUEUE item 4, not street anchors. Four are genuine house
  queries: 71 Mae, 3165 McPhail, 262 Pine, 7295 Bell School Line. Bell School Line
  is a registry street with **no page**.
- Sold price and sold date per address stay out at any k, as the brief requires.

## Open items

1. **Zero-tier grounding.** The halt above. Highest priority; it is live on at least
   two published pages.
2. **`makeStreetDecision`'s minimum-data gate** (`streetDecision.ts:42`) still needs a
   DB1 listing, so the cron returns `skip_low_data` for all 47 streets the new gate
   source admits. Manual generation works, automated refresh does not. Left alone
   because the approved scope was one clause on `getStreetStats`.
3. **The name guard has a blind spot.** `test-street-name-repair.ts` asserts a file
   *imports* the resolver. It cannot see a consumer inside the same file reading the
   raw parameter, which is exactly how `b99d58e`'s defect survived two builds.
4. **Local `pnpm build` is non-deterministic on a 1-connection pool.** Confirmed
   again this session: first run exit 1 with 17 `P2024` prerender timeouts, exit 0
   with `connection_limit=10` on identical code. The mandated gate is untrustworthy
   until the local limit is raised.
5. `burnhamthorpe-road-milton` is published with no data behind it. Unchanged.
6. `heroSearch.ts` resolves 5 slugs to physically different streets; needs an
   ambiguity guard.
7. Condo H1s still render abbreviations such as `Nadalin Hts`. QUEUE item 4.
8. Stored `HubContent.metaDescription` drifts from live on 21 of 22 hubs. Column no
   longer served; cleanup.
9. Rent pill disagrees with the market card on `melville-bonus-crescent-milton` and
   `mcdougall-crossing-milton`. Known, not gated.
10. `video.miltonly.com` still unattached; `r2.dev` is rate-limited and not permanent.

## Next expected task

**A decision on open item 1**, then either merge `fix/zero-sales-tier` and publish
tasker, or fix the grounding gap first. Do not self-start either.

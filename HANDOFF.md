# Handoff

_Last rewritten 2026-09-05._

## READ THIS FIRST

**The corpus grounding sweep is done.** 479 generations audited, 154 published pages
regenerated, 138 republished clean, 16 left fail-closed. Detail in
`scratchpad/reports/058-corpus-audit.md`.

**A generation now stores the input it was written from.** `StreetGeneration.inputJson`
landed this session because the audit could not judge 461 of 474 rows without it — a hash
proves two inputs differ and says nothing about which grain moved. It is not a nicety: within
an hour of shipping, it turned the run's two remaining unresolved flags into a definite answer
in one query. **Use it. Do not audit a generation by rebuilding its input when the row carries
a snapshot.** 154 of 480 rows have one; every new generation adds one.

Two decisions still waiting, unchanged from 2026-09-04:

1. **Seven clips are live with `blur_verified: false`**, all from the 2026-09-03 run.
2. **Two clips remain orphaned** under slugs that are not real streets, and the GPS evidence
   does not identify them.

And one new one: **the 16-page residue below** needs a call — Claude fallback, or leave.

## Where things stand

| | |
|---|---|
| `main` | `c953b9e`, the `feat/gen-input-snapshot` merge |
| production | serving `c953b9e`, confirmed via `/api/build` |
| battery | **`PASS · 9 checks · 442 pages · 188s`**, exit 0, on production at the full SHA |
| local build | exit 0, zero `P2024`, **13/13 prebuild** |
| published street pages | **443** (438 after the takedown, +5 net from the run) |
| draft / unpublished | 42 / 4 |
| generations carrying an input snapshot | **154 of 480** |
| QUEUE | 1, 2 done; 3 Gate A awaiting approval; 4, 5, 6, 7 not started |

## What happened 2026-09-05

**`StreetGeneration.inputJson` shipped** (`feat/gen-input-snapshot`, merged `c953b9e`).
Migration `20260905120000_street_generation_input_json`, applied over the pg driver and
recorded in `_prisma_migrations`. Both write paths fill it at **all ten sites** where
`inputHash` is written — the atomic claim and the terminal update on success and on failure, in
`src/lib/generateStreet.ts` and `scripts/backfill-descriptions.ts`. `generateStreet` serializes
once and hashes those exact bytes so the pair cannot disagree.
`scripts/test-input-snapshot.ts` is the 13th prebuild test; it asserts the pairing **at every
site** rather than that the file mentions the column, and **it found a genuinely unpaired site
on its first run**. Verified red on a removed pairing, green on restore.

**The 154 regenerated, DeepSeek only, no prod env change.**
`scripts/regen-058-local.ts` deletes `AI_PROVIDER_FALLBACK` from the process environment after
`.env.local` loads, asserts all four provider knobs resolve to DeepSeek, and refuses to start
otherwise. **138 passed and republished, 16 failed fail-closed, $5.1947 total** ($0.9443 for
150 pages on DeepSeek, plus $4.2504 for the first four that ran through production before the
cost question was settled). Re-audited: **gate flags across the regenerated set fell from 138
of 138 to zero.**

**Two cost facts worth carrying.** The `$0.009` per page in every prior handoff is the
**DeepSeek** rate. Production has `AI_PROVIDER_FALLBACK` set, so any page whose half exhausts
its retry budget escalates to Claude at roughly **$1.06** — 118x. The flagged population is by
construction the population that fails the primary pass, so a bulk regeneration through
`/api/admin/force-regenerate` costs ~$164, not ~$1.40. Budget on which path you are on.

**Correction to yesterday's audit.** Report 058 first claimed "474 of 474 drifted". That was a
bug in the audit, not a measurement: it compared a 12-character slice against stored hashes
that are 64 characters on 459 of 479 rows. **The two write paths digest at different widths** —
the API/cron path writes the full sha256, `scripts/backfill-descriptions.ts` writes a 12-char
prefix. Corrected: **13 rows rebuild identically, 461 changed**. All 13 were generated
2026-09-03/04 and **all 13 carry zero gate flags**, so every gate flag in the corpus sat on a
row whose input had changed. The hash-width split is itself a live defect — see open item 4.

## Open items

1. **The 16-page residue.** Three are draft and cannot be generated
   (`geddes-landing`, `jasper-street`, `wood-close`; the last returns `No stats available`).
   Thirteen are published and keep their prior content
   (`conway-court`, `derry-road`, `ellenton-crescent`, `goutouski-crescent`, `grey-landing`,
   `holbrook-court`, `leriche-way`, `pharo-point`, `robinwood-crescent`, `secord-court`,
   `sim-place`, `syer-drive`, `whitlock-avenue`). **Fourteen of sixteen exhausted the `eval`
   half**, where comparator prices are narrated — on DeepSeek the model cannot restate a
   comparator inside tolerance. The Claude fallback cleared all four it was given, so ~$17
   would likely clear these. Decision needed.
2. **The DOM rule cannot read the neighbourhood's DOM.** `findUngroundedNumerics` compares a
   `days` token only against `input.aggregates.daysOnMarket` and never
   `neighbourhoodComparable.daysOnMarket`. 86 of the regenerated pages cite the neighbourhood
   figure correctly and would fire if the rule were widened past the market section. Fix the
   field before widening the scope, not after.
3. **Grounding is still enforced on zero and thin only, dollars only.** Counts, percentages,
   days and quarter labels remain market-scoped on every tier.
4. **The two generation paths digest `inputHash` at different widths** (64 vs 12 chars), so
   `backfill-descriptions.ts`'s idempotency check `existing.inputHash === inputHash` can never
   match a row the cron wrote. The bulk path has been silently regenerating cron-written rows.
   Normalizing invalidates the 20 short-hash rows' idempotency in one go, so it wants its own
   pass.
5. **Seven live clips carry `blur_verified: false`** (`chretien-street`, `clifford-point`,
   `frost-court`, `heaven-crescent`, `mulroney-heights`, `shade-lane`, `tasker-court`).
   `chretien-street`'s current clip is a signed 2026-09-02 capture, so that row is stale in its
   favour; the other six are unchanged. Decision: verify or pull.
6. **Two orphaned clips** under slugs that are not real streets. They need someone who can
   watch the footage and name the street; GPS has been taken as far as it goes.
7. **`makeStreetDecision`'s minimum-data gate** — now QUEUE item 7. Measured 2026-09-05: 831
   slugs carry DB2 records, **419 are skipped as low-data**, 103 of those already have a page
   and 316 have none. The brief's figure of 46 does not reproduce; the count is unfiltered for
   the registry, so pin it there first.
8. **The name guard's blind spot**: it asserts a file *imports* the resolver, not that every
   consumer inside it uses the resolved value. `test-input-snapshot.ts` is the pattern for
   fixing it — assert at every site, not once per file.
9. `burnhamthorpe-road-milton` and `louis-st-laurent-avenue-milton` are entity-real with no data
   behind them.
10. `heroSearch.ts` resolves 5 slugs to physically different streets; needs an ambiguity guard.
11. Condo H1s still render abbreviations such as `Nadalin Hts`. QUEUE item 4.
12. Stored `HubContent.metaDescription` drifts from live on 21 of 22 hubs. Cleanup.
13. Rent pill disagrees with the market card on `melville-bonus-crescent-milton` and
    `mcdougall-crossing-milton`.
14. `video.miltonly.com` still unattached. `r2.dev` is rate-limited and not intended for
    production traffic at volume, and the bucket is 257.6 MiB across 40 live pages.
15. Two draft rows carry a clip: `diefenbaker-street-milton`, `murlock-heights-milton`.

## Notes for the next run

- **The battery takes the full 40-character SHA.** A short SHA fails the gate on a string
  compare and aborts before any content check. Correct behaviour, easy to trip.
- `scripts/audit-corpus-grounding.ts` rebuilds inputs and will report false positives on
  comparator figures, because `crossStreets` membership moves between runs. Prefer `inputJson`
  on any row that has one.

## Next expected task

A decision on open item 1 (the residue), 5, or 6, or QUEUE item 3 build scope once Gate A is
approved. Do not self-start any of them.

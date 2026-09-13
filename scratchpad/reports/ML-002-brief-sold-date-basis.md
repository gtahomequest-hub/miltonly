# ML-002

LEADS · D:\miltonly-leads · feat/leads

1. **Defect confirmed.** `sold_date` is 00:00 UTC on every row; Toronto midnight is 04:00 UTC. The 2026-09-09 edition read 3 sales, and the 3 were the 10th's. Raw count on the 9th: 8.
2. **Fix.** `BriefWindow` carries `dateStartUtc` and `dateEndExclusiveUtc` beside the instants, on the Market Watch "two bases" pattern. `soldInWindow` reads the date pair plus `sold_date <= NOW()` (Ruling 10). `listedAt` and `lastPriceChangeAt` are real timestamps and stay on the instants.
3. **Prebuild.** Twelve assertions in `scripts/test-lead-guards.ts` (171 to 183): the fixture edition of 2026-09-10 reports 2026-09-09 on `[09-09T00:00Z, 09-10T00:00Z)`, a row stamped on the 9th is inside the date basis and outside the instant basis, the Monday and clock-change windows on the date basis, and the sold query read off the source: date basis, never `win.start`/`win.end`, carries `NOW()`.
4. **Dry run for 2026-09-09:** brief sold `{ count: 8, typicalPrice: 825000 }`, 18 listed, 6 changed price. Before the fix: `{ count: 3, typicalPrice: null }`.
5. **Gates.** Local `pnpm build` exit 0, zero `P2024`, 22 prebuild tests. Preview `miltonly-dxk36jt76` (alias `miltonly-git-feat-leads`). Battery at `EXPECT_SHA=3c51e9062b7f2a4b5118aa7aa39ce5e395ec7159`: **PASS · 11 checks · 449 pages · 99s**, including the two hub checks that failed on the Phase 2 preview.
6. **For Core to merge by SHA: `3c51e9062b7f2a4b5118aa7aa39ce5e395ec7159`** is the proven tree; the head is one docs commit above it carrying only this report. Merge the head.

Report: scratchpad/reports/ML-002-brief-sold-date-basis.md

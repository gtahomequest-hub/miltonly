# MC-025
CORE · D:\miltonly · main

**Two merges by SHA, full gate each.** `fix/neon-egress-2 @ 8279ead` as `89e88e4` (local build exit 0, 149/149, pushed, production built); then `fix/node-22 @ 320f325` as `2aed6f9` (local build exit 0 under Node 22.23.2 through Node 22's own corepack, 149/149, pushed). Production `miltonly-3l8erlxhp` serves `2aed6f9` on Node 22: the build log says "Skipping build cache since Node.js version changed from 20.x to 22.x" and that the project setting's 20.x is overridden by `engines` (set the dashboard to 22.x when convenient). Production battery after the second merge: **`PASS · 19 checks · 569 pages · 765s`**.

**Egress, measured on production: DB1 244,828 rows for one full battery, against 263,706 on the fix's preview.** `pg_stat_statements_reset()` on DB1 and DB2 and the `db2` tag dropped before the battery, read after (`scratchpad/mc003/pgss-reset.ts`, `pgss-read.ts`). The four readings by the same method: MC-016 baseline 1,138,193; MC-018 as first merged 4,241,533; the fix's preview 263,706; **production now 244,828**, 21 % of the baseline. The two slug sets no longer appear in DB1's top twelve statements; the largest is the mega menu's live panel, 84 calls × 464 rows. DB2: 52,333 rows.

**The nightly audit, tomorrow.** The gate fix is on `main` since 22:10Z today; today's deliveries came before it and skipped like the 14th's and 15th's. Noted in HANDOFF as the follow-up: after 07:00 UTC on the 17th, check the Actions page (or the runs API) for a run whose `audit` job ran, and `git log main` for `audit(nightly): 2026-09-17`.

**MC-024 followed** (the Rent menu, `91f8ef0` as approved), reported separately in `scratchpad/reports/MC-024-rent-menu.md`.

Report: scratchpad/reports/MC-025-egress-node22-merges.md

# MC-027
CORE · D:\miltonly · main

1. `fix/hub-truth @ b7183b4` merged by SHA as `56cf3ea`, pulled first (`main` had gained `5ac650b`, the nightly audit's own commit for 2026-09-17: the gate fix works). Local build exit 0 under Node 22, 171/171.
2. Production serves `56cf3ea`; battery **`PASS · 20 checks · 608 pages · 794s`**.
3. Purged the `db2` and `db3` tags, the 22 hub paths and `/neighbourhoods`, then `/api/jobs/warm-hubs` walked the 22 in 67 s: production serves the regenerated prose (Timberlea: "95 sales here in 12 months" under its tile).
4. `scripts/queue-mean-typical-streets.ts --write`: **39 queued** (one of the earlier 40 no longer states a mean at $5,000 after the day's sales moved) for the hourly cron, uncapped.
5. Maple Avenue: its centreline centroid is in the **Dempsey** polygon (73 % of its 2,244 m too; 26 of 35 sold records agree); the registry row moved from Dorset Park to Dempsey, the street and both hubs purged, and `--only=hub-page,hub-meta` reran clean on production (2 checks, 608 pages, 440 s).
6. HANDOFF rewritten (main is `56cf3ea`, nothing waits on a merge, the open list), QUEUE marked done, committed and pushed.

Report: scratchpad/reports/MC-027-merge.md

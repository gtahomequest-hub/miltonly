# MC-014
D:\miltonly · main

## MC-014: hubs v2 and core batch 3 on main, confirmed on production

### 1. Merge `26af26b` (hubs v2, approved) by SHA, full gate: done

Merge commit **`05bc914`**, `pnpm build` exit 0, pushed. **The hub rebuild is marked done in QUEUE.md** (the MH-004 section, docs commit `34f2e8b`). The branch stacked on menu v2, already on main, so it brought only the hub work: `hubStreetLadder.ts`, `hubSchools.ts`, the rebuilt sections, the `hub-page` battery check.

### 2. Merge `bf4f8b3` (core batch 3) by SHA, full gate: done

Merge commit **`f01a96a`**. Three conflicts, each resolved by keeping both sides' intent:
- `scripts/verify/run.mjs`: both branches added a check; the runner now carries `hubPage` and `sourcesFresh`, **16 checks**.
- `src/lib/hubData.ts`: hubs v2 rewrote `intentsFor` (buying to the scoped listings, selling to `/value/<slug>`, investing to the scoped sold record); batch 3's scoped renting square was applied to the new function: `/rentals?neighbourhood=<slug>`, sub "Leases in <Name>".
- `src/components/hub/sections.tsx`: the rebuilt ladder section kept; its third-rung action, which still pointed at the retired overflow page above the cap, now goes to `/streets` for every hub (the ladder is every published street, so the overflow page had nothing to add and 301s to this section).

`scripts/test-core-batch-3.ts` 57/57 on the merged tree, `pnpm build` exit 0, pushed; production serves `f01a96a`.

### 3. Confirmed on production

| | |
|---|---|
| `/neighbourhoods/timberlea` ladder | **22 rows rendered = 22 published Timberlea streets** (DB, all 22 in the sitemap); the page says "All 22 streets" |
| `/neighbourhoods/beaty/streets` | **301** to `https://miltonly.com/neighbourhoods/beaty#streets` |
| hub titles | `Timberlea, Milton: Homes, Prices and Street Guide`, `Beaty, Milton: …`, `Old Milton, Milton: …`; the `hub-meta` check reports 0 of 22 with an em-dash |
| `/rentals?neighbourhood=beaty` | title `Beaty Rentals, Milton: Let Miltonly Find Your Home`, `rentals-available-in-hub` **88**; unscoped `/rentals` `rentals-available` **1,138** |

Production battery at `f01a96a`: **`PASS · 16 checks · 489 pages · 596s`**, exit 0, `served == expected`.

### Files
- main: `05bc914`, the QUEUE mark, `f01a96a`, and this docs commit
- record: `scratchpad/mc003/battery-prod-f01a96a.log`, `probe-ladder.ts`

### Next
Nothing waits on a merge. Open: a `db3` tag drop for the analytics sync; `barclay-circle` and `gordon-krantz-avenue` on a later pass; QUEUE item 6.

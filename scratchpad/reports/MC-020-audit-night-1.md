# MC-020
CORE · D:\miltonly · fix/audit-night-1

**Main.** Local main (`20aa2d7`, the MA-003 merge of `feat/audit @ e3261a7`) built exit 0, 609/609, no `P2024`; pushed. Then `docs/MC-021-reporting @ 1ecc166` merged by SHA as `1ad86d8` and pushed. Production `miltonly-55r4p6xwv` serves `1ad86d8`. Battery against it (run from the fix branch's tree, so with its new 17th check): `FAIL · 17 checks · 509 pages · 798s`, **16 pass**, the one failure is `catchment` on 520 pages, the site-wide `og:description` "school zones" in `src/app/layout.tsx` that this branch removes. Main's own 16 checks are clean.

**Steps of MC-020 found done at `4a31b1d`:** (a) the `catchment` battery check carrying the render guard's pattern list, registered in `run.mjs`; school titles, `/schools`, the `/listings` schools block and the OG description without zone language; (b) `formatArchitecturalStyle` for the TREB style strings, the listing page rendering style only through it; (c) the remarks block with `data-remarks` and the label "Listing agent's remarks", the hashed viewed-today counter gone; (d) one H1 on `/rentals`; (e) the condo intent anchors resolve. `scripts/test-audit-night-1.ts` (57 assertions) in the prebuild, passing. Local build exit 0. **What remained:** the preview battery of `4a31b1d` had died mid-run (no summary line); the two S2 `catchment` findings left after MA-003, "boundary data" beside "school boards" in the schools guide's disclaimer and FAQ (`src/lib/guides/guides.ts`); no report, no HANDOFF, no QUEUE mark.

**Done now.** `31f3d98` rewords the guide to "placement maps" (content-guides test 1313 assertions PASS). Local build exit 0, 609/609, no `P2024`. Preview `miltonly-q1zdch6qs` serving `31f3d9876968c5bb6fd63295aaa74e40d5a7b502`: **`PASS · 17 checks · 509 pages · 799s`**. Main merged into the branch and the docs committed on top: **head is the docs commit on top of `d2bbee3`** (reported in the reply), app code identical to `31f3d98`. Not merged to main: waits on approval.

**Not taken, named for Core.** The 196 S3 `dead-anchor` findings are one defect: hero pills link `#type-<type>` for any type with n >= 1 and the lease pill `#type-condo`, but a `TypeCard` renders only above k5 (`buildProductTypeSections`); `TypeSection.tsx` is rendered nowhere. Street-page change, outside this task's scope.

**Gotchas recorded in HANDOFF.** `vercel ls` says `● Ready` a minute before the URL stops serving "Deployment is building"; `vercel ls` rows shift by a line between calls; a battery under the Bash tool dies at the 10-minute cap, so it runs under `nohup` with the log polled for `^EXIT`.

Report: scratchpad/reports/MC-020-audit-night-1.md

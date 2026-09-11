# MC-009
D:\miltonly · main (work on four branches, none merged; MC-010 folded in)

## MC-009: the fail-closed merge landed, the judge verdict is persisted, the seven clips are up, 8 of the 23 crossed streets republished; MC-010: the sold sync purges both caches, proven on preview

### 1. Merge `e12b1b6` by SHA, full gate: done

Merge commit **`f347001`**, `pnpm build` exit 0, pushed, production serving it. A page the judge refuses now records `failed`, attempts +1, with a `lastError` naming the path; the cron's 21:00Z and 22:00Z passes ran on it.

### 2. The judge verdict, persisted: built on `feat/judge-verdict` (`25b59a6`), migration applied, not merged

`StreetGeneration.judgeVerdict` (Json, nullable) carries `{ result, round, rounds[] }`: `result` is `pass` / `fail` / `not_run` (validators failed first, judge never called), `round` the final round, `rounds[]` each round's `pass`, `spans[{span, class}]`, `judgeError` and `at`. `generatePhase41StreetContent` returns its rounds on the result and on the retry-exhausted error payload (a round-1 refusal whose retry then ran out of budget keeps round 1). `generateStreet.ts` writes `buildJudgeVerdict(rounds)` on all three terminal updates, the one path the cron and the local runners share. Migration `20260911210000_street_generation_judge_verdict` (one `ADD COLUMN`, nullable) applied with `prisma migrate deploy`; `migrate status` clean, 27 migrations. Prebuild case `scripts/test-judge-verdict.ts`: 18 assertions, the pure builder on four run shapes, the column, the migration, the three writes. Build exit 0.

Proven on real runs today: 25 of the 33 generations since 21:00Z carry a verdict (the 8 without ran on production's code, which does not have the branch). Sample, `anne-boulevard-milton`: round 1 FAIL `"Most residents treat the GO as the practical option."` [community-closeness proxy / buyer characterization], round 2 PASS, result pass. `derry-road-milton`: round 1 FAIL `"Is Derry Road a good fit for investors?"` [buyer-class suitability], round 2 FAIL `"a stock that serves both ownership and tenancy at scale"` [tenure characterization], result fail. `nadalin-heights-milton`: round 1 `judgeError: no JSON in judge response: {"pass": true, "findings` (a truncated reply, counted as a refusal by the fail-closed rule), result fail.

### 3. MC-007, the seven signed clips: done, with two fixes on the way

**Dry run** (`upload-street-videos-r2.ts --only=…`): 7 candidates, 50.3 MiB, all `blur_verified: true` (the 124 Homesly rows refused as `blur_verified: false`, as designed); 6 with a `StreetContent` row, 1 missing (`anne-boulevard`), 1 `draft` (`martin-street`, an April legacy draft with no generation row).

**Re-keying.** Every object ships `Cache-Control: immutable, max-age one year`, so replacing `day.mp4` in place would have left the old footage at the edge under a new capture date. `feat/video-rekey` (`dde23bd`, not merged): a staged clip whose `supersedes_r2_key` is the live key goes under a capture-date segment, `streets/<slug>/<YYYYMMDD>/day.mp4` with its poster beside it (`deriveVideoPoster` rewrites the trailing `/day.mp4`, so the render layer is untouched); the keys are written back to `meta.json`; `promote-staged-clips.ts` verifies the recorded keys, rebuilds the manifest carrying the prior row and top-level fields (blur generations, plate model, registry blocks) with counts recomputed and the previous file backed up beside the DC backups; new `retire-superseded-clips.ts` deletes the old objects only after the production page is seen serving the new URL, and retires a named orphan to `D:/dashcam/retired`.

**Missing rows generated on DeepSeek.** `anne-boulevard-milton` failed twice on production's validator ($0.0219, $0.0136): every faithful attempt named "Bronte Meadows Park", a Town park in the input, and `comparator_neighbourhood_claim` read it as placing the comparator Bronte Street in the Bronte Meadows neighbourhood. `fix/comparator-park-mask` (`db3be15`, not merged): the rule runs on text with the input's nearby place names masked, cross streets and neighbourhoods left readable; prebuild case on both directions (6 assertions). A third run before that fix was wasted by my own tooling ($0.0173, a merge that did not happen); with the fix, published in 41 s at **$0.0150** (judge round 1 FAIL, round 2 PASS, verdict persisted). `martin-street-milton` regenerated from its draft via the standing runner: attempts 3, **$0.0094**, judge PASS, `draft` to `published`. Generation total $0.0772, of which $0.0528 was spent on the three failed runs.

**Run:** 7 clips + 7 posters uploaded, 7 `videoUrl` set; `locker-place` and `nipissing-road` re-keyed to `…/20260910/day.mp4`; the seven pages and `/streets` revalidated. **Promote:** 7 moved to `published/`, manifest rebuilt 176 to 174 rows (the two superseded rows replaced). **Retire, after production confirmed the new URLs on both pages:** 4 old objects deleted (locker-place and nipissing-road clip + poster), the `bronte-street-south` orphan (unmatched, no page, no row pointing at it) deleted from R2 (2 objects) and its folder moved to `retired/`; manifest rebuilt again, **173 rows, 49 published, 124 staged**, Milton 49 published, `bronte-street` in, `bronte-street-south` out. Backup `work/_town/manifest.before-MC-007-2026-09-11.json`.

**Three curl checks:** `streets/locker-place-milton/20260910/day.mp4` 200, video/mp4, 5,350,713 B; `streets/nipissing-road-milton/20260910/day.mp4` 200, video/mp4, 4,134,128 B; `streets/anne-boulevard-milton/poster.webp` 200, image/webp, 143,852 B. The three retired keys answer 404. All seven pages on production embed their `r2.dev/streets/…/day.mp4` URL.

### 4. The 26 streets that crossed k5 or k10: derived, 23 regenerated, 8 republished

The 26 are not listed anywhere, so they were derived: the 12-month For Sale sample per street now, minus the rows the date repair moved into the window (re-dated to `contract_date` with a `close_date` still ahead), against the k5 and k10 floors. **17 crossed k5, 9 crossed k10, 26 streets**, the report-065 figures reproduced exactly. 23 have a published page; `banks-crescent`, `copeland-circle`, `holmes-crescent` have none (they are creation-programme candidates). Standing runner, DeepSeek only, `REGEN_CAP_USD=2`, run from a local branch carrying the judge verdict and the park mask:

**passed 8, failed 15, $0.2770.** Republished clean: clitherow-street, ferguson-drive, frank-place, hepburn-road, kovachik-boulevard, moorelands-crescent, waters-boulevard, whitmer-street. The 15 failed closed, prior page preserved (still publishing the suppressed figure): **13 on `fair_housing_register`**, the semantic judge, 1 on `invalid_json_shape` (rolph-terrace), 1 on `numeric_ungrounded` + `temporal_pairing` + `catchment_vocabulary` (cavanagh-lane).

**The judge is the limiting gate, and its verdicts are now readable.** Among the 13: `"Is Derry Road a good fit for investors?"` and `"Is Rose Way a good fit for investors?"` refused as [buyer-class suitability], both questions drawn verbatim from the FAQ bank the prompt offers; `"The train is the mode most residents would use."` and `"The GO route is the one most residents use."` as [tenure characterization]; `"For families, the school map is broad."` [family status]; `nadalin-heights` on a truncated judge reply. Whether the investor question stays in the bank, and whether a "most residents" commute sentence is a characterization, are rulings, not fixes; a one-time retry on an unparseable judge reply is a small fix I did not make without the ruling. The verdicts for all 23 are in `StreetGeneration.judgeVerdict`.

### MC-010, folded in: the sold sync purges every sold-derived figure, proven on preview

**Two caches, not one.** Every sold-derived figure sits in Upstash under a one-hour TTL and the sync never touched it. `fix/sold-sync-purge` (`67fcf7f`, not merged): `runSoldSync` ends a writing run by deleting the Milton-wide keys (the homepage month-to-date figure at every date suffix, the sold totals and roll-ups, the four sold aggregates, the Milton-wide sold list) and, by SCAN over prefixes, the per-street and per-neighbourhood stats and sold lists for exactly the streets and neighbourhoods it wrote; a settle pass ten seconds later takes any key an in-flight render wrote back. A run that wrote nothing purges nothing. Prebuild case `scripts/test-sold-cache-purge.ts` reads every sold-derived `cached()` site in `src/` (15) and asserts each is covered.

**The first proof run found the second cache.** With the Upstash key deleted and the table at 60, production rendered 59 four times in twenty seconds, while the same query from a plain process read 60. `src/lib/db.ts` gives the Neon HTTP client `next: { revalidate: 3600 }`, so Next's Data Cache holds every DB2 and DB3 query a page makes for an hour, keyed by the SQL text, beyond any Upstash purge. The hour stays and is now tagged (`db2`, `db3`); the sold sync route drops `db2` after a writing run, and `/api/revalidate` accepts `{ tag }` (allowlisted) for the syncs that run outside the app.

**Proof, preview `miltonly-4rwyyu3vn` at `67fcf7f`, no waits.** A controlled change was needed for "after" to differ from "before": one September sale row outside the sync's window had `perm_advertise` flipped off, then restored (confirmed `true` at the end). Each phase ran the real `runSoldSync` (cursor rewound three hours so it re-upserts recent rows: 4 updated each time, Upstash purge 7 keys) and then the tag drop.

| | homepage `sold so far this month` | DB2 |
|---|---|---|
| T0 warm | **59** | 60 (the stale hour, reproduced) |
| T1 row hidden | 59 | 59 |
| T2 sync + tag, no wait | 59 | 59 |
| T3 row restored | **59** (stale) | **60** |
| T4 sync + tag, no wait | **60** | **60** |

T3 to T4 is the proof: a stale figure, a sync that wrote, the fresh figure immediately. On production today the old build's data cache heals on its own within the hour; the fix reaches the cron only when the branch lands.

**`3ec8b51` (menu v2) not merged:** the instruction was "once Aamir approves", and no approval was given in this task.

### Files
- main: `f347001` and this docs commit
- `feat/judge-verdict` `25b59a6`: `prisma/schema.prisma`, migration `20260911210000_street_generation_judge_verdict` (applied), `compliance.ts`, `generateStreet.ts`, `scripts/test-judge-verdict.ts`, `package.json`
- `fix/comparator-park-mask` `db3be15`: `validateStreetGeneration.ts`, `scripts/test-comparator-park-mask.ts`, `package.json`
- `feat/video-rekey` `dde23bd`: `scripts/upload-street-videos-r2.ts`, `scripts/promote-staged-clips.ts`, `scripts/retire-superseded-clips.ts`
- `fix/sold-sync-purge` `67fcf7f`: `src/lib/soldCachePurge.ts`, `src/lib/vow-sync.ts`, `src/lib/db.ts`, `src/app/api/sync/sold/route.ts`, `src/app/api/revalidate/route.ts`, `scripts/test-sold-cache-purge.ts`, `package.json`
- record: `scratchpad/mc003/k-cross-regen.jsonl`, `regen-kcross.log`, `create-anne-*.log`, `regen-martin.log`

### Next
Four merges, by SHA, your call: `25b59a6`, `db3be15`, `dde23bd`, `67fcf7f` (each built exit 0; `package.json` prebuild lines will conflict trivially between the first two and the fourth, union them). `3ec8b51` on your approval. Rulings on the judge: the investor FAQ question, "most residents" commute sentences, and a retry on an unparseable reply. The programme: 19 pages created today, cap holding, 217 pending.

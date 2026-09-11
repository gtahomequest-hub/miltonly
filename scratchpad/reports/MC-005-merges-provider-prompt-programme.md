# MC-005
D:\miltonly · main

## MC-005 (with MC-006 and MC-008 folded in): five merges, the cron on DeepSeek, the prompt shaped to the input, the programme building

### 1 and 2. Merges by SHA, full gate: done

| order | SHA merged | merge commit | build | what |
|---|---|---|---|---|
| 1 | `4a65f30` (fix/queue-reeval) | **`cbea785`** | exit 0 | DEC-QUEUE-REEVAL, the re-queue script |
| 2 | `b0d424b` (feat/geometry) | **`142b9a9`** | exit 0 | QUEUE item 5, **marked done** |
| MC-006 | `339293d` (fix/menu-hotfix) | **`1f0915e`** | exit 0 | mobile menu, hub contrast, footer dashes |
| MC-008 | `3c51e90` (feat/leads) | **`bfb78f3`** | exit 0 | the brief reads `sold_date` on the date basis; one QUEUE.md conflict, both sides said Phase 2 done, Leads' wording kept |
| step 4 | `c297e63` (fix/eval-prompt-shape) | **`854ffd3`** | exit 0 | the evaluative prompt shaped to the input (see 4) |

Each pushed in turn; production served each in turn. Production battery at `bfb78f3`, `EXPECT_SHA` the full SHA: **`PASS · 13 checks · 449 pages · 126s`**, exit 0, `served == expected`. `854ffd3` changes the generator only; its preview battery at `c297e63` was **`PASS · 13 checks · 456 pages · 138s`**, the seven pages the cron had built by then included, and `/api/build` on miltonly.com answers `854ffd3…`. The fifth merge was not in the task's list by SHA because the commit did not exist when the task was written; step 5 needed it on production for the next cron pass to be a test of the fix, so I merged it and am saying so here.

**MC-006 confirmed on production at 380** (`scripts/probe-mobile-menu.mjs`, `scripts/probe-hub-contrast.mjs`, both from the hotfix, run against miltonly.com): the menu panel on `/` is `position: fixed`, top 0, 380 × 780 with the viewport at 780, accordion at top 78 visible, no containing-block traps; same on `/streets`. `walker` hub: 3 hero stats and 5 glance tiles (`h-hs`, `h-gi-v` present in the served HTML) all at or above 4.5:1 at 380 and 1440; the probe prints only failures and printed none. Footer on `/`: 0 em-dashes (0 in the whole page text).

### 3. `AI_PROVIDER_MARKET=deepseek`: done, confirmed on the cron

Set in Production and Preview via stdin (`printf 'deepseek' | vercel env add …`, Production's old row removed first); `AI_PROVIDER_FALLBACK=opus` untouched. Vercel stores a stdin-added value as sensitive, so `vercel env pull` prints `[SENSITIVE]`; the runtime reads it. Redeployed by the pushes above; `/api/build` confirmed at `bfb78f3` and then `854ffd3`.

**The manual-generate confirmation is the 19:00Z cron pass itself**, which fired ninety seconds after production started serving the new environment, on the 20 rows the previous pass had failed: **20 attempted, 7 built, 13 failed on validation, $0.2168, not one credit-balance error.** Every `StreetGeneration` row carries a DeepSeek-sized cost ($0.0036 to $0.0157). There is no single-slug generate route on production (the route drains up to 25 rows), so one hourly pass is the smallest unit that exists; I did not call it a second time.

### 4. The `differentPriorities` thin-data fault: fixed at the prompt, on production

**Failure shape, the 22 % sample (2026-09-10, 23 streets, 5 built, 18 failed):** 11 of 18 carried `invalid_json_shape` with the exact excerpt `sections length = 3, expected 2`; 7 of those also `zero_price_faq_question`; the rest were 4 `fair_housing_register`, 2 `heading_out_of_bank`, 1 `per_trade_fabrication`, 1 `physical_detail_ungrounded`. The 19:00Z pass today (DeepSeek, unfixed prompt) had the same shape: 8 `invalid_json_shape` (5 the 3-vs-2 excerpt), 7 `zero_price_faq_question`.

**The cause.** `dropsDifferentPriorities(input)` is true on every thin-data candidate (fewer than two priced comparators). The generator told the model so in one preamble paragraph, "DO NOT WRITE A differentPriorities SECTION", prepended to `docs/phase-4.1/03-evaluative-prompt.md`, and the prompt underneath said the opposite eleven times: "the THREE EVALUATIVE SECTIONS", "exactly THREE sections in this order", a 40-line specification of the section, a word target that included it, the JSON schema's id union, the FAQ bank's comparison question with a rule making it the closer, and the self-check's "exactly three entries ... differentPriorities". DeepSeek followed the schema. The same pattern held the FAQ bank on a street with no price at any grain: the zero-price preamble withdrew six questions the bank still offered, under a rule that said "PRICE cluster: always include one or two".

**The change** (`src/lib/ai/evalPromptShape.ts`, wired in `compliance.ts` before any preamble): the prompt is rewritten to the input. When the section is dropped: its specification becomes a one-line notice, the opening statement, the count, the dual-direction rule, the schema union, the schema sentence and the self-check say two, the word targets lose the section's own 95–135 range (285–405 becomes 190–270; 585–855 becomes 490–720), the comparison question leaves the bank and the routing rule is withdrawn; the shaper then asserts that exactly one mention of the section survives (the notice) and no three-section statement does. When the input has no price at any grain: the six own-price questions leave the bank and the price, rental and investor cluster rules are withdrawn. A full-data street gets the doc back byte for byte. Every anchor is a `must()` that throws if the doc no longer carries it, so an edit to the doc fails the prebuild, not a cron.

**Prebuild case:** `scripts/test-eval-prompt-shape.ts`, 26 assertions against the real doc on three fixtures (full data; one priced comparator; zero price). Preview `miltonly-jf1gmho7o` at `c297e63`, battery 13/13 on 456 pages. Merged as `854ffd3`, on production 19:13Z.

### 5. Re-queue and the next cron pass

`requeue-creation-programme.ts --write` at 19:14Z: 249 candidates, 12 with a page, **237 queued as pending**, attempts 0 (prior: 224 pending, 12 failed, 1 done-without-page).

**The 20:00Z pass, fixed prompt:** **13 attempted, 7 built, 6 failed, $0.1102.** Thirteen and not twenty because **DEC-NEW-PAGE-CAP counts `StreetContent.createdAt` per UTC day** and the 19:00Z pass had already created 7; the budget resets at 00:00Z. Pass rate 54 %, against 35 % an hour earlier on the same provider and 22 % on 09-10. **`sections length = 3, expected 2`: 0** (was 5 of 13 an hour earlier). The six failures: 5 `fair_housing_register` from the semantic judge, round 2 (cherry-court "For families, the public and Catholic school options are close" [family status]; cactus-point "a young, dense, and largely built-out pocket" [age or life stage] and "a rental-oriented pocket" [tenure]; fir-court, leblanc-court, gazley-circle likewise) and 1 `invalid_json_shape` on evans-terrace that is not the section count (a malformed sections array, excerpt in `StreetGenerationReview`). The judge is now the programme's limiting gate.

**Judge results.** For the 14 pages the cron built today the fair-housing judge passed, by construction: it is fail-closed and a page it refuses is never written. Its per-round findings are appended to `.judge-log.jsonl` in the process's working directory, which on Vercel is the function's ephemeral filesystem, so the round-1 findings on a cron build are not recoverable after the run (`vercel logs --follow` across the 20:00Z pass returned no lines and auto-stopped at five minutes). The five judge refusals above are recorded in `StreetGenerationReview` with the span and the class. Persisting the judge verdict on `StreetGeneration` is the small follow-up that would close this.

**Cost.** 18:00Z pass $0 (20 credit-balance 400s, nothing called). 19:00Z pass $0.2168 for 20 attempts, 7 pages. 20:00Z pass $0.1102 for 13 attempts, 7 pages. **Today on the cron: $0.3270 for 14 pages, $0.0234 a page, all DeepSeek.** All 14 answer 200 on production and the preview battery passed them.

**The 14 pages built today:** hamilton-crescent, bussel-crescent, ambroise-crescent, moonseed-place, urell-way, willingdon-crescent, cumming-boulevard (19:00Z); dice-way, wellwood-terrace, bond-head-court, cedric-terrace, riddell-crescent, chuchmach-close, balsam-court (20:00Z). With the five from 09-10, 19 of 249.

### A second queue-state bug, found on the 20:00Z pass, fixed on a branch, not merged

`generateStreetContent` **resolves** with `passed: false` when the combined validation or the judge refuses a page (fail-closed, no row written); it **throws** only when a half's retry budget is exhausted. The cron treated every fulfilled promise as built: the five judge-refused streets above were marked `done`, attempts 0, with no page behind them, and would never have been looked at again. `fix/queue-failclosed` at **`e12b1b6`** (build exit 0, pushed, preview pending) records a refusal as `failed` with attempts +1 and a `lastError` naming the path. Until it lands, `requeue-creation-programme.ts --write` recovers such rows (it queues everything without a page). Your call on the merge.

### Files
- main: `cbea785`, `142b9a9`, `1f0915e`, `bfb78f3`, `854ffd3`, and this docs commit
- `fix/eval-prompt-shape` (`c297e63`, merged): `src/lib/ai/evalPromptShape.ts`, `compliance.ts` (one call), `validateStreetGeneration.ts` (one export), `scripts/test-eval-prompt-shape.ts`, `package.json`
- `fix/queue-failclosed` (`e12b1b6`, not merged): `src/app/api/sync/generate/route.ts`
- record: `scratchpad/mc003/battery-prod-bfb78f3.log`, `battery-shape-preview.log`, `cron-2000.log`

### Next
The programme runs itself: hourly, DeepSeek first, 20 new pages per UTC day, 230 candidates left. Open: `fix/queue-failclosed` `e12b1b6` (merge by SHA); a persisted judge verdict; the 26 streets that crossed k5 or k10; QUEUE item 6.

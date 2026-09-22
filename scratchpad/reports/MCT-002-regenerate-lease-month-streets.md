# MCT-002

CONTENT · D:\miltonly-content · feat/content-2

1. **Main fetched and merged first (`4ee5f1f`, one `QUEUE.md` conflict, both lines kept), so the generator ran MC-036's code: `git diff origin/main -- src docs scripts prisma` is empty.** Confirmed before generating: the runtime market prompt `docs/phase-4.1/02b-market-prompt.md` now says `input.leaseActivity` carries `byBed` typicals and nothing else, "never write a single tenancy"; `buildGeneratorInput.ts` builds `byBed` only (`recentRecords` and `rangeStats` are no longer built). The only file still describing per-row lease records is `docs/phase-4.1/02-descriptive-prompt.md`, which nothing loads (`compliance.ts` reads `01`, `02a`, `02b`, `03`).

2. **The 37, found by MC-036's own test, not a guessed list.** The test is `D:\miltonly\scratchpad\mc036\q4.mjs`: published `StreetContent.description` matching `(rented|leased)[^.]{0,80}(in|during|this past|last) <Month>`. Made repeatable as `scratchpad/mct002/find-lease-month.ts`; before the run it returned exactly 37 of 691 (`scratchpad/mct002/before.txt`): bellflower-court, boyd-lane, bronte-street, cavanagh-lane, clark-boulevard, costigan-road, derry-road, farmstead-drive, ferguson-drive, fourth-line, giddings-crescent, gleave-terrace, gordon-krantz-avenue, hampshire-way, holloway-terrace, laking-terrace, leger-way, locker-place, logan-drive, magnolia-terrace, main-street, melville-bonus-crescent, millside-drive, mockridge-terrace, moira-crescent, murlock-heights, murray-meadows-place, nadalin-heights, restivo-lane, riddell-crescent, sauve-street, savoline-boulevard, speyer-circle, stirling-todd-terrace, suitor-court, thames-circle, whitmer-street (all `-milton`).

3. **Regenerated through the standing runner, `scripts/regen-058-local.ts`, DeepSeek primaries, validator and fair-housing judge as normal, `REGEN_CAP_USD=5`.** Run 1: 30 passed, 7 failed closed (old rows kept). Run 2 re-ran the 7 on DeepSeek: 6 passed, 1 failed. Run 3 re-ran the last one with `REGEN_FALLBACK=opus` under `REGEN_CAP_USD=1`: DeepSeek failed again and the Opus escalation returned **400 "credit balance is too low to access the Anthropic API"**, so the fallback never ran. **Final: 36 of 37 regenerated and published, 1 fail-closed.** Every pass revalidated its page over HTTP (37 × 200) and `/streets` at the end. Cost **$0.3878** across the three runs ($0.3037 + $0.0733 + $0.0108), about $0.0105 a page.

4. **Retries.** 14 pages were clean on the first attempt of every half. 22 needed in-run validator retries (derry-road and murlock-heights used all five on one half). The judge refused a round on 16 pages, 20 refusals in all, every one on tenure characterisation, family status, buyer-class suitability or religion, and every refused page was rewritten and passed except the one below. The 7 that failed closed in run 1 and their signatures: farmstead-drive, ferguson-drive, savoline-boulevard (`invalid_json_shape` from DeepSeek, not a content fault), laking-terrace (`subk_range_reassembly`), leger-way and mockridge-terrace (the judge twice), millside-drive (`invented_cross_street`). Six passed on the second run.

5. **The one that stays: `millside-drive-milton`.** Fifteen eval attempts across three runs, and every one names "Dorset Park" in `differentPriorities`; the input's neighbourhood is `Old Milton` (cross streets Wilson Drive, Derry Road), so the validator is right by its rule. Same shape as jasper-street on 2026-09-05, which Opus did not fix either. Its old row stands, with two lease-by-month sentences that render-time suppression keeps off the page (`sentenceHasNumber` drops any sentence with a digit). **Core's call:** a scrub of those two sentences by hand, or a generator change; Content did not edit the row.

6. **Proof.** `find-lease-month.ts` re-run after: **1 of 691** (millside-drive), `scratchpad/mct002/after.txt`. Spot-check of gleave-terrace, holloway-terrace and magnolia-terrace: each rental read is now aggregate ("Three-bedroom homes on Gleave Terrace typically rent around $2,800 a month, while four-bedroom homes typically rent around $3,000 a month"; "four-bedroom homes on the street typically rent around $3,600 a month, a figure drawn from a small pool of leases"; "Two-bedroom homes on the street typically rent around $1,850 a month, a figure that has held across the leases recorded"), no hole, no month, no tenancy. Production serves all three with 200 and no `(rented|leased) … in <Month>` in the HTML.

7. **Named, not done: 11 more pages with the same defect in a shape MC-036's regex misses.** The finder's broader check (a dollar figure, a month and a lease word in one sentence) also flags bergamot-avenue, chretien-street, kennedy-circle, maple-avenue, ontario-street, raspberry-terrace, ruhl-drive, sycamore-garden, trudeau-drive, whitlock-avenue, woodley-crescent: "Recent leases include a two-bedroom condo at $2,150 in September 2026", "a four-bedroom detached at around $3,650 in September 2026". None of the 36 regenerated pages trips it. They were outside the 37 asked for, so they were not touched; `find-lease-month.ts --broad` lists them and the runner takes them with the same order-file shape for about $0.12. Say the word and Content runs them.

8. **No code changed.** The branch is main plus this task's records: `scratchpad/mct002/` (finder, spot-check script, order file, before and after lists, the three run logs and both JSONL logs), this report, `HANDOFF-content.md`, `QUEUE.md`. Condos untouched, as instructed (MC-037). No preview: nothing to build.

Report: scratchpad/reports/MCT-002-regenerate-lease-month-streets.md

---

## MCT-002, the 11 from item 7, run on the yes of 2026-09-21

CONTENT · D:\miltonly-content · feat/content-2

1. **`find-lease-month.ts --broad` returned 10, not 11.** `sycamore-garden-milton` was regenerated at `2026-09-22T00:01Z` by something outside this session (its row is on MC-036's prompt and clean), and the published count had moved from 691 to 710 in the meantime. The 10: bergamot-avenue, chretien-street, kennedy-circle, maple-avenue, ontario-street, raspberry-terrace, ruhl-drive, trudeau-drive, whitlock-avenue, woodley-crescent (`scratchpad/mct002/order-11.json`, `broad-before.txt`).

2. **Same runner, same gates, no escalation.** `REGEN_FALLBACK` unset (the runner deletes `AI_PROVIDER_FALLBACK`, so a half that exhausts its budget fails closed), `REGEN_CAP_USD=2`. Run 1: 7 passed, 3 refused by the fair-housing judge (maple-avenue, raspberry-terrace, ruhl-drive; 9 refusals in all across the two runs, every one family status, tenure or buyer class). Run 2, the one DeepSeek retry allowed: all 3 passed. **10 of 10 published, none left fail-closed.** Every pass revalidated its page (200) and `/streets`.

3. **Cost $0.0980** ($0.0794 + $0.0186). With the first set, **MCT-002 in all: $0.4858 for 47 pages regenerated, 46 published by this session**, DeepSeek only.

4. **Proof.** The finder after: **MC-036's test 0 of 710, the broader test 0 of 710** (`scratchpad/mct002/broad-after.txt`). The MC-036 zero includes `millside-drive-milton`, which this session never republished: its row still says `generatedAt 2026-09-13` and the two lease-by-month sentences are gone, so it was scrubbed by hand outside this session. Nothing in the corpus now names a leased price tied to a month.

5. **No code changed.** Records added under `scratchpad/mct002/` (`order-11.json`, `broad-before.txt`, `broad-after.txt`, `regen-11.jsonl`, `regen-11-run1.jsonl`, the two run logs); `HANDOFF-content.md` and `QUEUE.md` updated. Condos untouched.

Report: scratchpad/reports/MCT-002-regenerate-lease-month-streets.md

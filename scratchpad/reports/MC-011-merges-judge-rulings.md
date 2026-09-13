# MC-011
D:\miltonly · main

## MC-011: five merges landed, the three judge rulings built on `fix/judge-rulings`, 13 of the 15 failed k-crossed streets republished

### 1. Five merges by SHA, full gate: done

| SHA merged | merge commit | build | package.json |
|---|---|---|---|
| `25b59a6` feat/judge-verdict | **`9ba0811`** | exit 0 | clean |
| `db3be15` fix/comparator-park-mask | **`9c8b520`** | exit 0 | prebuild line unioned, 27 + 1 = 28 commands |
| `dde23bd` feat/video-rekey | **`e71a7f6`** | exit 0 | clean |
| `67fcf7f` fix/sold-sync-purge | **`625e000`** | exit 0 | prebuild line unioned, 28 + 1 = 29 |
| `3ec8b51` feat/menu-v2 (approved) | **`d01787f`** | exit 0 | clean; **the mega menu marked done in QUEUE.md** (`2a89120`) |

Each pushed in turn; production served each in turn; `prisma migrate status` clean at 27 (the `judgeVerdict` column was applied in MC-009). Production battery at `2a89120`, 23:05Z: **`PASS · 14 checks · 469 pages · 256s`**, exit 0, `served == expected` (the 14th check came in with the menu).

### 2. The three rulings, on `fix/judge-rulings` (`1b4ab5d`), built exit 0, pushed, not merged

**The investor question is out; a K-gated lease count is in.** `"Is {Street} a good fit for investors?"` leaves `FAQ_BANK_TEMPLATES`, the own-price withdrawal list and both prompt docs (`01-system-prompt.md`, `03-evaluative-prompt.md`). In its place `"How many homes on {Street} were leased in the last year?"`, offered only when `leaseActivity` is present and `aggregates.leasesCount >= K_ANON_PRICE` (`offersLeaseCountFaq`, withdrawn otherwise by `eligibleFaqTemplatesFor`); the prompt answers it as a count from `aggregates.leasesCount` and never as a share, percentage or ratio against sales, because a lease share blends the two pools and `mixed_pool_claim` forbids that. The INVESTOR cluster rule becomes the LEASE COUNT rule; the prompt shaper's zero-price branch withdraws it by its new name.

**The option, never the resident.** `03-evaluative-prompt.md` (gettingAround) and `01-system-prompt.md` (amenities) both carry a bolded rule: a commute or amenity sentence states what the street reaches and how far, never what residents do, use, prefer, rely on or build their day around, with the refused sentences of 09-11 as the examples not to write.

**One retry on an unparseable judge reply.** `judgeWithOneRetry(call)`: a reply with no complete JSON object (`{"pass": true, "findings`) is asked for once more; a second such reply, or any other error, fails closed; a parsed refusal is never retried. The caller is injectable, so `scripts/test-judge-rulings.ts` exercises truncated-then-clean, truncated-twice, parsed-refusal, clean-pass and transport-error without a model. The case (24 assertions) also holds the bank in the validator and both docs, the K gate on three fixtures, and both prompt rules; `test-zero-price-faq.ts` and `test-eval-prompt-shape.ts` updated for the renamed cluster. Prebuild now 30 guards.

**Preview `miltonly-mq4la8cnz` at `1b4ab5d`, battery:** **`PASS · 14 checks · 485 pages · 235s`**, exit 0, `served == expected` (the fifth run; the first four and the section below are why).

### 3. The 15 failed k-crossed streets, rerun on the rulings branch: 13 passed, 2 failed, $0.1549

Standing runner, DeepSeek only, `REGEN_CAP_USD=2`, judge verdicts persisted on every row.

**Republished (13):** cavanagh-lane, derry-road, etheridge-avenue, first-line, fowles-court, fox-crescent, manley-lane, maple-avenue, nadalin-heights, orr-terrace, rolph-terrace, rose-way, weston-drive. With the 8 from MC-009, **21 of the 23 crossed streets now publish on the repaired sample.** Judge on the 13: 7 passed round 1; 6 refused round 1 and passed round 2, the round-1 classes being `religion` ×3 ("For Catholic families, St. Francis Xavier Catholic SS…", "Catholic families have Guardian Angels…"), `family status` ×3 ("For families, the school options are broad.", "most of what a household needs sits within a ten-minute radius"), `buyer-class suitability` ×2 ("the narrower pool of buyers for larger detached properties"), `community-closeness proxies` ×1. `derry-road` and `rose-way`, refused last time on the investor question, passed with it gone. `nadalin-heights`, lost last time to a truncated reply, passed; no retry was needed this run (0 unparseable replies).

**Failed (2), prior page preserved:**
- `barclay-circle-milton`: judge, round 1 `"which suits short daily walks more than organized sport"` which the judge itself classed `[amenity fact, not a violation]` yet returned `pass: false`; round 2 `"a figure that speaks to the street's draw as a longer-hold address rather than a quick-turn rental"` `[tenure characterization]`.
- `gordon-krantz-avenue-milton`: `invalid_json_shape` on all five eval attempts, judge not run.

**Two things the verdicts now show that a ruling could take up:** "For Catholic families …" is how the model names the Catholic board's schools, and the judge reads it as `religion`; the prompt's "public board and Catholic board both covered" would be safer as "name the board, never the family". And barclay-circle's round 1 is a judge refusing with a finding it labels not a violation.

### The battery at a window edge, recorded so the next run is not misread

Between the 23:05Z production pass and the preview runs, the live record moved under the caches twice: the sold sync's 22:30Z writes (six inserts, four updates) and, at 00:00Z, the 12-month window's trailing edge passing nine 2025-09-12 rows. The homepage's neighbourhood typicals were served from an Upstash entry a pre-tag build had computed from an untagged Data Cache reply (`coates 945,000 / 119` against a live `940,000 / 119`, then `935,000 / 118` after midnight); `chretien-street` went from five sales to four in the window while its page held the k5 figures for the hour. **Production failed the same assertions at the same minute** (`battery-prod-2a89120-b.log`: `tiles` ×4 on chretien-street). None of it is the rulings branch, which changes the generator and the prompts only; all of it is the hour the caches hold at a window edge, on a build whose untagged Data Cache entries the new tag cannot reach until they age out. After the hour it still failed on `chretien-street`: the tagged Data Cache serves a stale reply once past its expiry (stale-while-revalidate), so the purge was applied by hand for that street (Upstash prefixes, the `db2` tag and the path, on production and the preview), `tiles` passed alone, and the full battery then passed. Read a FAIL after a window edge or a sold-sync write against production first; if production fails the same lines on code that passed an hour before, it is the caches, not the branch.

### Files
- main: `9ba0811`, `9c8b520`, `e71a7f6`, `625e000`, `d01787f`, `2a89120`, and this docs commit
- `fix/judge-rulings` `1b4ab5d`: `docs/phase-4.1/{01-system-prompt,03-evaluative-prompt}.md`, `src/lib/ai/{validateStreetGeneration,compliance,evalPromptShape}.ts`, `scripts/test-judge-rulings.ts`, `scripts/test-zero-price-faq.ts`, `scripts/test-eval-prompt-shape.ts`, `package.json`
- record: `scratchpad/mc003/k-cross-regen-2.jsonl`, `regen-kcross-2.log`, `battery-prod-2a89120.log`, `battery-rulings-preview-*.log`

### Next
`1b4ab5d` by SHA, your call. Then the Catholic-board phrasing ruling, `barclay-circle` and `gordon-krantz` on a later pass, and QUEUE item 6.

# MA-009
AUDIT · D:\miltonly-audit · feat/audit

## MA-009: the three Lighthouse regressions of 2026-09-22

Read-only. Nothing was fixed. Production at `c1565b7`; the three pages were re-measured 2026-09-22
evening with the nightly's exact Lighthouse flags (`scripts/audit/lh-repeat.mjs`, mobile 390 px,
simulated slow 4G, `--max-wait-for-load=45000`), three runs each. Raw output in
`scratchpad/audit/MA-009/`, untracked.

## The answer

**It is run-to-run noise, and the drop does not hold. Drop it.** The noise is not random across the
twelve pages: it lands on the first three Lighthouse runs of each night, which by the harness's fixed
order (`scripts/audit/nightly/run.mjs:47`, `FIXED = ['/', '/neighbourhoods/timberlea', ...STREETS]`
with `woodward-avenue-milton` first in `streets.json`) are exactly `/`,
`/neighbourhoods/timberlea` and `/streets/woodward-avenue-milton`. Those three slots are the three
pages reported as regressed, on every night this happens.

## The spread, three runs each

| page | nightly 09-22 | re-run 1 | re-run 2 | re-run 3 | median | spread |
|---|---|---|---|---|---|---|
| /neighbourhoods/timberlea | **42** | 94 | 94 | 95 | **95** | 1 |
| /streets/woodward-avenue-milton | **78** | 90 | 94 | 92 | **92** | 4 |
| / | **68** | 85 | 89 | 91 | **89** | 6 |

Metrics behind them, min to max over the three runs:

| page | LCP ms | TBT ms | FCP ms | total KB | script KB | DOM elements |
|---|---|---|---|---|---|---|
| /neighbourhoods/timberlea | 2884 to 2956 | 1 to 90 | 1208 to 1666 | 495 (flat) | 123 (flat) | 1829 (flat) |
| /streets/woodward-avenue-milton | 3042 to 3499 | 12 to 19 | 1383 to 1613 | 501 (flat) | 134 (flat) | 2183 (flat) |
| / | 2950 to 3048 | 128 to 173 | 1225 to 1297 | 3390 (flat) | 136 (flat) | 1892 (flat) |

The nightly's Timberlea numbers were LCP 5434 ms and TBT 3304 ms. Re-measured: LCP 2884 to 2956 ms
and TBT 1 to 90 ms, on the same content, with both of last night's changes live. Bytes, scripts and
DOM are identical run to run, so nothing about the page is varying; only the CPU-bound metrics move.

## Which resource moved: neither of the two named

**The analytics script did not move, because it never runs.** On all three pages, with four seconds
of settle time after `networkidle2`, **zero** requests to `/_vercel/insights`, `va.js` or any vitals
endpoint were made. The endpoint itself is live (`/_vercel/insights/script.js` answers 200, 2,054
bytes), so the component is deployed but is not injecting its script. The only third-party request on
the hub is the Facebook `noscript` pixel, a zero-byte image, and Lighthouse's `third-party-summary`
attributes **0 ms of blocking time** to everything on the page. The +5 to +6 KB that appeared on the
pages last night is bundled component code in the layout chunk, and it appeared **uniformly on all
twelve Lighthouse pages**, including the five that did not regress at all.

**The new prose did not move, because it shrank.** Timberlea was regenerated at 06:34:37Z
(`HubGeneration.generatedAt`, 792 words) and the nightly ran at 12:21:03Z, so the nightly did measure
the new copy, and so did these re-runs. Against the MA-005 capture of the same page on 2026-09-16:

| | 2026-09-16 | now | change |
|---|---|---|---|
| prose words (overview + market + FAQ) | 872 | 772 | **−100** |
| overview / market paragraphs | 5 / 3 | 5 / 3 | none |
| FAQ items | 6 | 7 | +1 |
| ladder rows | 24 | 29 | +5 (five streets published since) |
| document height | 14,298 px | 14,686 px | +388 px (+2.7%) |
| images | 34 | 34 | none |
| DOM elements | — | 1,886 | comfortably under Lighthouse's threshold |

**What did move is TBT, the CPU-bound metric**, while the page's weight stayed flat: Timberlea 56 →
3,304 ms with total bytes 489 → 495 KB. A 59× blocking-time move on a 1.2% weight change is a
property of the machine, not the document.

## Why the first three runs

Total blocking time on the first three Lighthouse runs against the median of runs 4 to 12, every
night on record:

| night | runs 1–3 TBT (/, timberlea, woodward) | runs 4–12 median | ratio |
|---|---|---|---|
| 2026-09-13 | 241, 427, 404 | 501 | 0.8× |
| 2026-09-17 | 375, 962, 442 | 510 | 0.9× |
| 2026-09-18 | 146, 188, 204 | 72 | 2.6× |
| 2026-09-20 | 205, 1534, 235 | 20 | 11.8× |
| 2026-09-21 | 267, 56, 102 | 25 | 4.1× |
| **2026-09-22** | **733, 3304, 568** | **45** | **16.3×** |

Since 09-18, when the site itself got fast enough for the runner's own variance to dominate, the
first three runs have carried 2.6× to 16.3× the blocking time of the rest. Lighthouse runs last in
the nightly, straight after the sweep, links and sample phases, so the first runs pay for a busy
runner and a cold Chrome. On 09-13 and 09-17, when every page was slow, the ratio was about 1: the
effect only shows once the pages are quick.

Night-over-night across all twelve pages, 09-21 to 09-22: seven down, five flat or up, every page
+5 or +6 KB. `beaver-court` 94 → 94, `sauve-street` 93 → 93, `bussel-crescent` 94 → 94,
`main-street` 90 → 90, `scott-boulevard` 85 → 86, all carrying the same bundle change. A change that
regressed the site would not skip five pages and then concentrate on slots one, two and three.

## Timberlea's own history, same harness

| night | 09-13 | 09-17 | 09-18 | 09-20 | 09-21 | 09-22 |
|---|---|---|---|---|---|---|
| perf | 78 | 70 | 92 | 66 | 93 | 42 |
| TBT ms | 427 | 962 | 188 | 1534 | 56 | 3304 |

The page moved **+27 points** on 09-21 with no relevant change, and the nightly logged that as an S4
move. The same instrument produced 66, then 93, then 42 on three consecutive measurements of a page
whose weight never left 489 to 495 KB. A single Lighthouse score from this harness is one sample of a
noisy process; it is not evidence on its own.

## Two things worth knowing, neither fixed here

1. **The Vercel Analytics script is deployed but not firing** on `/`, the hub or the street page.
   MH-009 and MC-038 shipped the component; no request reaches `/_vercel/insights`. Until that is
   resolved, the morning report's Traffic section will keep printing "awaiting first data", and no
   sessions, bounce or referrer data is being collected. Core or Home owns this; it is not an audit
   fix.
2. **The nightly does not record Lighthouse's `environment.benchmarkIndex`**, the CPU-speed figure
   Lighthouse measures on every run (2,046 on this machine tonight). Recording it per run, and
   treating a perf move as a finding only when the benchmark index is comparable, would have let the
   nightly answer this question itself instead of raising three S3s. A warm-up run discarded before
   the twelve would remove the slot effect. Both are changes to `scripts/audit/nightly/`, which this
   worktree owns, and are left for a task that is allowed to make them.

## Files

- `scripts/audit/lh-repeat.mjs`, tracked: Lighthouse N times over given pages with the nightly's
  flags, printing min, median, max and range per metric. Paths are passed without a leading slash
  (`--pages=neighbourhoods/timberlea,home`), because Git Bash rewrites a leading slash into a
  Windows path.
- `scratchpad/audit/MA-009/` (nine Lighthouse JSON reports, `repeat.json`, `hubgen.mjs`), untracked.
- `HANDOFF-audit.md` rewritten, `QUEUE.md` marked. No page, component, library file, route config or
  schema was edited, and nothing in `scripts/audit/nightly/` was changed.

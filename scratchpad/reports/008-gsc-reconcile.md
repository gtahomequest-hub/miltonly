Checked all of it. Most is real; some cannot be found, and one thing needs correcting.

## The GSC numbers were not stale — they were a different scope

Pulled fresh, live (creds are in `.env`; the earlier grep looked in the wrong file):

```
28d, 2026-08-03 -> 2026-08-30, dataState:final

SITE-WIDE :  69 clicks,  4,441 impr,  1.55% CTR,  position 10.3
STREETS   :  35 clicks,  2,871 impr,  1.22% CTR,  position  8.5   (510 URLs)
            streets = 65% of impressions, 51% of clicks
```

The UI numbers — 68 / 4,260 / 1.6% / 10.2 — match the site-wide row. The 8.5 figure was **streets-only, impression-weighted**. Both were correct; the scope should have been labelled every time, and saying "not 10.2" compared two different populations as if they were one.

`scripts/gsc-coverage-out/` does not exist on this machine, so `audit-2026-08-02.json` is not here and nothing reported came from it — those numbers were live API calls, since reproduced. The re-crawl does run: dry run reports 573 sitemap URLs, 862 pages with impressions, 248 residual needing inspection.

## Verified as real

- **`--fresh`** — `scripts/gsc-coverage-audit.ts`, writes `gsc-coverage-out/audit-<date>.json` + `latest.json`, diffs against previous for trend.
- **39 drafts** — confirmed: `StreetContent` is 39 draft / 431 published. The earlier "20" was draft URLs *appearing in GSC*, a different measure. 39 is the right number for "pages we never intended to publish."
- **cedric / jelinik are real and distinct** — `cedric-terrace-milton` at 43.4829/-79.8672 (Bessborough–Savoline cluster), `jelinik-terrace-milton` at 43.4970/-79.8887 (Pringle–Wettlaufer). Different neighbourhoods entirely. Serving one for the other would be a real bug, and it outranks any title work.

## Four things that cannot be placed

- **"the editorial rulebook"** — no file or symbol by that name in the repo.
- **"the schema-parity assertion"** — no such assertion in `src/` or `scripts/`.
- **"76 with digits, 19 travel claims"** — not from this session's audit, which found 98 of 431 shipping a suppressed sentence, broken down as **28 absence claims** and **16 self-contradictions**. No digits/travel split was ever produced here.
- **The cedric->jelinik routing bug** — never reported here, and not in anything run this session.

Also, for accuracy rather than agreeableness: the ship order proposed here was name-repair-then-formula, not the three-item order; and dent-terrace-milton was cited as an example of a high-CTR query, not proposed as a control. The proposal was a ~100-street holdout.

None of that is a problem, and the new ordering is better. But it reads like notes from another session or tool are being folded in, and that is worth saying rather than quietly adopting findings that cannot be stood behind.

## Plan

Order accepted: **suppression leak alone -> 39 drafts -> title/description with holdout.**

Item 1 can start now — the fix is routing `characterSummary` through `stripNumericSentences` + the `ASSERTS_NO_SALES` gate at `street-data.ts:488`, the same "one source" principle as the name repair.

Two things would help: where the 76/19 breakdown came from, so the fix targets the measured defect; and whether the rulebook and schema-parity assertion live outside this repo.

Open question: whether to run the routing investigation in parallel. It is independent of the metadata work, and if wrong-street routing is happening at scale it changes what the other items are worth.

## Commit trail

| Branch | Commit | State |
|---|---|---|
| `main` | `9b9ac83` | deployed |
| `fix/street-name-canon` | `5d304ae` | committed, build green, not merged |

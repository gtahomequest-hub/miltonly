Override gone — `da5e15a` on `feat/street-meta-ctr`. No code path references Bennett now; 427 of 428 streets are unaffected, and Bennett joins them.

The provenance is kept as a comment rather than deleted silently, so the next person reading that GSC report does not re-derive the same wrong conclusion. It now records what you found — including that the override's suffix (`Homes, Sales & Street Guide`) was never the same string as the formula it was cited as proving (`Homes, Prices & Sales History`), so the two were never one test. The general formula is explicitly labelled unvalidated rather than endorsed.

## Audit has now landed

It measured the things the design has to be built against:

- whether `src/app/layout.tsx` sets a `title.template`, which silently eats character budget on all 428 and decides how much room the formula actually has
- real char counts and truncation points for actual street names, short (`Ford Dr`) through long (`Rural Nassagaweya`)
- how many streets have a typical price versus falling back to the weaker hooks — that ratio decides whether a price-led formula is viable or strands hundreds of pages on a fallback
- `characterSummary` length distribution, since it is appended raw and is the likeliest truncation culprit
- how many published streets render the thin `StreetMinimalPage` while emitting metadata promising "the full street read"

Headline result: `src/app/layout.tsx:75` sets `template: "%s | Miltonly"`, and the street route returns a plain string, so " | Miltonly" (84px) is appended to all 431 titles. That alone pushes **265 of 431 (61.5%)** past Google's ~580px cut; without it only 12 (2.8%) would truncate. And 430 of 431 titles share a byte-identical 51-char tail, so ~76% of rendered pixels are boilerplate. Formula design follows.

## Two things that shape what gets proposed

**1.6% is probably not one number.** 4,260 impressions across 428+ pages averages ~10 per page per 28 days, and Bennett managed 38 in three months. That distribution is almost certainly long-tailed — a handful of pages carrying most impressions, hundreds at near-zero. A single formula change moves the aggregate only if the impressions are actually spread across the tail. Page-level GSC sorted by impressions would tell us whether we are optimising 428 pages or really about 20.

**Position 10.2 is an average across queries, not a rank.** If it is a mix of position-5 brand-ish queries and position-15 generic ones, the 2-3% benchmark does not apply cleanly, and the fix differs: winning at 5 is about the snippet, winning at 15 is about not being there at all. Worth splitting on the next GSC pull.

Neither blocks the design — the formula will hold up under either — but they change how much of the gap titles can realistically close.

## Commit trail so far

| Branch | Commit | State |
|---|---|---|
| `main` | `0e1871d` | deployed — nofollows + faceted self-demotion |
| `fix/signin-unblock` | `51a13cf` | committed, build + merge pending (repo root busy) |
| `feat/street-meta-ctr` | `da5e15a` | committed — Bennett override removed |

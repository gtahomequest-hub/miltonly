# Street-corpus verification battery

```bash
BASE=https://miltonly.com node scripts/verify/run.mjs
BASE=https://<preview>.vercel.app node scripts/verify/run.mjs
BASE=http://localhost:3000 node scripts/verify/run.mjs --only=denials,schema-parity
```

Exits `0` when every assertion holds, `1` otherwise. One entry point, one target, one crawl —
every check consumes the same pages.

Credentials come from the environment. `SOLD_DATABASE_URL` and `ANALYTICS_DATABASE_URL` are read
from the process env, falling back to the gitignored repo-root `.env` / `.env.local`; an exported
value always wins. Nothing in this directory contains a connection string, a token, or a host that
exists on one machine only. A missing credential fails loudly and by name — it must never read as
"no findings".

## The checks

| id | asserts |
|----|---------|
| `denials` | no sentence denies or contradicts a figure the same page publishes — price (a), band (b), sold-to-ask direction (c) — in **both** the visible prose and the JSON-LD |
| `schema-parity` | the structured data publishes exactly what the page publishes, per page; a zero-FAQ page emits neither heading nor `FAQPage` node |
| `claims` | the set of pages claiming absence **is** the set of streets with no sale on record, in both directions; every page has a wired CTA and a stated sample |
| `tiles` | every published figure is floored against the sample it was computed over, and the basis line names that sample |
| `consistency` | one metric, one number, across hero / glance / sidebar / type card / CTA / market card; no FAQ answer opens on a cut antecedent; no section is all caveat |
| `composition` | every published page is a street in the Town registry or on the off-registry allowlist, and nothing is on neither |
| `hub-meta` | every hub's SERP description states the live aggregate its own body states — same price, same sale count, same silence below k |

## The rules these encode

Written down because each one was learned by a gate reporting the wrong answer with total
confidence.

**Assert values, not presence.** "A price is rendered" is not a check. *Which* price, computed over
*which* sample, matching *which* other surface — those are checks.

**State coverage alongside every finding.** "Found no denials" and "read no prose" print
identically, and only one is good news. Every check reports what it *read* next to what it
*found*; a parser that reaches nothing fails on its own coverage assertion. A detector that
silently matched zero containers once reported a clean corpus.

**Derive expected values. Never a literal.** `iterated == 431` survived long after the sitemap
moved to 426, and a frozen number produces a false PASS exactly as easily as a false FAIL. Both
sides of every assertion are derived at run time, from independent sources: the published side
from the live sitemap at `BASE`, the record side from DB2. The corollary: a mechanical
find-and-replace that swaps a literal for a variable is not a fix — one such rewrite substituted
`slugs.length` into two scripts without binding `slugs`, and they threw `ReferenceError` before
printing a line.

**Derive populations. Never a frozen list.** A roll-call of "the 14 streets that were failing"
cannot grow: a fifteenth acquiring the same defect prints nothing and the gate reads clean. The
population is a query — *every page with a sale on record*, *every page publishing a band* — and
the assertion runs over whatever that returns today.

**Compare as displayed, on whole tokens.** A figure is evidence about what was published only if
it is distinguishable once published: two averages that round to the same display step are not a
finding, which is what made 19 clean pages look like sub-k publications. And compare whole money
tokens — `"$1.1M".includes("1M")` is `true`.

**Read discrete containers. Never a tag-stripped document.** Strip every tag off a page and split
on sentence punctuation and the stat grid, which has no punctuation, becomes one 1,005-character
"sentence" — so a k-anon label on one tile ("sample too small") lands beside a price on another and
reports a denial no sentence makes. Structured data is *parsed* and walked per text field, not
joined into a blob.

**Every published surface is checked.** JSON-LD is output. It was sourced from the raw generation
record while the visible page was built from the suppressed view, so 1,240 answers already
suppressed for readers were still being served to Google across 375 of 426 pages. Schema parity is
asserted **per page**: two corpus totals can match while individual pages differ.

**Assert the deployment by behaviour.** Crawl the deployed target and read what it serves. Asset
fingerprints, build hashes and commit SHAs all silently pass on a server-only change.

**Two sides, two implementations.** These checks deliberately re-derive what the render layer
computes rather than importing it. A guard verified against its own predicate verifies nothing.

**A stored number is a number that has already drifted.** Anything computed once and written down
— a street tile, a hub meta description — is describing the market of the day it was written, and
every later reader gets that day. The hub descriptions were 16-of-22 wrong on price and 21-of-21
wrong on sale count, always high, and two of them published a typical price off a 3- and a 4-sale
pool that their own bodies correctly suppressed. So the assertion is never "the two stored strings
agree"; it is "the published surface equals the aggregate recomputed right now", asserted
separately on every surface that publishes it — body, meta, and JSON-LD. `hub-meta` reports the
stored strings' drift as a `NOTE`, because the retired path is evidence, not an expectation.

**A suppression that holds on one surface is not a suppression.** k-anon is a property of the
figure, not of the template that happens to render it. Check every surface, and check that
silence is *shared*: `hub-meta` fails a hub whose hero tile is silent while its meta states a
price, in either direction.

**Known defects are reported, not asserted.** A standing failure wired into a gate makes the gate
permanently red, and a permanently red gate hides the next regression. Log it as a `NOTE` with the
page names — see `1c` in `consistency`.

## Layout

```
run.mjs              entry point: derive the page set, crawl once, run every check, summarise
lib/env.mjs          credentials from the environment; repo-root .env fallback; fail by name
lib/http.mjs         one target for every request; sitemap-derived page set; the shared crawl
lib/parse.mjs        rendered-page parsers — discrete containers, parsed schema
lib/money.mjs        display rounding and whole-token comparison
lib/db.mjs           the other side of every assertion, derived from the record
checks/*.mjs         { id, title, perPage(slug, html, ctx), finish(rows, ctx) }
```

A check returns `{ coverage: [[label, value]], assertions: [[label, actual, expected]], notes,
examples }`. Add one by dropping a file in `checks/` and importing it in `run.mjs`.

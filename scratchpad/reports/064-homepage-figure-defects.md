HOME · D:\miltonly-home · feat/homepage

# 064 — The picked title and H1, and two figures that were wrong

Code SHA **`1f495e8`**. Not merged.

**Preview: https://miltonly-nlr4rvlrr-gtahomequest-hubs-projects.vercel.app**
Battery on it: **`PASS · 10 checks · 444 pages · 64s`**, exit 0, `build 1f495e8 served == expected`.
Local: `pnpm build` exit 0, zero `P2024`, 19/19 prebuild, 546 static pages.

---

## Shipped: title and H1

| | |
|---|---|
| Title | `Milton Homes for Sale, Street by Street` (39 chars) |
| H1 | `What Milton homes actually sell for,` / `street by street` |

Both are now set on the page. The title was inherited from the root layout at 101
characters ending in " | Miltonly"; the canonical for `/` was also arriving by layout
inheritance rather than being declared. Both are explicit in `src/app/page.tsx` now.
Verified served: `<title>Milton Homes for Sale, Street by Street</title>`,
`<link rel="canonical" href="https://miltonly.com"/>`.

One design consequence worth recording. The hero's two faces swapped roles. The script
face (Kaushan) previously carried the single word "Milton" at up to 88px; a six-word
sentence set in a script face is decoration, not a heading, so the long claim took the
serif at `clamp(30px, 4.6vw, 56px)` and the short method line took the script. Both stay
solid white; the nav wordmark remains the site's only gradient.

---

## Defect 1: sold-to-ask rendered as `0.980868783307145%`

**What it was.** `BoardTab.soldToAsk.value` is a RATIO. `TheBoard` multiplies it by 100 at
render (`pct1`), which is why the Board tile reads "98.1%". The proof point took the same
field and welded a percent sign onto the raw number. My defect, introduced with the
section.

**The fix, per the ruling: the same aggregate the market page publishes.** The proof point
now reads `soldToAskPct` from `getMiltonSoldOverall()` — the all-Milton, 12-month, k-gated
aggregate `/sold` publishes, which is already a percent — and rounds it to a whole number.
Rendered: **98%**. Record side: 98.3.

Note the two figures are not the same aggregate and should not be expected to match: the
Board publishes **98.1% over urban Milton, 13 weeks**; `/sold` and now this proof point
publish **98.3% over all Milton, 12 months**. Each states its own scope beside it.

**The unit now travels in the name.** `soldToAsk` did not say what it was; `soldToAskPct`
does. That is the actual lesson: the field crossed a component boundary carrying a unit
only its original renderer knew about.

**The overlap.** The figure column was a fixed `128px`. A fixed track holds only while every
value stays inside it, which is a promise about data that no stylesheet can keep — so when
the value grew to eighteen characters it sat on top of its own label. The column is now
`minmax(0, max-content)` with the label at `minmax(0, 1fr)` and `min-width: 0`, and the
figure wraps inside its own track. A malformed value would now be ugly and legible rather
than overlapping, and the gate below is what stops it being malformed at all.

---

## Defect 2: "738 Milton streets with their own page"

**What 738 counted.** `surfacedStreetWhere()`: `isResidential AND (recencyWeightedSold > 0
OR a published StreetContent row)`. That is the **surfacing predicate** — the set of street
entities allowed to appear in hero search, in autocomplete and in a hub's street ladder.
Measured today: **687** entities with sold history, unioned with the **445** published
content rows, giving **738**. It is a real and useful number, and it counts streets the
site can say something about. It has never been a count of pages.

**Three surfaces were counting three different sets under one word:**

| Surface | Said | Counted |
|---|---|---|
| `sitemap.ts` | 444 URLs | published `StreetContent` ∩ existing `ResidentialStreet` |
| `/streets` | "445 full street reports published" | published `StreetContent` rows |
| homepage | "738 streets with their own page" | surfaced entities |

The 445-vs-444 gap is one row: **`15-side-road-side-road-milton`**, a published content row
with no `ResidentialStreet` entity behind it. It is a machine-made address artifact, and
`sitemap.ts` already refused it deliberately — its own comment names it alongside
`wood-close-n-a-milton`.

**The fix.** `publishedStreetPageSlugs()` in `src/lib/streetSurface.ts` is now the single
definition of that set, and `sitemap.ts`, `/streets` and the homepage all read it. The
sitemap's intersection logic is unchanged; only its home moved. All three now say **444**.

The homepage sentence says what it counts: **"444 Milton street pages published, each one
researched and kept current."** The footer link is "All 444 street pages" for the same
reason.

---

## Defect 3: the gate passed with both defects on the page

This is the one that matters, because it is the reason the other two reached a preview.

**What was wrong with it.** It asserted PRESENCE: that a `data-fig` element existed and that
its `data-value` parsed as a number. Presence is not value. Both defects satisfied every
assertion it made, under a check titled "the homepage links, **states its figures**, and
declares itself".

**Worse, `data-value` was correct in both cases.** The components knew the right numbers.
The fault lived between the value and the reader — in the formatting, and in which query the
value came from. That span is exactly what an attribute cannot cover, so the check now reads
the **rendered text**.

**What it does now.** `loadHomeRecord()` in `scripts/verify/lib/db.mjs` recomputes all seven
Milton-wide figures from the databases the page reads. Each figure declares its source
query, its display format and its display tolerance:

| figure | source | format | tolerance |
|---|---|---|---|
| `on-market` | DB1 active, permAdvertise | integer | 0 |
| `new-week` | DB1 active, Milton, sale side, 7 days | integer | 0 |
| `sold-mtd` | DB2 month to date | integer | 0 |
| `typical-milton` | DB2 12-month midpoint, round5k | `$NNNK` / `$N.NNM` | 500 |
| `proof-street-pages` | published pages, the sitemap's set | integer | 0 |
| `proof-sales-12mo` | DB2 12-month count | integer | 0 |
| `proof-sold-to-ask` | `getMiltonSoldOverall` | `NN%`, whole number | 0.5 |

Tolerance is display granularity, not a fudge factor: `$930K` cannot carry more precision
than the nearest thousand, so 500 is the most it can honestly differ by. Counts get 0.
The streets figure also gets its own named assertion, because "which set does this count"
is the question it got wrong, not "is it formatted".

One parser bug was fixed on the way. The figure reader stopped at the first `</` in the
document, so the hero's `<b>$</b>930K` yielded the text `"$"`. Any value assertion built on
that would have been comparing against nothing. It now reads to the element's own closing
tag and strips React's `<!-- -->` text-node separators.

### Red, then green

**Red against the current preview** (`3a1aced`, `--only=homepage`) — honest but weak:

```
FAIL  Milton-wide figures absent from the page: 3 (expected 0)
FAIL  street-page figure == the published page count: false (expected true)
      proof-street-pages: no element carries this data-fig
      proof-sold-to-ask: no element carries this data-fig
```

That build's proof points carried no `data-fig` at all, so the extension reports them as
absent rather than malformed. It goes red, but it does not by itself prove the format
assertion catches the defective strings.

**So: red against a fixture carrying both defect strings verbatim.** The fixed page's HTML
with `0.980868783307145%` and `738` substituted back in, served locally so the check ran
against it end to end:

```
FAIL  Milton-wide figures rendered in the wrong format: 1 (expected 0)
FAIL  Milton-wide figures outside their source + tolerance: 1 (expected 0)
FAIL  street-page figure == the published page count: false (expected true)
      proof-sold-to-ask: rendered "0.980868783307145%", which is not a /^\d{1,3}%$/
      proof-street-pages: page shows "738" (738) vs source 444, tolerance 0
      street-page figure shows 738 vs 444 published pages
```

**Green on the preview** (`1f495e8`), all 14 assertions:

```
· as rendered: on-market: "448" (source 448, expected "448") · new-week: "45" (source 45,
  expected "45") · sold-mtd: "23" (source 23, expected "23") · typical-milton: "$930K"
  (source 930000, expected "$930K") · proof-street-pages: "444" (source 444, expected
  "444") · proof-sales-12mo: "1,531" (source 1531, expected "1,531") · proof-sold-to-ask:
  "98%" (source 98.3, expected "98%")
PASS  Milton-wide figures absent from the page: 0
PASS  Milton-wide figures rendered in the wrong format: 0
PASS  Milton-wide figures outside their source + tolerance: 0
PASS  street-page figure == the published page count: true
```

---

## One build failure, diagnosed and not mine

The first preview of `1f495e8` (`ovc9j3lca`) failed. It was **not** the diff:

```
[canonicalization-regression] error: PrismaClientInitializationError:
Can't reach database server at `ep-patient-paper-aebh7f93-pooler.c-2.us-east-2.aws.neon.tech:5432`
```

That is the FIRST prebuild test, which reads `StreetGeneration` and touches none of the
changed files, failing at connection level before any changed code runs. The same commit
built locally at exit 0 with 19/19. A redeploy of the same commit succeeded in 2m and is the
preview above. Isolated and transient, so the run continued.

---

## Still open

- **Not merged.** Aamir reviews the preview.
- **`on-market` counts more than its label implies.** `buildMiltonWideContext` counts
  `permAdvertise AND status='active'` with **no city filter and no transaction-type
  filter**, so "on the market today" would include leases and any non-Milton row. It happens
  to be exactly right today — 448 either way, because there are no such rows right now — so
  this is a latent definition problem, not a live wrong figure. The gate asserts against the
  query the app actually runs, deliberately, so it is a drift gate rather than a redesign.
  Flagging for a decision rather than changing a live figure unasked.
- **Daily-brief consent is sent but not persisted.** Unchanged, Leads owns it.
- **380px is sized for, not visually verified.**

# 058 — Corpus grounding audit

_2026-09-04. Part 1 (measurement) and Part 2 (takedown). No LLM calls in Part 1._

Tooling: `scripts/audit-corpus-grounding.ts`, read-only. Raw output
`scratchpad/audit/058-corpus-audit.json`, full flagged table `scratchpad/audit/058-table.md`
and reproduced below.

---

## The finding that governs everything else

**The brief asks for each generation to be scored against "its stored input". There is no
stored input.** `StreetGeneration` persists `sectionsJson`, `faqJson` and a 12-character
`inputHash` — not the payload. The only way to obtain an input for a row is
`buildGeneratorInput(slug)`, which reads **today's** database.

So every row here is scored against a rebuilt input, and the rebuilt hash was compared with
the stored one to measure how far that is from the real thing:

**474 of 474 audited rows have a hash mismatch. Not one row can be scored against the input
it was actually written from.**

A 100% mismatch is not 474 streets whose market moved. `StreetGeneratorInput` has gained
fields since April (`neighbourhoodComparable`, `directionalStats`, `leaseActivity.rangeStats`
among them), and a shape change moves every hash at once. The hash therefore cannot separate
value drift from schema drift, and it cannot be repaired retroactively.

**Consequence: this audit measures whether a page grounds against today's data. It cannot,
for any row, prove that a figure was fabricated when it was written.** That distinction is
the whole of Part 2 and it is why the takedown below is 7 pages and not 154.

---

## 1. Counts

| | |
|---|---|
| `StreetGeneration` rows, all statuses | **479** |
| — `succeeded` | 241 |
| — `failed` | 238 |
| input could not be rebuilt (`NoCentroidError`) | 5, listed below |
| rows audited | **474** |
| rows flagged, audit-wide | **387** |
| rows flagged that today's shipped validator would reject | **329** |
| of those, `published` + `succeeded` | **154** (of 220 such rows) |

Five rows have no rebuildable input and were not scored. All five are unreachable pages
already — four have no `StreetContent` row at all, one is `unpublished`:

```
106-rottenburg-court-milton     no content row
106-rottenburg-crt-milton       no content row
attenborough-trail-milton       no content row
campbellville-avenue-milton     no content row
clitherow-drive-milton          unpublished
```

## 2. Breakdown by rule

Findings, not pages. "beyond gate" means the audit ran the rule wider than the shipped
validator does — the brief asked for `numeric_ungrounded` **across all tiers**, where the
shipped rule scopes non-market dollars to `kAnonLevel !== "full"`, and for the DOM rule
everywhere, where the shipped rule is market-section-only.

| rule | as the gate scopes it | beyond the gate | total |
|---|---:|---:|---:|
| `zero_tier_price` | 48 | 0 | 48 |
| `numeric_ungrounded` (dollar) | 1171 | 136 | 1307 |
| `tier_band` | 90 | 17 | 107 |
| `dom` | 103 | 358 | 461 |

Pages, `published` + `succeeded` only:

| rule | pages |
|---|---:|
| `zero_tier_price` | **7** |
| `numeric_ungrounded` | 148 |
| `tier_band` | 28 |
| `dom` | 36 |

## 3. Why 154 is not a defect count

Three independent measurements say most of the 154 is input drift, not fabrication.

**a. The flag rate decays with recency.** Same rules, same corpus, split by when the row was
generated (`published` + `succeeded`):

| generated | gate-flagged / total |
|---|---|
| 2026-05 | 32 / 36 |
| 2026-06 | 46 / 55 |
| 2026-07 | 43 / 51 |
| 2026-08 | 30 / 43 |
| 2026-09 | **3 / 35** |

A defect rate does not fall from 89% to 9% because of the month it was written in. A page
scored against data four months newer than its own does.

**b. The recurring figures are comparator values, and comparator values are in the input.**
`crossStreets[].typicalPrice` is part of `StreetGeneratorInput` and is collected by
`collectInputPrices`. Across flagged published pages:

| token | distinct streets |
|---|---:|
| `$1.8M` | 44 |
| `$1.6M` | 34 |
| `$1.1M` | 25 |
| `$310,000` / `$310K` | 31 |
| `$1M` | 10 |

Forty-four pages saying "Wettlaufer Terrace trades around $1.8M" is the signature of a real
input value repeated, not forty-four independent inventions — a fabricating model produces
scattered figures, not one figure forty-four times. Those pages are citing a comparator whose
price, or whose membership in the comparator set, has since moved.

**c. The DOM findings collapse the same way.** 103 of 461 sit inside the gate's scope, and the
common shape is `DOM 91 ≠ input 0` — the street has no sales in today's 12-month window at
all, so there is no DOM to match. Near-misses (`80 ≠ 87`, `67 ≠ 73`) are the rest. Neither is
an invention.

## 4. What survives the drift argument

One rule self-gates on a condition drift cannot manufacture cheaply: `zero_tier_price` fires
only when the input carries **no price at any grain** — no street typical, no range, no
neighbourhood comparable figure, no lease data. When there is nothing in the payload a
currency amount could cite, every currency amount in the prose is ungrounded by construction.

This is the rule that caught `first-line-milton` on 2026-09-04, whose `$1.5M` was confirmed
invented by inspection. **Seven published pages are in that state**, and one of them repeats
`first-line`'s sentence verbatim, figure included.

```
15-side-road-side-road-milton   zero   FAQ "$1.5M"    "…area, comparable homes trade around $1.5M"
country-lane-court-milton       zero   FAQ "$1.1M"
wood-close-milton               zero   FAQ "$1.1M" + neighbourhoodComparable "$1.3M"
geddes-landing-milton           zero   homes "$800,000" + FAQ "$1.1M"
esquesing-line-milton           zero   neighbourhoodComparable "$1.9M" + FAQ "$1.94M"
coates-drive-milton             thin   6 figures across market, comparable, differentPriorities, FAQ
jasper-street-milton            thin   8 figures across homes, comparable, bestFitFor, differentPriorities, FAQ
```

Eleven further rows carry `zero_tier_price` and are **not** live: one `failed`, two `draft`
or `unpublished`, eight with no `StreetContent` row. No action needed on those.

## 5. Part 2 — taken down

**7 pages**, the `zero_tier_price` set above. Each set to `status=draft`, `publishedAt=null`,
`reviewNotes="corpus audit 2026-09-04: zero_tier_price"`, then `/streets/<slug>` and `/streets`
revalidated on production.

The other 147 gate-flagged published pages were **not** taken down. Section 3 is the reason:
the signal on them is dominated by comparator and window drift, they are 33% of a 445-page
site, and a takedown on a signal this contaminated costs more than it fixes. They need a
decision on scope, not a script.

## 6. The 387-row flagged table

`zero_tier_price` rows first, then published, then alphabetical. Counts are findings.

| slug | gen status | page status | generatedAt | kAnon | sales | zero_tier | num_ungrounded | tier_band | dom | gate? |
|---|---|---|---|---|---|---|---|---|---|---|
| `15-side-road-side-road-milton` | succeeded | published | 2026-07-30 | zero | 0 | 1 | 1 |  |  | yes |
| `coates-drive-milton` | succeeded | published | 2026-06-28 | thin | 0 | 6 | 6 |  | 2 | yes |
| `country-lane-court-milton` | succeeded | published | 2026-05-31 | zero | 0 | 1 | 1 |  |  | yes |
| `esquesing-line-milton` | succeeded | published | 2026-06-01 | zero | 0 | 2 | 2 |  | 3 | yes |
| `geddes-landing-milton` | succeeded | published | 2026-08-01 | zero | 0 | 2 | 2 |  |  | yes |
| `jasper-street-milton` | succeeded | published | 2026-05-27 | thin | 1 | 8 | 6 | 2 |  | yes |
| `wood-close-milton` | succeeded | published | 2026-05-31 | zero | 0 | 2 | 2 |  |  | yes |
| `first-line-nassagaweya-line-milton` | failed | unpublished | 2026-08-31 | zero | 0 | 1 | 1 |  |  | yes |
| `lerchie-way-milton` | succeeded | draft | 2026-06-26 | zero | 0 | 1 | 1 |  |  | yes |
| `lloyd-landing-n-a-milton` | succeeded | _no row_ | 2026-07-05 | zero | 0 | 1 | 1 |  |  | yes |
| `mcdougall-cross-milton` | succeeded | _no row_ | 2026-07-05 | zero | 0 | 7 | 7 |  | 1 | yes |
| `miltonbrock-crescent-milton` | succeeded | _no row_ | 2026-06-03 | zero | 0 | 1 | 1 |  |  | yes |
| `nippising-road-milton` | succeeded | _no row_ | 2026-05-31 | zero | 0 | 2 | 2 |  |  | yes |
| `restivo-line-milton` | succeeded | _no row_ | 2026-05-27 | zero | 0 | 3 |  | 3 |  | yes |
| `symons-cross-milton` | succeeded | _no row_ | 2026-05-27 | thin | 0 | 4 | 4 |  | 1 | yes |
| `watercres-way-milton` | succeeded | _no row_ | 2026-06-28 | zero | 0 | 1 | 1 |  |  | yes |
| `wetenhall-landing-n-a-milton` | succeeded | _no row_ | 2026-07-20 | zero | 0 | 3 | 3 |  |  | yes |
| `wood-close-n-a-milton` | succeeded | unpublished | 2026-07-25 | zero | 0 | 2 | 2 |  |  | yes |
| `aird-court-milton` | failed | published | 2026-08-31 | full | 7 |  | 7 |  | 1 | yes |
| `alder-gate-milton` | succeeded | published | 2026-07-30 | thin | 1 |  | 4 |  | 1 | yes |
| `amos-drive-milton` | failed | published | 2026-08-30 | thin | 1 |  | 1 |  |  | yes |
| `anderson-avenue-milton` | failed | published | 2026-08-30 | thin | 1 |  | 2 |  | 2 | yes |
| `andrews-trail-milton` | succeeded | published | 2026-06-28 | full | 5 |  | 3 |  | 1 | no |
| `apple-terrace-milton` | failed | published | 2026-08-31 | full | 6 |  | 9 |  | 1 | yes |
| `armstrong-boulevard-milton` | succeeded | published | 2026-06-02 | thin | 2 |  | 3 |  | 1 | yes |
| `asleton-boulevard-milton` | failed | published | 2026-08-31 | full | 11 |  | 3 |  | 2 | yes |
| `aspen-terrace-milton` | succeeded | published | 2026-07-05 | full | 5 |  | 4 |  | 2 | yes |
| `banting-court-milton` | failed | published | 2026-08-31 | thin | 3 |  | 10 |  | 1 | yes |
| `barclay-circle-milton` | failed | published | 2026-08-31 | thin | 4 |  | 12 | 2 | 2 | yes |
| `barr-crescent-milton` | succeeded | published | 2026-07-05 | thin | 2 |  | 1 |  | 2 | yes |
| `bartleman-terrace-milton` | failed | published | 2026-08-31 | thin | 2 |  | 4 |  | 2 | yes |
| `basswood-crescent-milton` | failed | published | 2026-08-30 | thin | 4 |  |  |  | 2 | yes |
| `baverstock-crescent-milton` | succeeded | published | 2026-06-01 | full | 5 |  | 2 |  | 1 | no |
| `beam-court-milton` | succeeded | published | 2026-09-04 | thin | 3 |  |  |  | 1 | no |
| `beasley-terrace-milton` | failed | published | 2026-08-31 | thin | 3 |  | 2 |  |  | yes |
| `beaty-trail-milton` | succeeded | published | 2026-08-02 | thin | 3 |  | 5 |  | 1 | yes |
| `beaver-court-milton` | failed | published | 2026-08-30 | thin | 4 |  | 9 | 1 |  | yes |
| `bell-street-milton` | failed | published | 2026-08-31 | thin | 4 |  | 4 |  | 3 | yes |
| `bellflower-court-milton` | succeeded | published | 2026-07-26 | full | 5 |  | 4 |  |  | no |
| `belmore-court-milton` | failed | published | 2026-08-31 | thin | 3 |  | 1 | 3 | 3 | yes |
| `bennett-boulevard-milton` | failed | published | 2026-08-31 | thin | 3 |  | 4 |  | 1 | yes |
| `bergamot-avenue-milton` | succeeded | published | 2026-08-02 | thin | 4 |  | 8 |  | 2 | yes |
| `bessborough-drive-milton` | failed | published | 2026-08-31 | full | 7 |  | 4 |  |  | no |
| `bessy-trail-milton` | succeeded | published | 2026-07-05 | thin | 2 |  | 4 |  | 1 | yes |
| `bews-landing-milton` | succeeded | published | 2026-06-01 | thin | 3 |  | 4 |  |  | yes |
| `blacklock-street-milton` | succeeded | published | 2026-07-25 | zero | 0 |  | 1 |  |  | yes |
| `blinco-terrace-milton` | succeeded | published | 2026-08-02 | thin | 1 |  | 2 |  |  | yes |
| `bonin-crescent-milton` | failed | published | 2026-08-31 | thin | 2 |  | 6 |  | 2 | yes |
| `boyd-lane-milton` | failed | published | 2026-08-30 | thin | 3 |  | 3 |  | 2 | yes |
| `brassard-circle-milton` | succeeded | published | 2026-06-02 | thin | 2 |  | 4 |  | 1 | yes |
| `britannia-road-milton` | succeeded | published | 2026-08-02 | thin | 1 |  | 4 |  |  | yes |
| `britton-crescent-milton` | failed | published | 2026-08-30 | thin | 1 |  | 5 |  | 2 | yes |
| `broadway-avenue-milton` | succeeded | published | 2026-06-28 | thin | 1 |  |  |  | 3 | yes |
| `buckeye-court-milton` | failed | published | 2026-08-30 | thin | 2 |  | 6 |  | 2 | yes |
| `buckthorn-garden-milton` | succeeded | published | 2026-09-03 | thin | 2 |  |  |  | 1 | no |
| `buttercup-court-milton` | succeeded | published | 2026-08-02 | thin | 1 |  | 8 |  | 1 | yes |
| `cahoun-terrace-milton` | failed | published | 2026-08-31 | zero | 0 |  | 8 |  | 2 | yes |
| `caldwell-crescent-milton` | failed | published | 2026-08-31 | zero | 0 |  | 1 |  |  | yes |
| `calla-point-milton` | succeeded | published | 2026-05-27 | thin | 0 |  | 1 | 1 | 1 | yes |
| `campbell-avenue-milton` | succeeded | published | 2026-09-03 | thin | 3 |  | 4 |  |  | yes |
| `campbellville-road-milton` | failed | published | 2026-08-30 | thin | 1 |  | 2 |  |  | yes |
| `cargill-path-milton` | failed | published | 2026-08-31 | full | 6 |  | 2 |  |  | no |
| `cavanagh-lane-milton` | failed | published | 2026-08-31 | full | 8 |  | 2 |  | 1 | no |
| `caverhill-crescent-milton` | succeeded | published | 2026-08-02 | full | 5 |  |  | 2 |  | no |
| `cedar-hedge-road-milton` | failed | published | 2026-08-31 | thin | 1 |  |  |  | 1 | no |
| `celandine-terrace-milton` | succeeded | published | 2026-06-28 | thin | 3 |  |  |  | 2 | no |
| `centennial-forest-drive-milton` | succeeded | published | 2026-08-02 | full | 10 |  | 5 |  | 1 | no |
| `challinor-terrace-milton` | failed | published | 2026-08-31 | thin | 2 |  | 5 |  | 1 | yes |
| `chambers-place-milton` | failed | published | 2026-08-24 | zero | 0 |  | 2 |  |  | yes |
| `chapman-crescent-milton` | failed | published | 2026-08-31 | thin | 4 |  | 2 |  | 3 | yes |
| `childs-drive-milton` | failed | published | 2026-08-24 | full | 10 |  | 7 |  | 1 | yes |
| `chretien-street-milton` | succeeded | published | 2026-09-04 | full | 5 |  |  |  | 1 | no |
| `christie-circle-milton` | succeeded | published | 2026-06-28 | thin | 2 |  | 7 |  | 1 | yes |
| `clark-boulevard-milton` | succeeded | published | 2026-07-26 | full | 7 |  | 1 |  | 1 | no |
| `clifford-point-milton` | succeeded | published | 2026-09-04 | thin | 0 |  | 2 |  | 1 | yes |
| `clitherow-street-milton` | succeeded | published | 2026-08-02 | thin | 4 |  | 4 |  | 1 | yes |
| `clover-park-crescent-milton` | failed | published | 2026-08-31 | thin | 1 |  | 3 |  |  | yes |
| `cochrane-terrace-milton` | succeeded | published | 2026-06-09 | thin | 2 |  | 2 |  | 3 | yes |
| `collis-court-milton` | failed | published | 2026-08-30 | thin | 1 |  | 6 |  | 3 | yes |
| `colville-place-milton` | succeeded | published | 2026-05-27 | thin | 2 |  | 3 |  |  | yes |
| `commercial-street-milton` | succeeded | published | 2026-08-02 | thin | 2 |  | 6 |  | 1 | yes |
| `connors-landing-milton` | succeeded | published | 2026-07-05 | thin | 1 |  | 1 |  |  | yes |
| `conway-court-milton` | succeeded | published | 2026-05-31 | thin | 1 |  | 4 |  | 1 | yes |
| `cooke-crescent-milton` | succeeded | published | 2026-07-19 | thin | 3 |  | 4 | 1 | 1 | yes |
| `cookman-drive-milton` | succeeded | published | 2026-06-28 | thin | 1 |  | 2 |  | 3 | yes |
| `coombs-court-milton` | failed | published | 2026-08-31 | zero | 0 |  | 9 |  | 3 | yes |
| `cooper-avenue-milton` | failed | published | 2026-08-23 | thin | 3 |  | 10 |  | 3 | yes |
| `copley-court-milton` | succeeded | published | 2026-06-01 | thin | 2 |  | 4 |  | 2 | yes |
| `costigan-road-milton` | succeeded | published | 2026-08-02 | full | 15 |  | 3 | 6 | 2 | yes |
| `coulson-avenue-milton` | failed | published | 2026-08-31 | full | 5 |  | 5 |  | 1 | yes |
| `cousens-terrace-milton` | failed | published | 2026-08-31 | thin | 3 |  | 4 |  |  | yes |
| `crawford-crescent-milton` | failed | published | 2026-08-31 | thin | 2 |  | 8 |  | 2 | yes |
| `croft-avenue-milton` | succeeded | published | 2026-09-03 | thin | 3 |  |  |  | 1 | no |
| `cusick-circle-milton` | succeeded | published | 2026-07-20 | thin | 2 |  | 2 |  |  | yes |
| `dalhousie-gate-milton` | succeeded | published | 2026-09-04 | thin | 1 |  |  |  | 1 | no |
| `dance-court-milton` | failed | published | 2026-08-30 | thin | 3 |  | 5 |  | 3 | yes |
| `dawson-crescent-milton` | succeeded | published | 2026-07-20 | full | 5 |  |  |  | 1 | no |
| `dempsey-crescent-milton` | succeeded | published | 2026-06-02 | thin | 1 |  | 3 |  | 3 | yes |
| `dent-terrace-milton` | failed | published | 2026-05-27 | thin | 1 |  |  | 3 |  | yes |
| `derry-road-milton` | succeeded | published | 2026-08-02 | full | 9 |  | 3 |  | 1 | yes |
| `deverell-place-milton` | failed | published | 2026-08-30 | full | 7 |  | 4 |  |  | no |
| `dills-crescent-milton` | succeeded | published | 2026-08-02 | thin | 0 |  |  |  | 1 | no |
| `donnelly-street-milton` | failed | published | 2026-08-31 | full | 6 |  | 5 |  | 3 | yes |
| `downes-jackson-heights-milton` | succeeded | published | 2026-06-28 | thin | 3 |  | 2 |  | 1 | yes |
| `duff-crescent-milton` | succeeded | published | 2026-07-20 | zero | 0 |  | 2 | 1 |  | yes |
| `duignan-crescent-milton` | failed | published | 2026-08-31 | thin | 1 |  | 10 |  | 1 | yes |
| `duncan-lane-milton` | failed | published | 2026-08-30 | full | 6 |  | 2 |  | 1 | no |
| `dymott-avenue-milton` | succeeded | published | 2026-07-05 | thin | 4 |  | 11 | 1 | 2 | yes |
| `edwards-avenue-milton` | failed | published | 2026-08-31 | thin | 4 |  | 8 |  | 4 | yes |
| `ellenton-crescent-milton` | succeeded | published | 2026-05-27 | thin | 1 |  | 1 | 1 |  | yes |
| `elliott-crescent-milton` | failed | published | 2026-08-31 | thin | 2 |  | 9 |  | 4 | yes |
| `ellis-crescent-milton` | failed | published | 2026-08-31 | thin | 2 |  | 1 |  | 2 | yes |
| `elmwood-crescent-milton` | succeeded | published | 2026-05-31 | thin | 1 |  | 4 |  | 3 | yes |
| `english-mill-court-milton` | succeeded | published | 2026-07-20 | thin | 4 |  | 6 |  | 1 | yes |
| `etheridge-avenue-milton` | failed | published | 2026-08-30 | thin | 4 |  | 4 |  |  | yes |
| `etherington-way-milton` | failed | published | 2026-08-23 | zero | 0 |  | 6 |  | 3 | yes |
| `farlow-crescent-milton` | succeeded | published | 2026-07-26 | thin | 2 |  | 4 |  | 1 | yes |
| `farmstead-drive-milton` | succeeded | published | 2026-08-02 | full | 30 |  |  | 1 | 1 | no |
| `fasken-court-milton` | failed | published | 2026-08-31 | thin | 1 |  | 6 |  | 3 | yes |
| `featherstone-road-milton` | failed | published | 2026-08-30 | thin | 0 |  | 2 |  | 1 | yes |
| `fennamore-terrace-milton` | failed | published | 2026-08-30 | thin | 1 |  | 2 |  | 3 | yes |
| `ferguson-drive-milton` | failed | published | 2026-08-30 | full | 8 |  | 5 |  | 1 | no |
| `field-drive-milton` | failed | published | 2026-08-31 | thin | 1 |  | 4 |  | 2 | yes |
| `finney-terrace-milton` | succeeded | published | 2026-06-01 | thin | 3 |  | 4 |  | 1 | yes |
| `fitzgerald-crescent-milton` | failed | published | 2026-08-31 | thin | 3 |  | 6 |  | 3 | yes |
| `forbes-terrace-milton` | failed | published | 2026-08-31 | thin | 3 |  | 4 | 2 | 2 | yes |
| `fourth-line-milton` | failed | published | 2026-08-30 | full | 8 |  | 1 |  | 3 | yes |
| `fowles-court-milton` | failed | published | 2026-08-31 | thin | 4 |  | 2 |  | 3 | yes |
| `fox-crescent-milton` | failed | published | 2026-08-31 | thin | 3 |  |  | 2 | 2 | yes |
| `frank-place-milton` | failed | published | 2026-08-30 | thin | 4 |  | 3 |  | 1 | yes |
| `freeman-trail-milton` | failed | published | 2026-08-31 | thin | 2 |  | 3 | 5 | 2 | yes |
| `fullum-landing-milton` | failed | published | 2026-08-31 | thin | 2 |  | 6 |  |  | yes |
| `gainer-crescent-milton` | failed | published | 2026-08-30 | thin | 3 |  | 2 |  | 2 | yes |
| `gervais-terrace-milton` | failed | published | 2026-08-31 | full | 5 |  | 5 |  | 1 | no |
| `gibson-crescent-milton` | succeeded | published | 2026-05-27 | thin | 1 |  |  | 1 | 1 | yes |
| `giddings-crescent-milton` | failed | published | 2026-08-30 | thin | 4 |  | 11 |  | 1 | yes |
| `gifford-crescent-milton` | succeeded | published | 2026-09-03 | thin | 2 |  |  |  | 1 | no |
| `gillett-point-milton` | succeeded | published | 2026-06-28 | thin | 2 |  | 2 |  | 2 | yes |
| `gleave-terrace-milton` | failed | published | 2026-08-30 | thin | 2 |  | 5 |  |  | yes |
| `gleeson-road-milton` | succeeded | published | 2026-06-01 | thin | 4 |  | 4 |  |  | yes |
| `glenda-jane-drive-milton` | succeeded | published | 2026-07-19 | zero | 0 |  | 1 |  |  | yes |
| `gollins-drive-milton` | succeeded | published | 2026-06-01 | thin | 1 |  | 3 |  | 2 | yes |
| `gooch-crescent-milton` | succeeded | published | 2026-05-27 | thin | 1 |  |  |  | 1 | no |
| `gooding-crescent-milton` | succeeded | published | 2026-05-27 | thin | 2 |  | 4 | 1 | 4 | yes |
| `gordon-heights-milton` | succeeded | published | 2026-05-27 | thin | 2 |  |  | 1 | 2 | yes |
| `gosford-crescent-milton` | succeeded | published | 2026-09-04 | thin | 1 |  |  |  | 1 | no |
| `goutouski-crescent-milton` | succeeded | published | 2026-06-14 | zero | 0 |  | 1 |  |  | yes |
| `gowling-terrace-milton` | succeeded | published | 2026-05-27 | thin | 3 |  | 8 | 1 | 1 | yes |
| `grant-way-milton` | failed | published | 2026-08-31 | thin | 1 |  | 2 |  | 2 | yes |
| `grey-landing-milton` | succeeded | published | 2026-05-27 | thin | 2 |  | 1 | 2 |  | yes |
| `guelph-line-milton` | succeeded | published | 2026-08-02 | full | 9 |  | 4 |  | 1 | yes |
| `hamman-way-milton` | failed | published | 2026-08-31 | thin | 3 |  | 11 |  | 1 | yes |
| `hampshire-way-milton` | failed | published | 2026-08-31 | full | 7 |  | 2 |  | 1 | no |
| `hanson-crescent-milton` | succeeded | published | 2026-06-01 | thin | 4 |  | 2 |  | 4 | yes |
| `harkin-place-milton` | succeeded | published | 2026-05-27 | thin | 1 |  | 1 |  | 1 | yes |
| `harvest-drive-milton` | succeeded | published | 2026-06-02 | zero | 0 |  | 2 |  |  | yes |
| `harwood-drive-milton` | succeeded | published | 2026-06-02 | thin | 1 |  | 6 |  | 3 | yes |
| `hatt-court-milton` | succeeded | published | 2026-06-02 | thin | 4 |  | 7 |  | 1 | yes |
| `hawthorne-crescent-milton` | failed | published | 2026-08-31 | thin | 2 |  | 2 |  | 1 | yes |
| `hayward-crescent-milton` | succeeded | published | 2026-07-05 | thin | 1 |  | 4 |  | 2 | yes |
| `hearst-boulevard-milton` | failed | published | 2026-08-30 | thin | 2 |  | 2 |  | 3 | yes |
| `heaven-crescent-milton` | succeeded | published | 2026-09-04 | thin | 1 |  |  |  | 1 | no |
| `hemstreet-crescent-milton` | failed | published | 2026-08-31 | zero | 0 |  | 7 |  | 1 | yes |
| `hepburn-road-milton` | failed | published | 2026-08-31 | full | 8 |  | 1 |  | 1 | no |
| `herman-way-milton` | succeeded | published | 2026-07-05 | thin | 3 |  | 6 |  | 2 | yes |
| `highside-drive-milton` | failed | published | 2026-08-31 | thin | 3 |  | 4 |  | 2 | yes |
| `hinchey-crescent-milton` | failed | published | 2026-08-31 | thin | 1 |  | 1 |  |  | yes |
| `hincks-drive-milton` | succeeded | published | 2026-08-02 | thin | 1 |  | 2 |  | 1 | yes |
| `hobbs-crescent-milton` | succeeded | published | 2026-08-02 | thin | 3 |  | 2 | 1 | 1 | yes |
| `holbrook-court-milton` | succeeded | published | 2026-06-02 | thin | 1 |  | 1 |  |  | yes |
| `holdsworth-crescent-milton` | succeeded | published | 2026-07-20 | thin | 1 |  | 4 |  |  | yes |
| `holland-heights-milton` | succeeded | published | 2026-06-02 | thin | 1 |  | 4 |  | 1 | yes |
| `holloway-terrace-milton` | succeeded | published | 2026-06-01 | thin | 2 |  |  |  | 2 | no |
| `holly-avenue-milton` | failed | published | 2026-08-31 | full | 5 |  | 2 |  | 2 | yes |
| `hood-terrace-milton` | failed | published | 2026-08-30 | thin | 3 |  | 5 |  | 4 | yes |
| `houston-drive-milton` | failed | published | 2026-08-31 | thin | 2 |  | 12 |  | 3 | yes |
| `irving-terrace-milton` | failed | published | 2026-08-30 | thin | 3 |  | 4 |  | 2 | yes |
| `jarrett-crossing-milton` | succeeded | published | 2026-09-03 | thin | 0 |  |  |  | 1 | no |
| `jean-landing-milton` | succeeded | published | 2026-06-28 | thin | 1 |  | 5 |  | 2 | yes |
| `jelinik-terrace-milton` | succeeded | published | 2026-08-02 | thin | 3 |  | 3 |  | 1 | yes |
| `john-street-milton` | failed | published | 2026-08-10 | thin | 1 |  | 3 |  |  | yes |
| `joyce-boulevard-milton` | succeeded | published | 2026-07-19 | thin | 1 |  | 4 |  | 2 | yes |
| `kearns-drive-milton` | succeeded | published | 2026-09-04 | zero | 0 |  | 1 | 1 |  | yes |
| `king-street-milton` | failed | published | 2026-08-31 | zero | 0 |  | 1 |  |  | yes |
| `kingsleigh-court-milton` | failed | published | 2026-08-31 | thin | 4 |  | 6 | 1 | 3 | yes |
| `kingsway-place-milton` | failed | published | 2026-08-31 | thin | 1 |  | 4 |  | 1 | yes |
| `kitchen-court-milton` | failed | published | 2026-08-30 | thin | 2 |  | 4 |  | 2 | yes |
| `knight-trail-milton` | failed | published | 2026-08-30 | thin | 1 |  | 4 |  |  | yes |
| `kovachik-boulevard-milton` | succeeded | published | 2026-07-12 | thin | 4 |  | 3 |  | 2 | yes |
| `labine-point-milton` | failed | published | 2026-08-30 | thin | 0 |  | 2 |  | 1 | yes |
| `laidlaw-drive-milton` | failed | published | 2026-08-31 | thin | 2 |  | 2 |  | 3 | yes |
| `laking-terrace-milton` | failed | published | 2026-08-30 | full | 5 |  | 2 |  |  | no |
| `lamont-crescent-milton` | failed | published | 2026-08-31 | thin | 4 |  | 2 | 3 |  | yes |
| `lancaster-boulevard-milton` | failed | published | 2026-08-30 | full | 7 |  | 3 |  | 1 | yes |
| `langholm-street-milton` | succeeded | published | 2026-08-02 | thin | 1 |  | 8 |  | 1 | yes |
| `laughren-crescent-milton` | succeeded | published | 2026-06-28 | thin | 2 |  | 2 |  | 2 | yes |
| `laundon-terrace-milton` | succeeded | published | 2026-07-19 | thin | 2 |  | 4 |  | 2 | yes |
| `laurier-avenue-milton` | failed | published | 2026-08-30 | full | 10 |  | 12 |  | 2 | yes |
| `leatherleaf-landing-milton` | succeeded | published | 2026-06-01 | thin | 0 |  | 2 |  | 2 | yes |
| `leger-way-milton` | failed | published | 2026-08-30 | full | 14 |  | 3 |  | 1 | yes |
| `leitch-landing-milton` | succeeded | published | 2026-05-27 | thin | 1 |  | 2 |  | 1 | yes |
| `leiterman-drive-milton` | failed | published | 2026-08-30 | thin | 2 |  |  |  | 1 | no |
| `lemieux-court-milton` | failed | published | 2026-08-30 | thin | 3 |  | 2 |  | 2 | yes |
| `leriche-way-milton` | succeeded | published | 2026-08-02 | thin | 2 |  | 5 |  | 1 | yes |
| `limestone-road-milton` | succeeded | published | 2026-05-27 | thin | 2 |  | 3 |  | 1 | yes |
| `lingen-crescent-milton` | succeeded | published | 2026-05-27 | thin | 1 |  | 2 |  | 2 | yes |
| `little-crescent-milton` | succeeded | published | 2026-05-27 | zero | 0 |  | 1 | 2 | 1 | yes |
| `locker-place-milton` | succeeded | published | 2026-07-12 | thin | 2 |  | 5 |  | 1 | yes |
| `logan-drive-milton` | succeeded | published | 2026-07-26 | thin | 0 |  | 5 |  | 1 | yes |
| `luxton-drive-milton` | succeeded | published | 2026-06-02 | thin | 2 |  | 5 | 2 | 1 | yes |
| `mackenzie-drive-milton` | succeeded | published | 2026-06-02 | thin | 2 |  | 6 |  | 1 | yes |
| `mae-court-milton` | succeeded | published | 2026-06-02 | zero | 0 |  | 2 |  |  | yes |
| `magnolia-terrace-milton` | failed | published | 2026-08-31 | thin | 2 |  | 2 |  | 1 | yes |
| `magurn-gate-milton` | failed | published | 2026-08-10 | thin | 2 |  | 6 |  | 1 | yes |
| `malboeuf-court-milton` | failed | published | 2026-08-31 | thin | 2 |  | 6 |  | 3 | yes |
| `malick-street-milton` | succeeded | published | 2026-09-04 | thin | 3 |  |  |  | 1 | no |
| `manitou-way-milton` | failed | published | 2026-08-31 | thin | 1 |  | 3 |  |  | yes |
| `manley-lane-milton` | failed | published | 2026-08-31 | thin | 4 |  | 6 |  | 2 | yes |
| `maple-avenue-milton` | succeeded | published | 2026-08-02 | full | 8 |  |  |  | 1 | no |
| `marigold-court-milton` | succeeded | published | 2026-08-02 | thin | 1 |  | 5 |  | 1 | yes |
| `marley-crescent-milton` | failed | published | 2026-08-31 | zero | 0 |  | 3 |  |  | yes |
| `marshall-crescent-milton` | failed | published | 2026-08-30 | thin | 0 |  | 2 | 2 |  | yes |
| `mccready-drive-milton` | failed | published | 2026-08-31 | thin | 1 |  | 2 |  | 4 | yes |
| `mccuaig-drive-milton` | succeeded | published | 2026-09-03 | thin | 2 |  |  |  | 1 | no |
| `mcduffe-crescent-milton` | succeeded | published | 2026-05-27 | thin | 3 |  | 5 | 1 | 1 | yes |
| `mceachern-court-milton` | failed | published | 2026-08-30 | thin | 1 |  | 1 | 2 | 1 | yes |
| `mceastern-path-milton` | failed | published | 2026-08-31 | thin | 1 |  | 4 |  | 3 | yes |
| `mcfarland-court-milton` | failed | published | 2026-08-30 | zero | 0 |  | 2 |  |  | yes |
| `mcgibbon-drive-milton` | succeeded | published | 2026-08-02 | thin | 2 |  | 6 |  | 1 | yes |
| `mcjannett-avenue-milton` | failed | published | 2026-08-30 | thin | 3 |  | 4 |  | 2 | yes |
| `mclaren-road-milton` | succeeded | published | 2026-05-10 | zero | 0 |  |  | 1 |  | yes |
| `mclaughlin-avenue-milton` | failed | published | 2026-08-30 | thin | 2 |  | 2 |  | 1 | yes |
| `mcnair-circle-milton` | failed | published | 2026-08-31 | thin | 1 |  | 4 |  | 3 | yes |
| `mcphail-way-milton` | failed | published | 2026-08-17 | zero | 0 |  |  | 1 |  | yes |
| `megson-terrace-milton` | failed | published | 2026-08-30 | full | 7 |  | 3 | 2 |  | no |
| `menzies-court-milton` | failed | published | 2026-08-31 | zero | 0 |  | 1 |  |  | yes |
| `merritt-drive-milton` | succeeded | published | 2026-05-27 | thin | 1 |  | 7 | 2 | 2 | yes |
| `michener-place-milton` | succeeded | published | 2026-06-28 | thin | 1 |  | 4 |  | 2 | yes |
| `middleton-crescent-milton` | failed | published | 2026-08-31 | thin | 1 |  | 1 |  | 1 | yes |
| `miles-street-milton` | failed | published | 2026-08-31 | thin | 1 |  | 7 |  | 2 | yes |
| `mill-street-milton` | failed | published | 2026-08-31 | thin | 3 |  | 7 |  | 3 | yes |
| `miller-way-milton` | succeeded | published | 2026-09-04 | thin | 1 |  |  |  | 1 | no |
| `millside-drive-milton` | failed | published | 2026-08-30 | full | 13 |  | 4 |  |  | no |
| `minchin-way-milton` | succeeded | published | 2026-05-27 | thin | 1 |  | 4 | 3 | 1 | yes |
| `minto-crescent-milton` | failed | published | 2026-08-30 | thin | 1 |  | 8 |  | 2 | yes |
| `mockridge-terrace-milton` | succeeded | published | 2026-08-02 | thin | 1 |  | 4 |  | 1 | yes |
| `moira-crescent-milton` | failed | published | 2026-08-23 | thin | 1 |  | 2 |  | 2 | yes |
| `moorelands-crescent-milton` | failed | published | 2026-08-31 | thin | 4 |  | 2 |  | 3 | yes |
| `morley-avenue-milton` | succeeded | published | 2026-07-20 | thin | 1 |  | 4 |  |  | yes |
| `morse-place-milton` | succeeded | published | 2026-08-02 | thin | 1 |  | 9 |  | 1 | yes |
| `mulroney-heights-milton` | succeeded | published | 2026-07-05 | thin | 2 |  |  |  | 3 | yes |
| `murray-meadows-place-milton` | failed | published | 2026-08-30 | full | 6 |  | 4 |  | 1 | yes |
| `muskoka-heights-milton` | failed | published | 2026-08-30 | thin | 3 |  |  |  | 1 | no |
| `nadalin-heights-milton` | succeeded | published | 2026-08-02 | full | 9 |  | 2 | 2 | 1 | yes |
| `nairn-circle-milton` | failed | published | 2026-08-30 | thin | 3 |  | 11 |  |  | yes |
| `nakerville-crescent-milton` | succeeded | published | 2026-07-20 | thin | 1 |  | 1 | 1 |  | yes |
| `nelson-court-milton` | succeeded | published | 2026-06-28 | thin | 2 |  | 8 |  | 3 | yes |
| `newell-street-milton` | failed | published | 2026-08-30 | thin | 1 |  | 1 |  |  | yes |
| `nipissing-road-milton` | succeeded | published | 2026-06-02 | thin | 0 |  | 3 |  |  | yes |
| `oriole-court-milton` | succeeded | published | 2026-06-02 | thin | 3 |  | 4 |  |  | yes |
| `orr-terrace-milton` | failed | published | 2026-08-31 | thin | 4 |  | 5 |  | 3 | yes |
| `panton-trail-milton` | failed | published | 2026-08-31 | full | 5 |  | 3 | 1 | 2 | yes |
| `parent-place-milton` | failed | published | 2026-08-30 | thin | 4 |  | 1 |  |  | yes |
| `patterson-drive-milton` | failed | published | 2026-08-31 | zero | 0 |  | 7 |  | 2 | yes |
| `paupst-place-milton` | succeeded | published | 2026-06-28 | zero | 0 |  | 1 |  |  | yes |
| `pearl-street-milton` | succeeded | published | 2026-07-05 | thin | 1 |  | 6 |  | 3 | yes |
| `pears-court-milton` | succeeded | published | 2026-07-20 | zero | 0 |  | 5 |  |  | yes |
| `penson-crescent-milton` | failed | published | 2026-08-31 | thin | 3 |  | 3 |  |  | yes |
| `pettigrew-trail-milton` | failed | published | 2026-08-30 | thin | 2 |  | 5 |  | 3 | yes |
| `pettit-trail-milton` | succeeded | published | 2026-05-27 | thin | 3 |  | 1 |  | 1 | yes |
| `pharo-point-milton` | succeeded | published | 2026-07-05 | thin | 4 |  | 3 |  | 1 | yes |
| `philbrook-drive-milton` | succeeded | published | 2026-09-03 | thin | 1 |  |  |  | 1 | no |
| `pitfield-road-milton` | failed | published | 2026-08-30 | thin | 1 |  | 4 |  | 1 | yes |
| `playfair-terrace-milton` | succeeded | published | 2026-07-24 | thin | 1 |  | 2 |  | 1 | yes |
| `plum-place-milton` | failed | published | 2026-08-31 | thin | 1 |  | 2 |  |  | yes |
| `porter-way-milton` | failed | published | 2026-08-30 | full | 6 |  | 6 |  | 1 | yes |
| `potts-terrace-milton` | failed | published | 2026-08-30 | thin | 2 |  | 6 |  |  | yes |
| `pozbou-crescent-milton` | succeeded | published | 2026-06-21 | thin | 2 |  | 2 |  | 3 | yes |
| `pratt-heights-milton` | succeeded | published | 2026-07-05 | thin | 1 |  | 5 |  | 2 | yes |
| `pringle-avenue-milton` | failed | published | 2026-08-30 | full | 7 |  | 7 |  | 3 | yes |
| `prosser-circle-milton` | failed | published | 2026-08-23 | thin | 4 |  | 6 |  | 1 | yes |
| `queen-street-milton` | failed | published | 2026-08-30 | thin | 1 |  | 4 |  | 1 | yes |
| `raftis-crescent-milton` | succeeded | published | 2026-06-02 | thin | 1 |  | 7 |  | 2 | yes |
| `ramshaw-crescent-milton` | succeeded | published | 2026-07-26 | thin | 1 |  | 1 |  |  | yes |
| `randall-crescent-milton` | succeeded | published | 2026-08-02 | thin | 1 |  | 4 |  | 1 | yes |
| `raspberry-terrace-milton` | succeeded | published | 2026-08-02 | full | 6 |  | 3 |  | 1 | no |
| `reichert-court-milton` | succeeded | published | 2026-07-26 | thin | 1 |  |  |  | 1 | no |
| `reis-place-milton` | failed | published | 2026-08-31 | thin | 2 |  | 8 |  | 2 | yes |
| `restivo-lane-milton` | failed | published | 2026-08-30 | full | 7 |  | 4 |  | 1 | no |
| `ridge-drive-milton` | failed | published | 2026-05-26 | thin | 2 |  | 4 | 2 |  | yes |
| `robertson-crescent-milton` | failed | published | 2026-08-31 | thin | 1 |  |  |  | 2 | yes |
| `robinwood-crescent-milton` | succeeded | published | 2026-07-23 | zero | 0 |  | 1 |  |  | yes |
| `robson-crescent-milton` | succeeded | published | 2026-06-28 | thin | 3 |  | 2 |  | 3 | yes |
| `rolph-terrace-milton` | failed | published | 2026-08-31 | thin | 4 |  | 9 |  | 1 | yes |
| `roper-drive-milton` | succeeded | published | 2026-08-02 | thin | 3 |  | 4 |  | 1 | yes |
| `rose-way-milton` | failed | published | 2026-08-30 | full | 10 |  | 5 | 2 | 2 | yes |
| `roseheath-drive-milton` | succeeded | published | 2026-07-05 | thin | 1 |  | 6 |  | 2 | yes |
| `rowe-terrace-milton` | failed | published | 2026-08-31 | thin | 0 |  |  |  | 1 | no |
| `ruhl-drive-milton` | failed | published | 2026-08-31 | thin | 0 |  | 7 |  | 1 | yes |
| `rutland-crescent-milton` | succeeded | published | 2026-07-05 | thin | 0 |  | 1 |  |  | yes |
| `sanderson-crescent-milton` | succeeded | published | 2026-06-28 | thin | 1 |  | 2 |  | 1 | yes |
| `sauve-street-milton` | succeeded | published | 2026-08-02 | full | 19 |  |  |  | 1 | no |
| `savoline-boulevard-milton` | failed | published | 2026-08-30 | full | 10 |  | 4 |  |  | yes |
| `schreyer-crescent-milton` | failed | published | 2026-08-31 | thin | 3 |  | 3 |  | 2 | yes |
| `scott-boulevard-milton` | succeeded | published | 2026-08-02 | full | 21 |  | 2 |  |  | no |
| `secord-court-milton` | succeeded | published | 2026-05-27 | thin | 1 |  | 5 | 1 | 1 | yes |
| `seivert-place-milton` | succeeded | published | 2026-07-20 | thin | 1 |  |  |  | 1 | no |
| `septimus-heights-milton` | failed | published | 2026-08-30 | thin | 2 |  | 6 |  | 2 | yes |
| `serafini-crescent-milton` | failed | published | 2026-08-30 | thin | 3 |  |  |  | 2 | yes |
| `shade-lane-milton` | failed | published | 2026-08-31 | zero | 0 |  | 1 |  |  | yes |
| `sheaffe-place-milton` | succeeded | published | 2026-07-05 | thin | 1 |  | 2 |  | 3 | yes |
| `shepherd-place-milton` | succeeded | published | 2026-07-19 | thin | 2 |  | 6 |  | 2 | yes |
| `sherwood-road-milton` | succeeded | published | 2026-07-05 | thin | 3 |  | 4 |  | 1 | yes |
| `shortreed-crescent-milton` | failed | published | 2026-08-31 | thin | 4 |  | 2 |  | 2 | yes |
| `silver-court-milton` | succeeded | published | 2026-05-27 | thin | 1 |  | 9 | 2 | 1 | yes |
| `sim-place-milton` | succeeded | published | 2026-07-05 | thin | 0 |  | 4 |  | 1 | yes |
| `solomon-court-milton` | succeeded | published | 2026-08-02 | thin | 3 |  | 9 |  | 1 | yes |
| `speyer-circle-milton` | failed | published | 2026-08-30 | full | 8 |  | 2 |  |  | no |
| `sprague-place-milton` | failed | published | 2026-08-30 | thin | 1 |  | 4 |  | 2 | yes |
| `stacey-crescent-milton` | succeeded | published | 2026-07-20 | thin | 1 |  | 4 |  |  | yes |
| `starflower-place-milton` | succeeded | published | 2026-06-28 | thin | 1 |  |  |  | 1 | no |
| `stark-circle-milton` | succeeded | published | 2026-06-01 | thin | 2 |  | 6 |  | 1 | yes |
| `stearn-place-milton` | succeeded | published | 2026-07-09 | thin | 1 |  | 2 |  | 1 | yes |
| `stemman-place-milton` | failed | published | 2026-08-31 | thin | 2 |  | 5 |  | 1 | yes |
| `stewart-crescent-milton` | failed | published | 2026-08-24 | zero | 0 |  | 3 |  |  | yes |
| `stirling-todd-terrace-milton` | failed | published | 2026-08-31 | thin | 0 |  | 1 | 1 |  | yes |
| `stokes-trail-milton` | succeeded | published | 2026-06-01 | thin | 2 |  | 3 |  | 1 | yes |
| `stover-crescent-milton` | failed | published | 2026-08-31 | thin | 1 |  | 4 |  | 3 | yes |
| `strathcona-court-milton` | succeeded | published | 2026-07-20 | zero | 0 |  | 3 |  | 1 | yes |
| `suitor-court-milton` | failed | published | 2026-08-30 | thin | 2 |  | 2 |  | 2 | yes |
| `sumac-crescent-milton` | succeeded | published | 2026-08-02 | thin | 0 |  |  |  | 1 | no |
| `swann-crescent-milton` | failed | published | 2026-08-31 | thin | 1 |  | 4 |  | 2 | yes |
| `sweetfern-crescent-milton` | succeeded | published | 2026-08-02 | thin | 1 |  | 5 |  | 1 | yes |
| `sydney-street-milton` | succeeded | published | 2026-08-02 | thin | 0 |  | 5 |  | 1 | yes |
| `syer-drive-milton` | succeeded | published | 2026-06-28 | thin | 3 |  | 2 |  |  | yes |
| `syndenham-lane-milton` | succeeded | published | 2026-06-02 | thin | 2 |  | 1 |  |  | yes |
| `taylor-court-milton` | succeeded | published | 2026-08-02 | thin | 3 |  | 2 |  |  | yes |
| `teetzel-drive-milton` | succeeded | published | 2026-05-27 | thin | 2 |  | 3 | 1 | 2 | yes |
| `thimbleweed-court-milton` | failed | published | 2026-08-30 | full | 5 |  | 4 |  | 1 | yes |
| `thomas-street-milton` | failed | published | 2026-08-31 | thin | 1 |  |  |  | 2 | yes |
| `thompson-road-milton` | succeeded | published | 2026-09-03 | thin | 2 |  |  |  | 1 | no |
| `thornborrow-court-milton` | succeeded | published | 2026-05-27 | thin | 1 |  |  |  | 1 | no |
| `timmer-place-milton` | succeeded | published | 2026-09-04 | thin | 0 |  |  |  | 1 | no |
| `tonelli-lane-milton` | succeeded | published | 2026-08-02 | thin | 2 |  | 4 |  |  | yes |
| `tough-gate-milton` | succeeded | published | 2026-05-27 | thin | 2 |  | 3 |  |  | yes |
| `trafalgar-court-milton` | succeeded | published | 2026-05-27 | thin | 2 |  | 3 | 2 | 2 | yes |
| `trafalgar-road-milton` | succeeded | published | 2026-09-03 | thin | 1 |  |  |  | 1 | no |
| `transom-crescent-milton` | succeeded | published | 2026-08-02 | thin | 2 |  |  |  | 1 | no |
| `trudeau-drive-milton` | succeeded | published | 2026-08-02 | full | 7 |  | 2 | 1 | 1 | yes |
| `tupper-drive-milton` | failed | published | 2026-08-31 | full | 6 |  | 4 |  | 3 | yes |
| `twinflower-place-milton` | succeeded | published | 2026-06-02 | thin | 2 |  | 5 |  |  | yes |
| `twiss-road-milton` | failed | published | 2026-08-16 | thin | 1 |  | 5 |  | 2 | yes |
| `vanier-drive-milton` | failed | published | 2026-08-30 | thin | 2 |  | 2 |  | 3 | yes |
| `vaughan-court-milton` | succeeded | published | 2026-06-02 | thin | 3 |  | 1 |  | 2 | yes |
| `victoria-street-milton` | failed | published | 2026-06-02 | zero | 0 |  | 2 | 4 |  | yes |
| `wakefield-road-milton` | failed | published | 2026-08-31 | zero | 0 |  | 1 |  |  | yes |
| `watercress-way-milton` | failed | published | 2026-08-30 | thin | 3 |  | 7 |  | 3 | yes |
| `waters-boulevard-milton` | failed | published | 2026-08-31 | thin | 4 |  | 2 |  | 3 | yes |
| `weston-drive-milton` | failed | published | 2026-08-31 | thin | 4 |  | 13 |  | 2 | yes |
| `wheelihan-way-milton` | failed | published | 2026-08-30 | thin | 0 |  | 3 |  | 1 | yes |
| `whetham-heights-milton` | failed | published | 2026-08-30 | thin | 3 |  | 6 |  | 1 | yes |
| `whitlock-avenue-milton` | succeeded | published | 2026-08-02 | full | 5 |  | 2 |  |  | yes |
| `whitmer-street-milton` | failed | published | 2026-08-30 | full | 9 |  | 5 |  |  | yes |
| `whitney-terrace-milton` | succeeded | published | 2026-05-27 | thin | 2 |  | 7 | 2 | 2 | yes |
| `williams-avenue-milton` | succeeded | published | 2026-05-27 | thin | 1 |  | 5 | 1 | 1 | yes |
| `willow-avenue-milton` | succeeded | published | 2026-07-05 | thin | 2 |  | 9 |  | 2 | yes |
| `wilson-drive-milton` | failed | published | 2026-08-31 | full | 6 |  | 2 |  | 2 | no |
| `winter-crescent-milton` | succeeded | published | 2026-05-27 | thin | 2 |  |  | 1 | 1 | yes |
| `wintergreen-place-milton` | succeeded | published | 2026-06-01 | thin | 2 |  | 4 |  |  | yes |
| `woodlawn-crescent-milton` | failed | published | 2026-08-31 | thin | 3 |  | 4 |  |  | yes |
| `woodley-crescent-milton` | succeeded | published | 2026-05-27 | thin | 3 |  | 2 | 1 | 1 | yes |
| `yates-drive-milton` | failed | published | 2026-08-31 | full | 7 |  |  |  | 1 | no |
| `zelinsky-crescent-milton` | succeeded | published | 2026-06-01 | thin | 3 |  | 2 |  | 1 | yes |
| `zimmerman-crescent-milton` | failed | published | 2026-08-31 | thin | 1 |  | 2 | 1 | 1 | yes |
| `zuest-crescent-milton` | succeeded | published | 2026-07-20 | thin | 1 |  | 4 |  |  | yes |
| `3-side-road-milton` | succeeded | _no row_ | 2026-05-09 | thin | 1 |  | 2 | 2 |  | yes |
| `abbott-street-milton` | succeeded | _no row_ | 2026-05-09 | thin | 0 |  | 1 |  |  | yes |
| `agnew-crescent-milton` | succeeded | _no row_ | 2026-05-09 | thin | 3 |  | 3 |  |  | yes |
| `allport-gate-milton` | failed | _no row_ | 2026-05-17 | thin | 2 |  |  | 7 |  | yes |
| `anne-boulevard-milton` | failed | _no row_ | 2026-04-23 | thin | 1 |  | 4 |  |  | yes |
| `applewood-crescent-milton` | failed | _no row_ | 2026-04-23 | thin | 1 |  | 1 |  |  | yes |
| `auger-terrace-milton` | failed | _no row_ | 2026-04-23 | thin | 1 |  | 5 |  |  | yes |
| `babcock-crescent-milton` | failed | _no row_ | 2026-04-23 | thin | 0 |  |  | 2 |  | yes |
| `george-street-milton` | failed | draft | 2026-05-26 | thin | 2 |  | 4 | 1 |  | yes |
| `rigo-crossing-crescent-milton` | succeeded | _no row_ | 2026-06-02 | thin | 0 |  | 4 |  | 1 | yes |
| `turner-drive-milton` | failed | draft | 2026-05-26 | thin | 3 |  | 4 | 2 |  | yes |
| `weller-cross-milton` | succeeded | _no row_ | 2026-06-28 | thin | 1 |  |  |  | 3 | yes |
---

# Part 3

## Correction to section 1 (2026-09-05)

**The "474 of 474 drifted" figure in section 1 was my own bug, not a measurement.** The audit
compared a 12-character slice of the rebuilt digest against the stored `inputHash`, and 459 of
479 stored hashes are the full 64-character digest — the API/cron path writes 64,
`scripts/backfill-descriptions.ts` writes a 12-char prefix. The comparison could not have
matched.

Recomputed against the correct width, per row:

| | |
|---|---|
| rebuilds to an **identical** input | **13** |
| input has changed | 461 |
| unscoreable | 5 |

The direction of section 3's argument is unchanged — 461 of 474 rows genuinely cannot be
judged against the payload they were written from — and the three measurements it rests on
(recency decay, comparator-token repetition, DOM-against-zero) never used the hash.

**The 13 make the case better than the hash statistic did.** All 13 were generated 2026-09-03
or 2026-09-04, under the current rules, and **all 13 carry zero gate-flagged findings**:

```
buckthorn-garden  court-street  croft-avenue  drew-centre  first-line  gosford-crescent
heaven-crescent   lower-base-line  mccuaig-drive  miller-way  pickersgill-crescent
tock-close  trafalgar-road
```

Every gate flag in the corpus sits on a row whose input has changed. That is the drift
hypothesis stated as a partition rather than a correlation, and it is why regenerating the
154 — rather than editing them — is the right remedy: it re-grounds each page against the
data that exists now.

**A second defect fell out of the same check.** The two write paths digest at different
widths, so `scripts/backfill-descriptions.ts`'s idempotency test
(`existing.inputHash === inputHash`) can never match a row the API path wrote. The bulk path
has been silently regenerating cron-written rows. Not changed here — normalizing the width
invalidates the 20 short-hash rows' idempotency in one go, which belongs in its own pass.
Carried to `HANDOFF.md`.

## Step 0 — `feat/gen-input-snapshot`

`StreetGeneration.inputJson` (`Json`, nullable). Migration
`20260905120000_street_generation_input_json`, applied over the pg driver and recorded in
`_prisma_migrations`; `prisma migrate status` reports 22 migrations, schema up to date.

Both write paths fill it at **all ten sites** where `inputHash` is written — the atomic
claim, and the terminal update on success and on failure, in `src/lib/generateStreet.ts` and
`scripts/backfill-descriptions.ts`. `generateStreet` serializes once and hashes those exact
bytes, so the stored snapshot cannot disagree with the hash beside it.

`scripts/test-input-snapshot.ts` is the 13th prebuild test. It asserts the pairing **at every
site**, not that the file mentions the column — the distinction HANDOFF item 6 exists to
teach. It found a genuinely unpaired site on its first run. Verified red on a removed
pairing, green on restore.

| gate | result |
|---|---|
| `pnpm build` | **exit 0**, zero `P2024`, 539 static pages |
| prebuild | **13/13** |
| preview | `miltonly-p2p4uqa8l`, Ready |
| battery on preview | **`PASS · 9 checks · 438 pages · 66s`**, exit 0 |


## Step 1 — the 154 regenerated, DeepSeek only

**No production env change and no redeploy.** `scripts/regen-058-local.ts` runs the generator in
this process and deletes `AI_PROVIDER_FALLBACK` from the process environment after `.env.local`
loads, so a half that exhausts its retry budget fails closed rather than escalating to Claude. It
asserts all four provider knobs resolve to DeepSeek before generating anything and refuses to
start otherwise. Fail-closed is load-bearing here: `generateStreetContent` skips the
`StreetContent` upsert entirely on failure, so a failed page keeps its existing row untouched.

The first four ran through `/api/admin/force-regenerate` on production **before** that question
was settled, and went via the Claude fallback at **$4.2504 for four pages**. That is what put
the projection at ~$164 and prompted the ask.

| | |
|---|---|
| pages attempted | **154** |
| passed and republished | **138** |
| failed, fail-closed | **16** |
| DeepSeek cost, 150 pages | **$0.9443** |
| Claude/production cost, first 4 | **$4.2504** |
| **total** | **$5.1947** |
| snapshots written | **154 of 154** |
| published `StreetContent` rows | 438 to **443** |

`sim-place-milton` first died on `TypeError: fetch failed` at attempt 3 — a transport drop, not a
verdict — so it was dropped from the log and re-run. It failed the second time on a real
`numeric_ungrounded`, which is what put it in the residue rather than leaving it ambiguous.

### The regenerated corpus is clean

Re-audited all 138. **Gate-flagged findings fell from 138 of 138 to 2**, and both of those turned
out to be artifacts of the audit itself:

- `elmwood-crescent-milton` "$1.35M" — its snapshot carries `Pringle Avenue = 1,340,000`.
- `jelinik-terrace-milton` "$900K" — its snapshot carries `Aird Court = 905,750`.

Both are inside the validator's own tolerance. The audit rebuilt each input minutes after
generation and got a **different `crossStreets` set**, so it scored prose against comparators the
page was never given. Scored against `inputJson` instead, **both pages carry zero ungrounded
dollars**. This is the first use of the step 0 column and it did exactly the job it was added
for: it turned two unresolvable flags into a definite answer in one query.

`zero_tier_price` and `tier_band` are now **zero** across the regenerated set.

**The 86 remaining `dom` findings are a defect in this audit, not in the pages.** They sit in the
`neighbourhoodComparable` section citing the neighbourhood's days-on-market, and
`findUngroundedNumerics` compares a `days` token only against `input.aggregates.daysOnMarket` —
it never reads `neighbourhoodComparable.daysOnMarket`. The snapshots confirm it: `elmwood` carries
`nbhdComparable.dom = 92` and `jelinik` `= 94`, and the prose cites those numbers. The shipped
validator does not fire on them because it scopes the DOM rule to the market section, so nothing
is live-defective. The rule needs the second field before it can be widened.

### The residue — 16 pages, all fail-closed

Three are draft and stay draft; thirteen are published and keep the content they had.

```
draft, cannot generate
  geddes-landing-milton       eval half, 5 attempts, still writes a price into a no-price payload
  jasper-street-milton        same shape, market and eval both exhausted
  wood-close-milton           "No stats available" - getStreetStats() returns null, nothing to
                              generate from at all

published, prior content preserved
  conway-court-milton        derry-road-milton         ellenton-crescent-milton
  goutouski-crescent-milton  grey-landing-milton       holbrook-court-milton
  leriche-way-milton         pharo-point-milton        robinwood-crescent-milton
  secord-court-milton        sim-place-milton          syer-drive-milton
  whitlock-avenue-milton
```

Fourteen of the sixteen exhausted the **eval** half specifically (`bestFitFor` /
`differentPriorities` / FAQ), which is where comparator prices are narrated. On DeepSeek alone the
model cannot restate a comparator inside the tolerance and keeps re-guessing. The Claude fallback
cleared all four it was given. That is the trade this run bought: **$5.19 instead of ~$164, and 16
pages left rather than 0.**

## Step 2 — battery

`EXPECT_SHA=c953b9e4450b4f0a23f8f1cae675dafa45989b04 BASE=https://miltonly.com`

**`PASS · 9 checks · 442 pages · 188s`, exit 0.** SHA gate green.

*The battery takes the full 40-character SHA. A short SHA fails the gate on a string compare and
aborts before any content check, which is correct behaviour and worth knowing before the next run.*

# 064 — Content tier build: guides and Market Watch

CONTENT · D:\miltonly-content · feat/content

Gate A (report 062) and its addendum (063) approved with ten rulings on
2026-09-10. This is what was built against them.

**Preview `https://miltonly-clft5u5jn-gtahomequest-hubs-projects.vercel.app` at
`62ab3a5f789e1468a9d02572b14a0231cdd60b20`.**
Battery `PASS · 9 checks · 444 pages · 64s` at the full SHA.
Local gate exit 0, zero `P2024`, **20/20 prebuild**, 554 static pages.
**Not merged.**

---

## 1. The nine URLs, all 200 on the preview

| URL | GSC query it answers |
|---|---|
| `/guides` | index |
| `/guides/what-milton-neighbourhoods-cost` | milton real estate market |
| `/guides/how-to-read-a-milton-sold-price` | sold prices milton |
| `/guides/is-it-a-good-time-to-sell-in-milton` | is it a good time to sell |
| `/guides/milton-condo-fees-parking-and-lockers` | condos in milton |
| `/guides/what-it-costs-to-buy-your-first-home-in-milton` | first-time buyer |
| `/guides/milton-schools-what-the-data-shows` | schools |
| `/market-watch` | current edition |
| `/market-watch/2026-08-31` | first archived edition |

Order is the brief's GSC evidence order (ruling 8). All nine are in
`sitemap.xml`, verified on the served host. `parking` stays held (report 062,
G7): the Town bylaw is not in this repo and a model would invent it.

---

## 2. Rulings, and what each turned into

**1 · Tables.** `MarketEdition` and `MarketEditionGeneration`, migration
`20260910120000_market_edition`. The edition stores its own window, its
k-gated sections, its deterministic sentence and its optional paragraph.
`MarketEditionGeneration` stores the `GroundedFigures` bundle the paragraph was
written from, the `StreetGeneration.inputJson` precedent.

`MarketEditionGeneration.status` is a plain `String`, not the `GenerationStatus`
enum. That enum is Core's and did not resolve against the live database; a
Content-owned table taking a hard dependency on it would couple this tier's
migrations to Core's.

**2 · Template structure, live figures.** `src/lib/guides/guides.ts` holds all
six guides. No model writes a sentence in it. The one discipline that matters:
`sentence()` returns null when its figure is null and `para()` discards nulls,
so **a suppressed figure removes prose rather than damaging it**. No dash, no
zero, no sentence with a hole.

**3 · A Content-owned validator.** Assessed first, as the ruling asked.
**None of the four rules extracts unchanged.** `findUngroundedNumerics`,
`findZeroTierPrices` and `findUngroundedBuilderName` each take
`input: StreetGeneratorInput` and read `.aggregates` / `.quarterlyTrend` /
`.nearby` / `.primaryBuilder`; the `superlative` rule runs through
`maskGroundedProperNouns(text, input)`, also street-typed; and
`SUPERLATIVE_PHRASES` is module-private, so even the word list cannot be reused
without editing the file. **No Core branch was proposed and
`validateStreetGeneration.ts` was not touched.**

`src/lib/content/validateContentProse.ts` implements five rules against
`GroundedFigures` (`key` / `value` / `label` / `source` / `kind`, plus
`entities`): `ungrounded_number`, `superlative`, `invented_entity`,
`price_without_input`, and `punctuation`. The fifth is the house em-dash ban,
which is not optional anywhere in this codebase and should not be left to a
prompt to remember.

`scripts/test-content-validator.ts` is the **20th prebuild test, 55
assertions**, asserting BOTH directions on every rule — a validator that only
proves it fires is satisfied by one that fires on everything. **Proven red on a
weakened validator** (3 of 55 failed with the superlative rule stubbed out),
then green.

One known blind spot is asserted rather than hidden: a one-word invented place
opening a sentence is not caught. Closing it needs a dictionary, and firing on
every sentence opener would drop every paragraph while looking like a gate.

**4 · Condo fees.** Read from active listings only, per listing, with the same
`permAdvertise && displayAddress` gate every public count uses.
`CondoBuilding.avgMaintenanceFee` is deliberately not read — it is exactly the
derived figure the ruling excludes. 24 listings render, each linking to the
listing where the fee is stated. No address and no building name is rendered, so
this tier never reaches into the condo naming path.

**5 · Mortgage rate.** `src/data/policyRate.ts`: **2.25%, observed
2026-09-08**, Bank of Canada Valet series V39079, pulled once and committed with
its date, the `addressDirections.ts` pattern. The guide states in its first
paragraph that a policy rate is not a mortgage rate and that a lender's offer
will differ.

**6 · Schools.** Board, board name, level, grades, and a link per school.
Zero hits for catchment, zoned, feeder, "will attend" or "schools serve" on the
served page.

**ADDRESS AND DISTANCE ARE NOT SHIPPED, and this is a deviation.** The ruling
asked for board, address and distance. `src/lib/schools.ts` carries **no street
address**, and neither does the school page's own `PostalAddress` JSON-LD, which
holds locality, region and country only — the site has never had one. The
lat/lng some rows carry is a neighbourhood centroid, approximate to about 300 m
by the file's own comment, which is not a basis for a distance claim on a
town-level page with no origin point. The guide states plainly that it holds
neither rather than approximating either.

**9 · The weekly typical is the headline.** Town-wide median at n≥5, band at
n≥10, each checked per edition. A week below the floor renders a full-width row
saying so in prose. The 28-day by-form block ships with the same gates per form.
Lease is absent from v1 and the page says why.

**10 · Every window bounded to today.** Every DB2 query in
`src/lib/marketWatch/windows.ts` carries `sold_date <= NOW()`.

---

## 3. Four defects found while building, all fixed

**The Toronto week did not select the Toronto week.** `sold_date` is a
`timestamp with time zone` whose every value is **exactly UTC midnight** —
measured across all 3,961 Milton For Sale rows, the distinct time-of-day count
is one. Monday 00:00 Toronto is 04:00 UTC, four hours after every Monday row was
stamped, so a Toronto-instant window dropped the whole first day and pulled in
part of the next Monday. The week of 2026-08-31 returned **18** sales where the
day-by-day count is 22+5+2+4+7 = **40**. A week now carries two bases, named for
what they are: UTC-midnight date bounds for DB2's date-stamped column, Toronto
instants for DB1's `listedAt`, which is a real timestamp. Each query uses the one
matching its column. The edition now reads **40 and 43**, matching report 063's
independent measurement exactly.

**The validator called a grounded percentage invented.** The bundle carried a
sold-to-ask of 97.5 and the model wrote it without the `%` sign, so a grounded
percentage was checked as a bare count. Rule 1 now traces a figure rather than
its rendering. Caught by the first real generation, which fail-closed correctly
and published the edition without the paragraph.

**The condo guide published an absence that was not real.** `Listing` carries
two fee columns and only one is filled: `maintenanceFee` (Int) is 0 on all 73
active Milton condo listings, `maintenanceFeeAmt` (Float) carries the figure on
all 73. The query read the Int column, found nothing, and the page said "No
Milton condo currently for sale states a monthly maintenance fee." **A page
asserting an absence has to be as sure of the absence as it would be of a
figure.** Found by reading the served preview, not the local render.

**A raw TREB string reached prose.** The condo guide printed "1 bed, 1 parking,
owned locker, in 1032 - FO Ford." Same defect class as the street and condo
naming rules: a stored feed string is not a name.
`src/lib/content/neighbourhoodName.ts` is now the Content tier's single
resolver, reading `NEIGHBOURHOOD_SEED` — the same bridge
`getMiltonSoldByNeighbourhood` and the edition already cross. Market Watch was
already clean because it crossed that bridge; only the guide did not. **An
unmapped string returns null and the clause is dropped**, never a fallback to
the raw string, because the fallback is what put the code on the page.

A fifth, caught before it shipped: `/guides/[slug]` prerendered as SSG on the
first build, which would have frozen every live figure at build time.
`generateStaticParams` removed.

---

## 4. The first edition

`/market-watch/2026-08-31`, published, generated against real data.

```
SOLD      40   (previous week 43)
NEW       56
TYPICAL   $920,000        k>=5  satisfied
BAND      $750,000 .. $1,180,000   k>=10 satisfied
DOM       76
SOLD/ASK  97.5%
FORMS     detached 82, townhouse 42, condo 16, semi 13   (trailing 28 days)
NBHDS     12 with a sale
STREETS   32 with a published page
PARAGRAPH written, passed on attempt 1
COST      $0.0003
```

The deterministic sentence, generated by code:

> 40 homes sold in Milton in the week of 31 August 2026, 3 fewer than the week
> before. The typical sold price was $920,000, after 76 days on market.

The one generated paragraph, DeepSeek, validated:

> Sales of 40 were down from 43 the previous week, while the typical sold price
> of $920,000 sat below the 12-month figure of $930,000. At 76 days, the week
> moved faster than the 12-month 86 days, and the sold to ask figure of 97.5%
> shows the gap between asking and selling prices stayed narrow. The middle half
> of sales ran from $750,000 to $1,180,000, a range that puts the typical price
> closer to its lower edge.

Two prompt corrections were needed to get there and both are in the prompt now:
the first draft restated the ledger in raw unformatted numbers, and the second
compared a weekly count to a 12-month total and called it a finding.

**Zero em-dashes** across all six guides, the index and the edition, checked on
the served host.

---

## 5. The layout

The guides use the layout that was already in `src/components/guides/` and had
never been wired. One additive change: `GuideSection.links?`, because
`paragraphs: string[]` is plain text and could not carry an anchor, which left a
guide unable to link to the hub, street, listing or school page its own figures
came from. Optional, so the preview fixtures render as before.

Market Watch is a new layout: **a ledger, not a dashboard.** One vertical column
of ruled rows, label left in mono, figure right in Fraunces. **A suppressed
figure takes a full row and says why**, so an absence reads as a deliberate
entry rather than a tile that failed to load. Existing tokens only, no new
colour.

---

## 6. Not built, and why

**The "open this weekend" section is not in v1.** Open houses are read live from
AMPRE at request time and expire. An edition is immutable once published, so a
stored weekend is a lie by the following Tuesday, and a live block inside an
archived edition breaks the immutability the table exists to provide. The live
block belongs on the index page as its own piece of work.

**No cron is wired.** The Monday 06:00 slot is proposed, not scheduled. Wiring
a cron before the first edition has been reviewed would publish unreviewed
editions weekly.

**Up-links from hubs and streets back to the current edition are Core's**, per
ruling 7. Noted in `HANDOFF-content.md` as a request.

---

## 7. For Core

**192 For Sale rows and 53 For Lease rows in `sold.sold_records` carry a
`sold_date` in the future**, the furthest at 2027-01-29 against a database
`NOW()` of 2026-09-10 (report 063). Logged as a Core data bug per ruling 10, not
fixed here. Every Content window is bounded, so nothing in this tier publishes
them.

**`Listing.maintenanceFee` (Int) is dead** on all 73 active Milton condo
listings while `maintenanceFeeAmt` (Float) is populated on all 73. Two columns
for one fact, one of them empty, is a trap for the next reader.

**`SUPERLATIVE_PHRASES` is module-private** in `validateStreetGeneration.ts`.
The Content tier now keeps a second copy. Exporting the list would remove the
duplication; that is Core's call and Core's file.

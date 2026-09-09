# 060 — Address ladder: the six section changes, verified at HEAD

_2026-09-09. Branch `feat/address-anchors`, HEAD `59d4f9e29cdd922ea2f716947e352acdb8919d72`._

## What this task was

The brief re-stated the six changes to the address ladder. **All six were already built and
pushed in `c01a004`** on 2026-09-09; the commit after it, `59d4f9e`, is the handoff rewrite and
carries no code. So this run changed no component, no stylesheet and no library. What it did was
verify each of the six against the code and against a deployed host, and close item 6 — which had
not been done at HEAD, because the only preview that existed was one commit behind.

**No code changed. One audit artifact was added.** Anyone reading this expecting a diff of the
section will not find one, and that is the finding.

## The six, each against the thing that proves it

| | asked | where it lives | proof |
|---|---|---|---|
| 1 | ends never clipped | `END_PAD = 34`, applied at both ends of the placement walk and again in the height | corpus measurement: minimum top **34px** on 442 streets, **0** clipped |
| 2 | ticks in mono at the right edge, linked when published, ellipsis at 380px, title, summary links the same | `.s-addr-tick-l` (`var(--s-mono)` = JetBrains Mono, `text-overflow: ellipsis`, `max-width: 46%` at ≤560px); `linkableSlugs` from `contextCards.connectedStreets` | live on preview: pine-street draws 8 ticks, the 4 published ones link, the 4 unpublished carry no link, all 8 carry `title`, and the sentence links exactly the same 4 |
| 3 | position in words, fraction kept in `data-d` | `positionPhrase()` returns the five phrases verbatim; `detailOf()` appends `fraction.toFixed(2)` | guard asserts all five phrases and `data-d="…0.NN"` |
| 4 | the exact footer sentence | `.s-addr-src` | guard holds it verbatim; the deployed verifier re-checks it on all four streets |
| 5 | two CTAs, same design language, no new colour, name from `resolveStreetName` | `s-final` / `s-finalgrid` / `s-fcard` / `s-b1`, the page's own final-CTA card | guard asserts `/sell?street=Pine%20Street#valuation` and `#street-alert`; verifier confirms both on all four streets |
| 6 | every mark tappable at 380px when its label is suppressed | `.s-m.s-q { width: 58px; height: 14px }` at ≤560px, `DOT_GAP = 14` | corpus measurement below |

## The 380px measurement, corpus-wide

`scratchpad/audit/measure-380.ts`. Pure — `buildAddressLadder` takes its listing rows as an
argument, so passing none renders what the Town's data alone produces, and DB1 does not move a
mark. It renders every published street's section and reads the placement back out of the markup,
the same way the prebuild guard does, rather than asserting anything about the source.

```
streets with a ladder      442 of 444 published
marks rendered             27130
labels suppressed          13816
densest street             savoline-boulevard-milton (387 marks)
minimum same-side gap      14px  (hit area 14px)  at 25-side-road-milton even
minimum top                34px  (END_PAD 34px)
marks closer than the hit area   0
streets with a clipped end label 0
```

Half the corpus — 13,816 of 27,130 marks — is drawn as a bare dot with no number. Every one of
them is still a real target: the tightest same-side pair anywhere in Milton is **exactly 14px**,
which is the height the suppressed mark is given, and nothing is below it. The previous handoff
reported this from savoline alone; it holds on all 442.

## The one deviation from the brief, restated

**"Watch [Street]" does not point at a VIP signup, because there is no VIP signup in this
codebase.** `/exclusive` is a listings page with no form, and `#vip` on the homepage is a strip of
links. The CTA points at `#street-alert`, the live street-alert card already on the street page,
which posts `source: "street-alert"` with `property_address: <street name>` — so the street is
carried the way a prefill would carry it, without inventing a surface. A distinct VIP list is a
new surface and a new decision, not a rename of this one.

The owner CTA does prefill for real: `/sell?street=<name>#valuation`, and `HomeValuationCard`
reads `?street=` as the initial value of its address field. No house number and no figure travel.

## Gates

- **Local build** `pnpm build`, exit 0, 18/18 prebuild, zero `P2024`, 546 static pages.
  `test-address-anchors PASS · 52 assertions`.
- **Preview** `miltonly-qp2pdqh32`, `/api/build` reports the full HEAD SHA.
- **`scripts/verify/address-anchors.mjs`** PASS on that preview: four streets, each checked for
  the H2, numeric anchors, a resolving deep link, the verbatim footer, both CTAs, and an
  `ItemList` with no price.
- **Battery** `PASS · 9 checks · 444 pages · 56s`, exit 0, run against that preview with
  `EXPECT_SHA` at the full 40-character SHA. Two pre-existing NOTEs, both already open items:
  stored `HubContent.metaDescription` drift on 21 of 22 hubs (open item 15), and one stored
  description publishing a price off a sub-k pool. Neither is served and neither is new.

## The four anchor URLs

```
/streets/pine-street-milton#262
/streets/mae-court-milton#71
/streets/mcphail-way-milton#3165
/streets/bell-school-line-milton#7295
```

`bell-school-line-milton` is the one with no `StreetContent` row. It renders the ladder from the
Town projection anyway, which is why it is in the verifier's set: the address section does not
depend on a generated row.

## Not merged

Unchanged from 059: the preview gate applies and Aamir reviews before merge.

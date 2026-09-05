# 057 — Close-out: battery, and matching three clips to real streets

2026-09-05.

## 1. Battery on production

```
build       80f1324 served == expected
═══ PASS · 9 checks · 443 pages · 71s ═══   exit 0
```

Run against `https://miltonly.com` at `EXPECT_SHA=80f1324`. The build-SHA gate confirmed the
served deployment before any content assertion.

## 2. The three mis-slugged clips

### Method, and why it is not a line-on-line overlap

`src/data/townRoadFacts.ts` stores a **length-weighted centroid** per street, not a polyline, so
a true geometric overlap is not computable from the repo's road layer. What is available is
`src/data/townAddressPoints.ts`: 40,827 municipal rooftop points keyed by street identity. A
street's address points trace its frontage, so the measure used is:

> for each consecutive pair of GPS fixes, attribute the segment's length to the street whose
> nearest address point is closest, when that distance is within a 45 m corridor.

Summed, that is metres of trace driven alongside a street's frontage. 882 of 944 registry
streets have address points.

**Its limit, which decided two of the three cases.** Arterials and rural concession roads have
few or no fronting address points, because properties front the side streets instead. A method
tuned for residential streets under-detects exactly the two road types in question, so the Town
neighbourhood polygon containing the trace and the centroid distances were read alongside, and
where they disagreed the answer is "inconclusive" rather than a pick.

Contains information licensed under the Open Government Licence – Milton.

### `1st-line` -> **`first-line-milton`**, confirmed

```
source_raw 2026_0825_201513_000129F.MP4   60 fixes   trace 1357 m
first-line-milton     233 m overlap (17% of trace)
```

The only registry street matched anywhere along the trace. `first-line-milton` is a
**single-segment** street, so its length-weighted centroid is the street itself, and the trace
**ends 19 m from it** (start 1338 m, mid 670 m, end 19 m — the drive approaches and arrives).
Trace midpoint sits in the Trafalgar polygon, which is where First Line runs.

Acted on: objects copied to `streets/first-line-milton/night.mp4` and `poster.webp`,
`nightVideoUrl` + `nightCapturedAt` set, revalidated, **confirmed serving on production**, and
only then the orphan keys deleted. `published/1st-line` renamed to `published/first-line`.

### `bronte-street-south` -> **not Bronte Street. Unmatched.**

```
source_raw 2026_0830_180141_000378F.MP4   60 fixes   trace 371 m   attributed 130 m (35%)
etheridge-avenue-milton   63 m (17%)   centroid 831 m
holbrook-court-milton     49 m (13%)   centroid  97 m
hatt-court-milton         18 m ( 5%)   centroid 148 m
bronte-street-milton       0 m         centroid 2492 m
```

Trace midpoint is in the **Walker** polygon, deep in a residential pocket. Bronte Street is
2.5 km away and picks up no overlap at all. The staged slug is wrong.

**What it actually is remains open.** 35% attribution over a 371 m trace, split three ways
between an avenue and two courts, is not an identification. `etheridge-avenue-milton` leads on
overlap but its centroid is 831 m off (15 segments); `holbrook-court-milton` leads on centroid
at 97 m but on only 49 m of overlap. **`etheridge-avenue-milton` already carries its own day
clip**, so guessing wrong here would overwrite a correct video with footage of a different
street.

Not re-keyed. Objects remain at `streets/bronte-street-south-milton/`, referenced by no page.

### `lower-base-line-west` -> **not Lower Base Line. Unmatched.**

```
source_raw 2026_0825_201313_000127F.MP4   60 fixes   trace 971 m   attributed 288 m (30%)
tremaine-road-milton      186 m (19%)   centroid 5934 m
lower-base-line-milton    102 m (10%)   centroid 6123 m
first-line-milton           0 m         centroid 2121 m
```

Both "matches" have centroids about **6 km** from the trace, which means the address points
they matched are outliers at the far ends of very long rural roads, not evidence of proximity.
Trace midpoint is in the **Trafalgar** polygon.

Worth noting: this clip is `000127F` and the First Line clip is `000129F`, captured two minutes
apart on the same drive, and their bounding boxes are about 2 km apart. The vehicle was working
its way along rural Trafalgar. That is consistent with several roads and settles nothing.

Not re-keyed. Objects remain at `streets/lower-base-line-west-milton/`, referenced by no page.

Both unresolved clips now carry `match_status: "unmatched"` and a `match_note` in their
`meta.json`, so the next pass does not re-run them blind.

## 3. `lower-base-line-milton` generated

It passes the generation gate (`getStreetStats` returns an object), and it is a registry street
with an entity and no page, so it was generated on its own merits.

| | |
|---|---|
| attempts | 3 |
| cost | **$0.009** |
| judge | PASS |
| words | 919 |
| dollar figures | 3, **all grounded** |

Published and revalidated. **No video wired**: the clip staged under
`lower-base-line-west` is not this street on the evidence above, and attaching it would be
asserting something the GPS does not support.

## A fabricated figure found on an existing page

Auditing `first-line-milton` after wiring video to it turned up a live defect that predates the
grounding rules:

```
first-line-milton   inputHasNoPriceAtAnyGrain=true
  $1.5M  -> NO INPUT MATCH   ctx: "...rea, comparable homes trade around $1.5M..."
```

Its input carries no price at any grain, and the published page stated one. I had just made that
page more prominent by giving it video, so I regenerated it. The new rules fired on the retry
exactly as intended:

```
zero_tier_price: FAQ "$1.1M" - input carries no price at any grain
zero_tier_price in section "neighbourhoodComparable": "$850,000" - input carries no price at any grain
```

PASS on attempt 3, **$0.009**, and the page now carries **no dollar figure at all**, which is
correct for a street with no price in its payload. Video survived the regeneration (the upsert's
update branch does not touch the video columns) and is confirmed serving.

**This is a corpus-level finding, not a one-off.** `first-line-milton` was generated before
DEC-GROUNDING-ZERO existed and has been serving an invented price ever since. Every page
generated before 2026-09-04 is in that population. An audit sweep of the published corpus with
`scripts/audit-figure-grounding.ts` is the obvious next move and has not been run.

## State at the end

| | |
|---|---|
| battery | **PASS · 9 checks · 443 pages**, exit 0, at `EXPECT_SHA=80f1324` |
| sitemap | **443 -> 444** (`lower-base-line-milton` added) |
| generation cost this run | **$0.018** (`lower-base-line` $0.009 + `first-line` $0.009) |
| R2 | 2 objects deleted (the `1st-line` orphans), 2 copied to `first-line-milton` |
| clips still orphaned | **2**: `bronte-street-south`, `lower-base-line-west` |
| manifest | 45 rows, 45 published, 0 staged |

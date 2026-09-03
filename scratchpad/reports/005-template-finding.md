The layout title template is worse than an 84px tax. `src/lib/seo.ts:32` returns `title` as a plain string, so the template at `src/app/layout.tsx:75` (`template: "%s | Miltonly"`) applies to every `genMeta` route — and **8 routes already embed the brand in their own title**, so they render it twice:

```
signin        "Sign In — Miltonly"                  -> Sign In — Miltonly | Miltonly
saved         "Saved Listings & Alerts — Miltonly"  -> ...— Miltonly | Miltonly
rentals       "Milton Rentals — Let Miltonly Find…" -> ...Find Your Home | Miltonly
rentals/ads   "Milton Rentals | Miltonly"           -> Milton Rentals | Miltonly | Miltonly
sales/ads     "Milton Real Estate | Miltonly"       -> Milton Real Estate | Miltonly | Miltonly
not-found     "Page not found — Miltonly"           -> ...— Miltonly | Miltonly
coming-soon   "Miltonly — Launching Soon"           -> Miltonly — Launching Soon | Miltonly
exclusive/*   "...| Miltonly"                       -> ...| Miltonly | Miltonly
```

`layout.tsx:86` and `:100` are the `openGraph` and `twitter` titles — those do not take the template, so they are fine.

## Consequence for the fix

The template is not only costing street pages 84px; it is producing a doubled brand across eight routes, two of them dynamic. That argues for **deleting the template globally** rather than a per-route `title: { absolute: ... }` override — the override fixes 431 street pages and leaves eight routes still stuttering their own name.

Cost side still being counted: how many routes would *lose* the brand entirely under a global delete. Recommendation follows with that number attached.

## Formula work in flight

Four candidates measured end-to-end across all 431 streets:
- real pixel widths (Arial 20px, Google's ~580px cut)
- truncation counts
- duplicate-group counts at the 120 and 155 char cuts
- a check that no candidate reintroduces the lease-counted-as-sales disagreement

Judged on three independent lenses (truncation-safety, factual-correctness, click-appeal), then synthesized into one formula.

Deliverable will be: the formula, rendered examples across the range, and the remove-vs-override recommendation.

## Baseline the formula is measured against

| Metric | Today |
|---|---|
| Titles over 580px | 298/431 with template, 12/431 without |
| Descriptions over 155 chars | 426/431 |
| Descriptions over 120 chars (mobile) | 431/431 |
| Duplicate groups at 120 chars | 37 groups covering 180 pages |
| Pages whose stated count disagrees with their own "Sales tracked" tile | 296 |

## Pairs with the GSC pull

Particularly the page-level export — if the impression distribution is long-tailed, that decides whether this is worth doing across 431 pages or just the top slice.

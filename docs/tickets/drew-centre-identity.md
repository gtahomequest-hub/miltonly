# Ticket: drew-centre-milton street-vs-condo identity is unresolvable

## Problem
Batch-001 external audit (2026-07-19, finding B15 / standards 5.12+5.6):
the published page for `drew-centre-milton` cannot decide what it is.
Frontmatter and H1 say `Drew Centre 1601`; every body section says
`Drew Centre 2910`. The prose describes it as both "a short, quiet
street in Milton's Timberlea neighbourhood" and "a condo building
address". Subject identity is unresolvable, so every claim on the page
is unanchored.

Root cause candidates (unverified):
- DB2 sold_records for Drew Centre carry unit-address rows (1601/2910
  are building numbers) that the street-slug derivation collapses into
  one "street" identity.
- Drew Centre is plausibly a condo-building address that should route
  through the WS5 condo pipeline (pageType: condo) instead of the
  street generator. The missing `pageType` field is what makes this
  undeterminable downstream (the exact failure 5.12's page-type
  requirement exists to catch).

## Scope
- Inspect DB2 rows for drew-centre siblings: address shapes, unit
  counts, building numbers.
- Decide the canonical subject: one condo building page per civic
  number (condo pipeline), or exclude from the street universe.
- If condo: route through generateCondoBuildingContent; retire the
  street page with a redirect. If excluded: drop from sitemap +
  streetContent, 410/redirect.
- Add a guard so mixed building-number identities fail generation
  rather than blending (the condo-tier identity split already exists;
  the street tier needs the same fail-closed check).

## Estimated effort
1-2 h investigation + decision; implementation depends on route chosen.

## Priority
High for that page (it is published and self-contradictory — currently
mitigated only by the batch-001 regen wave gating). Low blast radius:
one slug, but the identity-guard piece protects the whole universe.

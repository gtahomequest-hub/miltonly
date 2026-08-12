// k-anonymity floors — THE single source. Import these; do not restate them.
//
// Ratified thresholds, applied identically on every surface that publishes a
// sold-derived figure (street pages, hubs, condo buildings, /sold aggregates,
// generator inputs, API routes):
//
//   K_ANON_PRICE  a typical/median/average price, DOM or sold-to-ask ratio
//   K_ANON_RANGE  a low–high range (a range leaks its own endpoints, so it
//                 takes a higher floor than a central tendency)
//   K_IDENTITY    below this on BOTH sale and lease a page is identity-only
//
// THE FLOOR IS ONLY HALF THE RULE. A floor must be checked against the EXACT
// sample the figure is computed over. Guarding on a 90-day count while
// publishing a 12-month average is not a guard — it checks a sample it does
// not release. Where a stored row cannot tell you the n behind a figure, the
// figure cannot be published.
export const K_ANON_PRICE = 5;
export const K_ANON_RANGE = 10;
export const K_IDENTITY = 3;

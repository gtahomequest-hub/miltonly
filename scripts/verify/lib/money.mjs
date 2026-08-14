// Published figures are compared AS DISPLAYED, on WHOLE TOKENS.
//
// Two defects, both of which made a clean page look broken:
//   · comparing raw numbers flagged 19 pages as publishing a sub-k 90-day average when they were
//     publishing the entitled 12-month average, which merely rounds to the same display step
//     (aird-court: $900K off 7 sales; the 4-sale d90 average also rounds to $900K). Whatever is
//     indistinguishable once published is not evidence about what was published.
//   · substring matching flagged aspen-terrace, because "$1.1M".includes("1M") is true.

/** The display step the page rounds a price to before publishing it. */
export function roundForDisplay(p) {
  if (!Number.isFinite(p) || p <= 0) return 0;
  const step = p < 5e5 ? 1e4 : p < 1e6 ? 25e3 : p < 2e6 ? 5e4 : 1e5;
  return Math.round(p / step) * step;
}

export function shortCAD(n) {
  if (!Number.isFinite(n)) return null;
  return Math.abs(n) >= 1e6 ? `$${(n / 1e6).toFixed(2).replace(/\.?0+$/, '')}M`
    : Math.abs(n) >= 1e3 ? `$${Math.round(n / 1e3)}K`
    : `$${Math.round(n).toLocaleString()}`;
}

/** A raw figure, exactly as the page would print it. */
export const asPublished = (n) => (n === null || n === undefined ? null : shortCAD(roundForDisplay(Number(n))));

/** The money token out of a rendered value, which may carry a trailing basis line
 *  ("$900K · across 7 sales in the last 12 months"). */
export function moneyToken(v) {
  if (!v) return null;
  const m = String(v).match(/\$\s?[\d.,]+\s?[KM]?/);
  return m ? m[0].replace(/\s/g, '') : null;
}

/** Whole-token equality between a rendered value and a figure. Never a substring. */
export const publishes = (rendered, figure) => !!rendered && !!figure && moneyToken(rendered) === figure;

export const num = (x) => (x === null || x === undefined || x === '' ? null : Number(x));

// src/lib/figureFormat.ts
// THE FIGURE FORMATTERS. Pure, importable from either side of the server/client boundary.
//
// The mega menu shipped "$937,465.504", "27.829694323144103" and "0.980868783307145%" because
// the component formatted raw numbers itself, with its own helpers, and got every one wrong.
// The Board on the same page had the right helpers as module-local functions that nothing else
// could import. So they live here now: one definition each, imported by the Board (a client
// component) and by the menu's server-side composer, so two surfaces cannot render one figure
// two ways. A figure that crosses a component boundary is formatted ONCE, here, and travels as
// a string.
//
// A null is the suppression state and renders the Board's null glyph: a lone dash with no
// letters in the node, which the em-dash gate exempts by that rule.

export const NULL_GLYPH = "—";

/** A whole count: 1116 -> "1,116". */
export const formatCount = (n: number | null | undefined): string =>
  n === null || n === undefined || !Number.isFinite(n) ? NULL_GLYPH : Math.round(n).toLocaleString("en-CA");

/** A listing price in whole dollars, as the feed states it: 949900 -> "$949,900". */
export const formatMoneyWhole = (n: number): string => `$${Math.round(n).toLocaleString("en-CA")}`;

/** A derived price, to the nearest thousand: 937465.5 -> "$937,000". The Board's money1k. */
export const formatMoney1k = (n: number | null | undefined): string =>
  n === null || n === undefined || !Number.isFinite(n) ? NULL_GLYPH : `$${(Math.round(n / 1000) * 1000).toLocaleString("en-CA")}`;

/** A RATIO to one-decimal percent: 0.9809 -> "98.1%". The Board's pct1. The unit conversion
 *  lives here and nowhere else; the caller passes the ratio, never a percent. */
export const formatPct1 = (ratio: number | null | undefined): string =>
  ratio === null || ratio === undefined || !Number.isFinite(ratio) ? NULL_GLYPH : `${(ratio * 100).toFixed(1)}%`;

/** A day count: 27.83 -> "28 days"; 1 -> "1 day". */
export const formatDays = (n: number | null | undefined): string => {
  if (n === null || n === undefined || !Number.isFinite(n)) return NULL_GLYPH;
  const d = Math.round(n);
  return `${d} ${d === 1 ? "day" : "days"}`;
};

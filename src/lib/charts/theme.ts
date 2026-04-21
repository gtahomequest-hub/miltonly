// Shared Recharts theme for street-page charts. Components spread these
// defaults onto their chart elements so visual consistency is enforced in
// one place rather than duplicated per chart.
//
// Colors resolve via CSS variables at runtime (works with Tailwind tokens).
// Fonts reference the same custom properties loaded in globals.css.

export const chartColors = {
  primary: "var(--navy)",
  secondary: "var(--blue)",
  accent: "var(--gold)",
  muted: "var(--blue-muted)",
  axis: "var(--ink-faint)",
  grid: "var(--line)",
  surface: "var(--paper-warm)",
  tooltipBg: "var(--navy)",
  tooltipText: "#ffffff",
} as const;

export const chartFonts = {
  tick: {
    fontFamily: "var(--mono)",
    fontSize: 11,
    letterSpacing: "0.08em",
    fill: "var(--ink-faint)",
    textTransform: "uppercase",
  },
  label: {
    fontFamily: "var(--serif)",
    fontSize: 14,
    fill: "var(--navy)",
  },
} as const;

export const cartesianGridProps = {
  stroke: "var(--line)",
  strokeDasharray: "2 3",
  vertical: false,
} as const;

export const xAxisProps = {
  stroke: "var(--line)",
  tick: { ...chartFonts.tick } as object,
  tickLine: false,
  axisLine: { stroke: "var(--line)" },
} as const;

export const yAxisProps = {
  stroke: "var(--line)",
  tick: { ...chartFonts.tick } as object,
  tickLine: false,
  axisLine: false,
  width: 64,
} as const;

/**
 * Domain helper for CAD-price Y-axes. Starts the axis at ~90% of the minimum
 * data value rounded down to a sensible step size, so charts visually focus
 * on the active price range instead of padding the bottom with "$0" ticks.
 *
 * Step size scales with magnitude so the same helper works for sale-price
 * charts ($400K-$2M) and lease charts ($1,500-$5,000).
 *
 * Usage: `<YAxis domain={priceDomain} tickFormatter={formatCADShort} />`
 */
export const priceDomain: [
  (dataMin: number) => number,
  "auto",
] = [
  (dataMin: number) => {
    const floor90 = Math.max(0, dataMin * 0.9);
    const step =
      floor90 >= 100_000 ? 50_000 :
      floor90 >= 10_000 ? 5_000 :
      floor90 >= 1_000 ? 500 : 100;
    return Math.floor(floor90 / step) * step;
  },
  "auto",
];

export const tooltipStyle = {
  contentStyle: {
    background: "var(--navy)",
    border: "1px solid var(--line-dark)",
    borderRadius: 0,
    color: "#ffffff",
    fontFamily: "var(--sans)",
    fontSize: 13,
    padding: "10px 14px",
  } as const,
  labelStyle: {
    color: "var(--gold)",
    fontFamily: "var(--mono)",
    fontSize: 11,
    letterSpacing: "0.1em",
    textTransform: "uppercase" as const,
    marginBottom: 4,
  } as const,
  itemStyle: {
    color: "#ffffff",
    fontFamily: "var(--sans)",
    fontSize: 13,
  } as const,
};

export const lineSeriesProps = {
  stroke: "var(--navy)",
  strokeWidth: 2,
  dot: { r: 3, fill: "var(--navy)", stroke: "var(--navy)" },
  activeDot: { r: 5, fill: "var(--gold)", stroke: "var(--navy)", strokeWidth: 2 },
} as const;

export const barSeriesProps = {
  fill: "var(--blue)",
  radius: [0, 0, 0, 0],
} as const;

/** Helper: $1.24M / $986K / $7,200 */
export function formatCADShort(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2).replace(/\.?0+$/, "")}M`;
  if (Math.abs(n) >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${Math.round(n).toLocaleString()}`;
}

/** Helper: $986,000 */
export function formatCAD(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return `$${Math.round(n).toLocaleString()}`;
}

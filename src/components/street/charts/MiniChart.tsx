"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  cartesianGridProps,
  formatCADShort,
  priceDomain,
  tooltipStyle,
  xAxisProps,
  yAxisProps,
} from "@/lib/charts/theme";
import type { QuarterlyDataPoint } from "@/types/street";

interface MiniChartProps {
  data: QuarterlyDataPoint[];
  /** Alternate stroke color for leased subsections. */
  variant?: "sold" | "leased";
}

export function MiniChart({ data, variant = "sold" }: MiniChartProps) {
  const stroke = variant === "leased" ? "var(--blue-muted)" : "var(--navy)";
  const fill = variant === "leased" ? "rgba(79, 123, 194, 0.12)" : "rgba(11, 31, 63, 0.1)";

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={`mini-grad-${variant}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity={0.24} />
            <stop offset="100%" stopColor={stroke} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid {...cartesianGridProps} />
        <XAxis dataKey="quarter" {...xAxisProps} />
        <YAxis
          {...yAxisProps}
          domain={priceDomain}
          tickFormatter={(v: number) => formatCADShort(v)}
        />
        <Tooltip
          {...tooltipStyle}
          formatter={(v) => [formatCADShort(Number(v) || 0), "Typical"]}
          cursor={{ stroke: "var(--gold)", strokeWidth: 1, strokeDasharray: "3 3" }}
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke={stroke}
          strokeWidth={2}
          fill={`url(#mini-grad-${variant})`}
          activeDot={{ r: 5, fill: "var(--gold)", stroke: stroke, strokeWidth: 2 }}
        />
        {/* render fill separately for Safari gradient stability */}
        <Area type="monotone" dataKey="value" stroke="transparent" fill={fill} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

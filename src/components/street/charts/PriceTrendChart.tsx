"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
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

interface PriceTrendChartProps {
  data: QuarterlyDataPoint[];
}

export function PriceTrendChart({ data }: PriceTrendChartProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid {...cartesianGridProps} />
        <XAxis dataKey="quarter" {...xAxisProps} />
        <YAxis
          yAxisId="price"
          {...yAxisProps}
          domain={priceDomain}
          tickFormatter={(v: number) => formatCADShort(v)}
        />
        <YAxis
          yAxisId="count"
          orientation="right"
          {...yAxisProps}
          tickFormatter={(v: number) => `${v}`}
          width={48}
        />
        <Tooltip
          {...tooltipStyle}
          formatter={(v, key) => {
            const n = Number(v) || 0;
            const label = typeof key === "string" ? key : String(key);
            return label === "value"
              ? [formatCADShort(n), "Typical sold"]
              : [n, "Transactions"];
          }}
          cursor={{ stroke: "var(--gold)", strokeWidth: 1, strokeDasharray: "3 3" }}
        />
        <Bar
          yAxisId="count"
          dataKey="count"
          fill="var(--paper-warm)"
          stroke="var(--line)"
          barSize={22}
        />
        <Line
          yAxisId="price"
          type="monotone"
          dataKey="value"
          stroke="var(--navy)"
          strokeWidth={2}
          dot={{ r: 3, fill: "var(--navy)", stroke: "var(--navy)" }}
          activeDot={{ r: 6, fill: "var(--gold)", stroke: "var(--navy)", strokeWidth: 2 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

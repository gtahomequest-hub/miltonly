"use client";

// 24-month price trend line chart. Client component because recharts needs
// a browser. Call only for authed users — receives already-fetched data.

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface Point {
  year: number;
  month: number;
  avg_sold_price: number | null;
  sold_count: number;
}

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function PriceTrendChart({ data }: { data: Point[] }) {
  const chartData = data
    .filter((p) => p.avg_sold_price !== null && p.avg_sold_price > 0)
    .map((p) => ({
      label: `${MONTH_SHORT[p.month - 1]} ${String(p.year).slice(2)}`,
      price: Math.round(p.avg_sold_price ?? 0),
      count: p.sold_count,
    }));

  if (chartData.length < 2) {
    return (
      <div className="bg-[#f8f9fb] border border-[#e2e8f0] rounded-xl p-10 text-center">
        <p className="text-[13px] text-[#64748b]">Not enough monthly sales data to chart yet.</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-[#e2e8f0] rounded-xl p-5" style={{ width: "100%", height: 320 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748b" }} />
          <YAxis
            tick={{ fontSize: 11, fill: "#64748b" }}
            tickFormatter={(v: number) => v >= 1_000_000 ? `$${(v / 1_000_000).toFixed(1)}M` : `$${Math.round(v / 1000)}K`}
          />
          <Tooltip
            formatter={(v) => {
              const n = typeof v === "number" ? v : Number(v) || 0;
              return [`$${Math.round(n).toLocaleString()}`, "Avg sold"];
            }}
            labelStyle={{ fontSize: 11, color: "#07111f" }}
            contentStyle={{ fontSize: 12, borderRadius: 8 }}
          />
          <Line
            type="monotone"
            dataKey="price"
            stroke="#2563eb"
            strokeWidth={2.5}
            dot={{ r: 3, fill: "#2563eb" }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

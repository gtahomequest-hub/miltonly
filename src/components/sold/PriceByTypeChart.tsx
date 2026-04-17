"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

interface Props {
  detached: number | null;
  semi: number | null;
  town: number | null;
  condo: number | null;
}

const COLORS = ["#0a1628", "#1e3a5f", "#2563eb", "#60a5fa"];

export default function PriceByTypeChart({ detached, semi, town, condo }: Props) {
  const data = [
    { label: "Detached", price: detached },
    { label: "Semi", price: semi },
    { label: "Town", price: town },
    { label: "Condo", price: condo },
  ]
    .filter((d) => d.price !== null && d.price > 0)
    .map((d) => ({ label: d.label, price: Math.round(d.price ?? 0) }));

  if (data.length === 0) {
    return (
      <div className="bg-[#f8f9fb] border border-[#e2e8f0] rounded-xl p-10 text-center">
        <p className="text-[13px] text-[#64748b]">Not enough recent sales to chart yet.</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-[#e2e8f0] rounded-xl p-5" style={{ width: "100%", height: 280 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#64748b" }} />
          <YAxis
            tick={{ fontSize: 11, fill: "#64748b" }}
            tickFormatter={(v: number) => v >= 1_000_000 ? `$${(v / 1_000_000).toFixed(1)}M` : `$${Math.round(v / 1000)}K`}
          />
          <Tooltip
            formatter={(v) => {
              const n = typeof v === "number" ? v : Number(v) || 0;
              return [`$${Math.round(n).toLocaleString()}`, "Avg sold"];
            }}
            contentStyle={{ fontSize: 12, borderRadius: 8 }}
          />
          <Bar dataKey="price" radius={[6, 6, 0, 0]}>
            {data.map((_, i) => (<Cell key={i} fill={COLORS[i % COLORS.length]} />))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

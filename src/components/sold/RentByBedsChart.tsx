"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

interface Props {
  oneBed: number | null;
  twoBed: number | null;
  threeBed: number | null;
  fourBed: number | null;
}

const COLORS = ["#2563eb", "#3b82f6", "#60a5fa", "#93c5fd"];

export default function RentByBedsChart({ oneBed, twoBed, threeBed, fourBed }: Props) {
  const data = [
    { label: "1 bed", rent: oneBed },
    { label: "2 bed", rent: twoBed },
    { label: "3 bed", rent: threeBed },
    { label: "4+ bed", rent: fourBed },
  ]
    .filter((d) => d.rent !== null && d.rent > 0)
    .map((d) => ({ label: d.label, rent: Math.round(d.rent ?? 0) }));

  if (data.length === 0) {
    return (
      <div className="bg-[#f8f9fb] border border-[#e2e8f0] rounded-xl p-10 text-center">
        <p className="text-[13px] text-[#64748b]">Not enough rental data to chart yet.</p>
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
            tickFormatter={(v: number) => `$${Math.round(v / 100) / 10}K`}
          />
          <Tooltip
            formatter={(v) => {
              const n = typeof v === "number" ? v : Number(v) || 0;
              return [`$${Math.round(n).toLocaleString()}/mo`, "Avg rent"];
            }}
            contentStyle={{ fontSize: 12, borderRadius: 8 }}
          />
          <Bar dataKey="rent" radius={[6, 6, 0, 0]}>
            {data.map((_, i) => (<Cell key={i} fill={COLORS[i % COLORS.length]} />))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

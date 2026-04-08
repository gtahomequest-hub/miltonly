export default function TrustBarSection() {
  return (
    <section className="bg-[#f8f9fb]">
      <h2 className="sr-only">Milton market at a glance</h2>

      {/* Row 1: Trust bar */}
      <div className="flex flex-wrap justify-center items-center gap-x-11 gap-y-3 px-5 sm:px-11 py-[18px] border-b border-[#e9ecef]">
        {[
          { color: "#22c55e", text: "500+ Milton families helped" },
          { color: "#f59e0b", text: "4.9 ★ Google rating" },
          { color: "#2563eb", text: "Live TREB data daily" },
          { color: "#f59e0b", text: "Milton-only specialist" },
        ].map((item) => (
          <span key={item.text} className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: item.color }} />
            <span className="text-[12px] text-[#64748b] font-medium">{item.text}</span>
          </span>
        ))}
      </div>

      {/* Row 2: Stats bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 px-5 sm:px-11 py-7 border-b border-[#e9ecef]">
        {[
          { value: "$1.24M", label: "Avg sold price", trend: "↑ 4.2% this month" },
          { value: "47", label: "Listed today", trend: "↑ 5 new this morning" },
          { value: "11 days", label: "Avg days on market", trend: "↓ selling faster" },
          { value: "23", label: "Sold this week", trend: "↑ 5 more than last week" },
        ].map((stat, i) => (
          <div
            key={stat.label}
            className={`text-center py-3 md:py-0 px-6 ${i < 3 ? "md:border-r md:border-[#e2e8f0]" : ""}`}
          >
            <p className="text-[28px] sm:text-[32px] font-extrabold text-[#07111f] tracking-[-0.5px]">{stat.value}</p>
            <p className="text-[12px] text-[#64748b] font-semibold mt-1">{stat.label}</p>
            <p className="text-[11px] text-[#22c55e] font-bold mt-[3px]">{stat.trend}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

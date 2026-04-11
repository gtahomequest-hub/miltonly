import { formatPrice } from "@/lib/format";

interface Props {
  stats: {
    activeCount: number;
    avgDetached: number;
    detachedCount: number;
    avgSemi: number;
    semiCount: number;
    avgCondo: number;
    condoCount: number;
    avgRent: number;
    rentalCount: number;
  };
}

export default function TrustBarSection({ stats }: Props) {
  return (
    <section className="bg-[#f8f9fb]">
      <h2 className="sr-only">Milton market at a glance</h2>

      {/* Trust bar */}
      <div className="flex flex-wrap justify-center items-center gap-x-11 gap-y-3 px-5 sm:px-11 py-[18px] border-b border-[#e9ecef]">
        {[
          { color: "#f59e0b", text: "14 years full-time experience" },
          { color: "#f59e0b", text: "🏆 RE/MAX Hall of Fame" },
          { color: "#f59e0b", text: "Live TREB data daily" },
          { color: "#f59e0b", text: "Milton-only specialist" },
        ].map((item) => (
          <span key={item.text} className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: item.color }} />
            <span className="text-[12px] text-[#64748b] font-medium">{item.text}</span>
          </span>
        ))}
      </div>

      {/* Stats bar — real data from active listings */}
      <div className="grid grid-cols-2 md:grid-cols-5 px-5 sm:px-11 py-7 border-b border-[#e9ecef]">
        {[
          { value: formatPrice(stats.avgDetached), label: "Detached avg", trend: `${stats.detachedCount} active` },
          { value: formatPrice(stats.avgSemi), label: "Semi avg", trend: `${stats.semiCount} active` },
          { value: formatPrice(stats.avgCondo), label: "Condo avg", trend: `${stats.condoCount} active` },
          { value: `$${stats.avgRent.toLocaleString()}/mo`, label: "Avg rent", trend: `${stats.rentalCount} rentals` },
          { value: String(stats.activeCount), label: "Active now", trend: "updated daily" },
        ].map((stat, i) => (
          <div
            key={stat.label}
            className={`text-center py-3 md:py-0 px-4 ${i < 4 ? "md:border-r md:border-[#e2e8f0]" : ""}`}
          >
            <p className="text-[26px] sm:text-[30px] font-extrabold text-[#07111f] tracking-[-0.5px]">{stat.value}</p>
            <p className="text-[12px] text-[#64748b] font-semibold mt-1">{stat.label}</p>
            <p className="text-[11px] text-[#f59e0b] font-bold mt-[3px]">{stat.trend}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

import Link from "next/link";
import { formatPrice } from "@/lib/format";
import { config } from "@/lib/config";

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
  soldLast30: number;
}

export default function TrustBarSection({ stats, soldLast30 }: Props) {
  return (
    <section className="bg-[#f8f9fb]">
      <h2 className="sr-only">{config.CITY_NAME} market at a glance</h2>

      {/* Trust bar */}
      <div className="flex flex-wrap justify-center items-center gap-x-11 gap-y-3 px-5 sm:px-11 py-[18px] border-b border-[#e9ecef]">
        {[
          { color: "#f59e0b", text: `${config.realtor.yearsExperience} years full-time experience` },
          { color: "#f59e0b", text: "🏆 RE/MAX Hall of Fame" },
          { color: "#f59e0b", text: "Live TREB data daily" },
          { color: "#f59e0b", text: `${config.CITY_NAME}-only specialist` },
        ].map((item) => (
          <span key={item.text} className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: item.color }} />
            <span className="text-[12px] text-[#64748b] font-medium">{item.text}</span>
          </span>
        ))}
      </div>

      {/* Stats bar — real data from active listings + VOW sold totals */}
      <div className="grid grid-cols-2 md:grid-cols-6 px-5 sm:px-11 py-7 border-b border-[#e9ecef]">
        {[
          { value: formatPrice(stats.avgDetached), label: "Detached avg", trend: `${stats.detachedCount} active`, href: null },
          { value: formatPrice(stats.avgSemi), label: "Semi avg", trend: `${stats.semiCount} active`, href: null },
          { value: formatPrice(stats.avgCondo), label: "Condo avg", trend: `${stats.condoCount} active`, href: null },
          { value: `$${stats.avgRent.toLocaleString()}/mo`, label: "Avg rent", trend: `${stats.rentalCount} rentals`, href: null },
          { value: String(stats.activeCount), label: "Active now", trend: "updated daily", href: null },
          { value: String(soldLast30), label: "Sold (30d)", trend: "see recent sales", href: "/sold" },
        ].map((stat, i) => {
          const inner = (
            <>
              <p className="text-[26px] sm:text-[30px] font-extrabold text-[#07111f] tracking-[-0.5px]">{stat.value}</p>
              <p className="text-[12px] text-[#64748b] font-semibold mt-1">{stat.label}</p>
              <p className="text-[11px] text-[#f59e0b] font-bold mt-[3px]">{stat.trend}</p>
            </>
          );
          const cls = `text-center py-3 md:py-0 px-4 ${i < 5 ? "md:border-r md:border-[#e2e8f0]" : ""}`;
          return stat.href ? (
            <Link key={stat.label} href={stat.href} className={`${cls} hover:bg-white transition-colors`}>
              {inner}
            </Link>
          ) : (
            <div key={stat.label} className={cls}>
              {inner}
            </div>
          );
        })}
      </div>
    </section>
  );
}

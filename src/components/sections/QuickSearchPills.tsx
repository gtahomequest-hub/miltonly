"use client";

import Link from "next/link";

const pills = [
  { label: "Detached in Willmott", hot: true, href: "/listings?type=detached&neighbourhood=willmott" },
  { label: "4-bed under $1.1M", hot: false, href: "/listings?beds=4&maxPrice=1100000" },
  { label: "Near Craig Kielburger", hot: false, href: "/listings?q=Craig+Kielburger" },
  { label: "Walk to GO station", hot: false, href: "/streets" },
  { label: "Open houses this weekend", hot: true, href: "/listings?openHouse=true" },
  { label: "New builds Milton", hot: false, href: "/listings?type=new-build" },
  { label: "Condos under $700K", hot: false, href: "/listings?type=condo&maxPrice=700000" },
  { label: "Price reduced this week", hot: false, href: "/listings?priceReduced=true" },
];

export default function QuickSearchPills() {
  return (
    <section className="bg-white border-b border-[#f1f5f9]">
      <h2 className="sr-only">Popular Milton real estate searches</h2>
      <div className="flex items-center flex-wrap gap-2 px-5 sm:px-11 py-5">
        <span className="text-[11px] text-[#94a3b8] font-semibold uppercase tracking-[0.08em] shrink-0 mr-1">
          Popular searches
        </span>
        {pills.map((p) => (
          <Link
            key={p.label}
            href={p.href}
            className={`text-[12px] font-medium px-[14px] py-[6px] rounded-full border transition-colors ${
              p.hot
                ? "bg-[#fef3c7] text-[#92400e] border-[#f59e0b] font-bold hover:bg-[#fde68a]"
                : "bg-[#f8fafc] text-[#475569] border-[#e2e8f0] hover:border-[#94a3b8]"
            }`}
          >
            {p.label}
          </Link>
        ))}
      </div>
    </section>
  );
}

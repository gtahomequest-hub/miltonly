"use client";

import Link from "next/link";

const pills = [
  { label: "Detached in Willmott", href: "/listings?type=detached&neighbourhood=willmott" },
  { label: "4-bed under $1.1M", href: "/listings?beds=4&maxPrice=1100000" },
  { label: "Near Craig Kielburger", href: "/school-zones/craig-kielburger" },
  { label: "Walk to Milton GO", href: "/go-train" },
  { label: "Open Houses This Weekend", href: "/listings?openHouse=true" },
  { label: "New Builds in Milton", href: "/listings?type=new-build" },
  { label: "Price Reduced This Week", href: "/listings?priceReduced=true" },
  { label: "Condos Under $700K", href: "/listings?type=condo&maxPrice=700000" },
];

export default function QuickSearchPills() {
  return (
    <section className="bg-white">
      <div className="section-container py-8">
        <p className="text-sm font-medium text-neutral-500 mb-4 text-center">
          Popular searches in Milton
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          {pills.map((pill) => (
            <Link
              key={pill.label}
              href={pill.href}
              className="px-4 py-2 text-sm font-medium text-brand-700 bg-brand-50 hover:bg-brand-100 rounded-full border border-brand-100 transition-colors"
            >
              {pill.label}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";

const pills = [
  { label: "Detached in Willmott", href: "/listings?type=detached&neighbourhood=willmott" },
  { label: "4-Bed Under $1.1M", href: "/listings?beds=4&maxPrice=1100000" },
  { label: "Near Craig Kielburger", href: "/school-zones/craig-kielburger" },
  { label: "Walk to Milton GO", href: "/go-train" },
  { label: "Open Houses This Weekend", href: "/listings?openHouse=true" },
  { label: "New Builds", href: "/listings?type=new-build" },
  { label: "Price Reduced", href: "/listings?priceReduced=true" },
  { label: "Condos Under $700K", href: "/listings?type=condo&maxPrice=700000" },
];

export default function QuickSearchPills() {
  const [active, setActive] = useState<string | null>(null);

  return (
    <section className="bg-neutral-50/50">
      <div className="section-container py-8 sm:py-10">
        <p className="section-label text-neutral-400 text-center mb-5">
          Popular searches in Milton
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          {pills.map((pill) => (
            <Link
              key={pill.label}
              href={pill.href}
              onClick={() => setActive(pill.label)}
              className={`px-5 py-2.5 text-sm font-semibold rounded-full border transition-all duration-200 ${
                active === pill.label
                  ? "bg-brand-500 border-brand-500 text-white shadow-md"
                  : "bg-white border-neutral-200 text-neutral-600 hover:border-brand-300 hover:text-brand-600 hover:shadow-sm"
              }`}
            >
              {pill.label}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

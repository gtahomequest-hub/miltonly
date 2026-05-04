import Link from "next/link";
import { config } from "@/lib/config";

const exploreLeft = [
  { href: "/listings", label: "Buy" },
  { href: "/rentals", label: "Rent" },
  { href: "/sell", label: "Sell" },
  { href: "/exclusive", label: "Exclusive" },
  { href: "/streets", label: "Streets" },
  { href: "/map", label: "Map" },
];

const exploreRight = [
  { href: "/compare", label: "Compare" },
  { href: "/condos", label: "Condos" },
  { href: "/schools", label: "Schools" },
  { href: "/mosques", label: "Mosques" },
  { href: "/about", label: "About" },
  { href: "/saved", label: "Saved" },
];

const legalLinks = [
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
];

const trustBadges = [
  "🏆 RE/MAX Hall of Fame",
  `📅 ${config.realtor.yearsExperience} years in ${config.CITY_NAME}`,
  "⭐ 4.9/5 Google reviews",
];

const WHATSAPP_HREF = `https://wa.me/${config.realtor.phoneE164.replace("+", "")}?text=Hi%20Aamir%2C%20I%20found%20you%20on%20miltonly.com`;

export default function FooterSection() {
  return (
    <footer className="bg-[#07111f] text-white border-t border-slate-800">
      <div className="max-w-7xl mx-auto px-5 sm:px-11 py-12 md:py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-12">
          {/* Column 1 — About Aamir */}
          <div>
            <Link href="/" className="inline-block">
              <span className="text-[18px] font-extrabold">
                <span className="text-[#f8f9fb]">miltonly</span>
                <span className="text-[#f59e0b]">.</span>
              </span>
            </Link>

            <p className="text-sm text-slate-300 leading-relaxed mt-5">
              Aamir Yaqoob is a RE/MAX Hall of Fame realtor with {config.realtor.yearsExperience} years serving {config.CITY_NAME}, {config.CITY_PROVINCE}. He&apos;s helped 400+ {config.CITY_NAME} families buy, sell, and invest — with a focus on first-time buyers, newcomers to Canada, and move-up families. Real data, no fluff.
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              {trustBadges.map((b) => (
                <span
                  key={b}
                  className="text-xs font-semibold text-slate-300 bg-slate-800/50 px-3 py-1.5 rounded-full"
                >
                  {b}
                </span>
              ))}
            </div>
          </div>

          {/* Column 2 — Explore + Legal */}
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-amber-500 mb-4">
              EXPLORE {config.CITY_NAME.toUpperCase()}
            </p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              <ul className="flex flex-col gap-2">
                {exploreLeft.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="text-sm text-slate-300 hover:text-amber-400 transition">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
              <ul className="flex flex-col gap-2">
                {exploreRight.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="text-sm text-slate-300 hover:text-amber-400 transition">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div className="border-t border-slate-800 my-6" />

            <p className="text-xs font-bold uppercase tracking-wider text-amber-500 mb-3">
              LEGAL
            </p>
            <ul className="flex flex-col gap-2">
              {legalLinks.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-sm text-slate-300 hover:text-amber-400 transition">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 3 — Talk to Aamir */}
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-amber-500 mb-4">
              TALK TO AAMIR
            </p>

            <a href={`tel:${config.realtor.phoneE164}`} className="text-2xl font-bold text-amber-400 hover:text-amber-300 transition">
              📞 {config.realtor.phone}
            </a>
            <p className="text-xs text-slate-400 mt-1">Text or call · 9am–9pm ET</p>

            <div className="mt-5">
              <a
                href={WHATSAPP_HREF}
                target="_blank"
                rel="noopener"
                className="text-base font-semibold text-white hover:text-green-400 inline-flex items-center gap-2 transition"
              >
                💬 WhatsApp Aamir →
              </a>
              <p className="text-xs text-slate-400 italic mt-1">
                Preferred by clients in Pakistan, India, and the GCC
              </p>
            </div>

            <p className="text-sm text-slate-300 mt-6">
              {config.brokerage.name}
            </p>
          </div>
        </div>

        {/* Bottom copyright bar */}
        <div className="border-t border-slate-800 mt-12 pt-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <p className="text-xs text-slate-500">
              © 2026 Miltonly.com · {config.realtor.name} · {config.brokerage.name}
            </p>
            <p className="text-xs text-slate-500">
              Not intended to solicit buyers or sellers currently under contract.
            </p>
          </div>
          <p className="text-[10px] text-slate-600 text-center mt-4">
            Information deemed reliable but not guaranteed. Listing data via Toronto Regional Real Estate Board (TRREB).
          </p>
        </div>
      </div>
    </footer>
  );
}

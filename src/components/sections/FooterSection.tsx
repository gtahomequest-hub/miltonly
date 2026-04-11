import Link from "next/link";

const primaryLinks = [
  { href: "/listings", label: "Buy" },
  { href: "/rentals", label: "Rent" },
  { href: "/sell", label: "Sell" },
  { href: "/streets", label: "Streets" },
  { href: "/about", label: "About" },
];

const secondaryLinks = [
  { href: "/compare", label: "Compare" },
  { href: "/condos", label: "Condos" },
  { href: "/map", label: "Map" },
  { href: "/saved", label: "Saved" },
];

export default function FooterSection() {
  return (
    <footer className="bg-[#07111f] px-5 sm:px-11 py-7">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Logo */}
        <Link href="/" className="shrink-0">
          <span className="text-[18px] font-extrabold">
            <span className="text-[#f8f9fb]">miltonly</span>
            <span className="text-[#f59e0b]">.</span>
          </span>
        </Link>

        {/* Links */}
        <nav className="flex flex-wrap justify-center gap-x-[22px] gap-y-2">
          {primaryLinks.map((l) => (
            <Link key={l.href} href={l.href} className="text-[12px] text-[rgba(248,249,251,0.5)] hover:text-[rgba(248,249,251,0.7)] transition-colors">
              {l.label}
            </Link>
          ))}
          <span className="text-[12px] text-[rgba(248,249,251,0.15)]">|</span>
          {secondaryLinks.map((l) => (
            <Link key={l.href} href={l.href} className="text-[12px] text-[rgba(248,249,251,0.35)] hover:text-[rgba(248,249,251,0.6)] transition-colors">
              {l.label}
            </Link>
          ))}
        </nav>

        {/* Copyright */}
        <p className="text-[11px] text-[rgba(248,249,251,0.3)] text-center sm:text-right shrink-0">
          © 2025 Miltonly.com · Aamir Yaqoob · RE/MAX Realty Specialists Inc.
        </p>
      </div>
    </footer>
  );
}

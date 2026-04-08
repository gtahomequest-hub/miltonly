import Link from "next/link";

const footerLinks = [
  { href: "/listings", label: "Buy" },
  { href: "/listings/rent", label: "Rent" },
  { href: "/sell", label: "Sell" },
  { href: "/compare", label: "Compare" },
  { href: "/streets", label: "Streets" },
  { href: "/condos", label: "Condos" },
  { href: "/blog", label: "Blog" },
  { href: "/partners", label: "Partners" },
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
          {footerLinks.map((l) => (
            <Link key={l.href} href={l.href} className="text-[12px] text-[rgba(248,249,251,0.5)] hover:text-[rgba(248,249,251,0.7)] transition-colors">
              {l.label}
            </Link>
          ))}
        </nav>

        {/* Copyright */}
        <p className="text-[11px] text-[rgba(248,249,251,0.3)] text-center sm:text-right shrink-0">
          © 2025 Miltonly.com · Milton Ontario · TREB data disclaimer
        </p>
      </div>
    </footer>
  );
}

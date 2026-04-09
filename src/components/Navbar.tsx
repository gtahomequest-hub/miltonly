"use client";

import { useState } from "react";
import Link from "next/link";

const navLinks = [
  { href: "/listings", label: "Buy" },
  { href: "/rentals", label: "Rent" },
  { href: "/sell", label: "Sell" },
  { href: "/compare", label: "Compare" },
  { href: "/map", label: "Map" },
  { href: "/streets", label: "Streets" },
  { href: "/condos", label: "Condos" },
  { href: "/blog", label: "Blog" },
];

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const calendlyUrl = process.env.NEXT_PUBLIC_CALENDLY_URL ?? "/book";

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-[#f1f5f9]">
      <div className="flex items-center justify-between h-[62px] px-5 sm:px-8 lg:px-11">
        {/* Logo */}
        <Link href="/" className="shrink-0">
          <span className="text-[21px] font-extrabold tracking-[-0.5px]">
            <span className="text-[#07111f]">miltonly</span>
            <span className="text-[#f59e0b]">.</span>
          </span>
        </Link>

        {/* Centre nav */}
        <nav className="hidden lg:flex items-center gap-1">
          {navLinks.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="px-3 py-1.5 text-[13px] font-medium text-[#64748b] hover:text-[#07111f] transition-colors"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        {/* Right */}
        <div className="hidden lg:flex items-center gap-5">
          <Link href="/saved" className="text-[13px] text-[#64748b] hover:text-[#07111f] transition-colors">Saved</Link>
          <Link href="/signin" className="text-[13px] text-[#64748b] hover:text-[#07111f] transition-colors">Sign in</Link>
          <Link
            href={calendlyUrl}
            className="bg-[#07111f] text-[#f59e0b] text-[13px] font-bold px-[18px] py-[9px] rounded-lg hover:bg-[#0c1e35] transition-colors"
          >
            Book a call
          </Link>
        </div>

        {/* Mobile hamburger */}
        <button onClick={() => setMobileOpen(!mobileOpen)} className="lg:hidden p-2 -mr-2" aria-label="Menu">
          <div className="space-y-1.5">
            <span className={`block w-5 h-0.5 bg-[#07111f] transition-all ${mobileOpen ? "rotate-45 translate-y-[7px]" : ""}`} />
            <span className={`block w-5 h-0.5 bg-[#07111f] transition-all ${mobileOpen ? "opacity-0" : ""}`} />
            <span className={`block w-5 h-0.5 bg-[#07111f] transition-all ${mobileOpen ? "-rotate-45 -translate-y-[7px]" : ""}`} />
          </div>
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="lg:hidden border-t border-[#f1f5f9] bg-white px-5 py-4 space-y-1">
          {navLinks.map((l) => (
            <Link key={l.href} href={l.href} onClick={() => setMobileOpen(false)} className="block py-2.5 text-[15px] font-medium text-[#475569] hover:text-[#07111f]">
              {l.label}
            </Link>
          ))}
          <div className="pt-3 mt-2 border-t border-[#f1f5f9] space-y-2">
            <Link href="/saved" className="block py-2 text-[13px] text-[#64748b]">Saved</Link>
            <Link href="/signin" className="block py-2 text-[13px] text-[#64748b]">Sign in</Link>
            <Link href={calendlyUrl} className="block text-center bg-[#07111f] text-[#f59e0b] font-bold py-3 rounded-lg mt-2">Book a call</Link>
          </div>
        </div>
      )}
    </header>
  );
}

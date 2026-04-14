"use client";

import { useState } from "react";
import Link from "next/link";
import { useUser } from "@/components/UserProvider";

const primaryLinks = [
  { href: "/listings", label: "Buy" },
  { href: "/rentals", label: "Rent" },
  { href: "/sell", label: "Sell" },
  { href: "/exclusive", label: "Exclusive" },
  { href: "/streets", label: "Streets" },
  { href: "/about", label: "About" },
];

const secondaryLinks = [
  { href: "/compare", label: "Compare" },
  { href: "/condos", label: "Condos" },
  { href: "/schools", label: "Schools" },
  { href: "/mosques", label: "Mosques" },
  { href: "/map", label: "Map" },
  { href: "/saved", label: "Saved" },
];

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, loading } = useUser();

  return (
    <header className="sticky top-0 z-50 bg-[#07111f] border-b border-[#1e3a5f]">
      <div className="flex items-center justify-between h-[62px] px-5 sm:px-8 lg:px-11">
        {/* Logo */}
        <Link href="/" className="shrink-0">
          <span className="text-[21px] font-extrabold tracking-[-0.5px]">
            <span className="text-[#f8f9fb]">miltonly</span>
            <span className="text-[#f59e0b]">.</span>
          </span>
        </Link>

        {/* Centre nav — 6 primary links */}
        <nav className="hidden lg:flex items-center gap-0">
          {primaryLinks.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="px-2 py-1.5 text-[13px] font-medium text-[#94a3b8] hover:text-[#f8f9fb] transition-colors"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        {/* Right side */}
        <div className="hidden lg:flex items-center gap-3">
          {!loading && user ? (
            <>
              <Link
                href="/saved"
                className="text-[13px] font-medium text-[#94a3b8] hover:text-[#f8f9fb] transition-colors"
              >
                ♡ Saved
              </Link>
              <Link
                href="/saved"
                className="bg-[#0c1e35] border border-[#1e3a5f] text-[#f8f9fb] text-[13px] font-bold px-[14px] py-[8px] rounded-lg hover:bg-[#1e3a5f] transition-colors"
              >
                {user.firstName || user.email.split("@")[0]}
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/signin"
                className="text-[13px] font-medium text-[#94a3b8] hover:text-[#f8f9fb] transition-colors"
              >
                Sign in
              </Link>
              <a
                href="tel:+16478399090"
                className="bg-[#f59e0b] text-[#07111f] text-[13px] font-bold px-[18px] py-[9px] rounded-lg hover:bg-[#fbbf24] transition-colors"
              >
                Call Aamir
              </a>
            </>
          )}
        </div>

        {/* Mobile hamburger */}
        <button onClick={() => setMobileOpen(!mobileOpen)} className="lg:hidden p-2 -mr-2" aria-label="Menu">
          <div className="space-y-1.5">
            <span className={`block w-5 h-0.5 bg-[#f8f9fb] transition-all ${mobileOpen ? "rotate-45 translate-y-[7px]" : ""}`} />
            <span className={`block w-5 h-0.5 bg-[#f8f9fb] transition-all ${mobileOpen ? "opacity-0" : ""}`} />
            <span className={`block w-5 h-0.5 bg-[#f8f9fb] transition-all ${mobileOpen ? "-rotate-45 -translate-y-[7px]" : ""}`} />
          </div>
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="lg:hidden border-t border-[#1e3a5f] bg-[#0c1e35] px-5 py-4 space-y-1">
          {primaryLinks.map((l) => (
            <Link key={l.href} href={l.href} onClick={() => setMobileOpen(false)} className="block py-2.5 text-[15px] font-medium text-[#94a3b8] hover:text-[#f8f9fb]">
              {l.label}
            </Link>
          ))}
          <div className="pt-2 mt-1 border-t border-[#1e3a5f]">
            {secondaryLinks.map((l) => (
              <Link key={l.href} href={l.href} onClick={() => setMobileOpen(false)} className="block py-2 text-[13px] text-[#64748b] hover:text-[#f8f9fb]">
                {l.label}
              </Link>
            ))}
          </div>
          <div className="pt-3 mt-2 border-t border-[#1e3a5f]">
            {!loading && user ? (
              <Link href="/saved" onClick={() => setMobileOpen(false)} className="block text-center bg-[#f59e0b] text-[#07111f] font-bold py-3 rounded-lg">
                ♡ My saved ({user.savedListings?.length || 0})
              </Link>
            ) : (
              <Link href="/signin" onClick={() => setMobileOpen(false)} className="block text-center bg-[#f59e0b] text-[#07111f] font-bold py-3 rounded-lg">
                Sign in
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}

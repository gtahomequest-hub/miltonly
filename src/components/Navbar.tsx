"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

const navLinks = [
  { href: "/listings", label: "Buy" },
  { href: "/listings/rent", label: "Rent" },
  { href: "/sell", label: "Sell" },
  { href: "/compare", label: "Compare" },
  { href: "/map", label: "Map" },
  { href: "/streets", label: "Streets" },
  { href: "/condos", label: "Condos" },
  { href: "/blog", label: "Blog" },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
          : "bg-transparent"
      }`}
    >
      <div className="section-container">
        <div className="flex items-center justify-between h-16 lg:h-[72px]">
          <Link href="/" className="shrink-0">
            <span
              className={`text-[22px] font-extrabold tracking-tight transition-colors ${
                scrolled ? "text-navy" : "text-white"
              }`}
            >
              miltonly
            </span>
          </Link>

          {scrolled && (
            <div className="hidden lg:flex items-center flex-1 max-w-sm mx-8">
              <div className="relative w-full">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                <input
                  type="text"
                  placeholder="Search address, street, MLS#..."
                  className="w-full pl-9 pr-4 py-2 text-sm bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent focus:bg-white"
                />
              </div>
            </div>
          )}

          <nav className="hidden lg:flex items-center gap-0.5">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3 py-2 text-[13px] font-medium rounded-md transition-colors ${
                  scrolled
                    ? "text-neutral-600 hover:text-navy hover:bg-neutral-50"
                    : "text-white/85 hover:text-white hover:bg-white/10"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="hidden lg:flex items-center gap-4 ml-4">
            <Link
              href="/saved"
              className={`text-[13px] font-medium transition-colors ${
                scrolled ? "text-neutral-500 hover:text-navy" : "text-white/70 hover:text-white"
              }`}
            >
              Saved
            </Link>
            <Link
              href="/signin"
              className={`text-[13px] font-medium transition-colors ${
                scrolled ? "text-neutral-500 hover:text-navy" : "text-white/70 hover:text-white"
              }`}
            >
              Sign In
            </Link>
            <Link
              href="/book"
              className="bg-brand-500 hover:bg-brand-600 text-white text-[13px] font-semibold px-4 py-2 rounded-lg transition-colors"
            >
              Book a Call
            </Link>
          </div>

          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="lg:hidden p-2 -mr-2"
            aria-label="Toggle menu"
          >
            <div className="space-y-1.5">
              <span className={`block w-5 h-0.5 transition-all duration-200 ${mobileOpen ? "rotate-45 translate-y-[7px] bg-neutral-800" : scrolled ? "bg-neutral-800" : "bg-white"}`} />
              <span className={`block w-5 h-0.5 transition-all duration-200 ${mobileOpen ? "opacity-0" : scrolled ? "bg-neutral-800" : "bg-white"}`} />
              <span className={`block w-5 h-0.5 transition-all duration-200 ${mobileOpen ? "-rotate-45 -translate-y-[7px] bg-neutral-800" : scrolled ? "bg-neutral-800" : "bg-white"}`} />
            </div>
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="lg:hidden bg-white border-t border-neutral-100 shadow-lg animate-[fadeIn_0.15s_ease]">
          <div className="section-container py-4 space-y-1">
            <div className="pb-3 mb-2 border-b border-neutral-100">
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                <input
                  type="text"
                  placeholder="Search address, street, MLS#..."
                  className="w-full pl-9 pr-4 py-2.5 text-sm bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
            </div>
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="block px-3 py-2.5 text-[15px] font-medium text-neutral-700 hover:bg-neutral-50 rounded-lg"
              >
                {link.label}
              </Link>
            ))}
            <div className="pt-3 mt-2 border-t border-neutral-100 space-y-2">
              <Link href="/saved" className="block px-3 py-2 text-sm text-neutral-500">Saved Homes</Link>
              <Link href="/signin" className="block px-3 py-2 text-sm text-neutral-500">Sign In</Link>
              <Link href="/book" className="block text-center btn-primary w-full mt-2">Book a Call</Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

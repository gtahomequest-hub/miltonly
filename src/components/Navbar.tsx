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
    const onScroll = () => setScrolled(window.scrollY > 80);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-white/95 backdrop-blur-md shadow-sm"
          : "bg-transparent"
      }`}
    >
      <div className="section-container">
        <div className="flex items-center justify-between h-16 lg:h-20">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <span
              className={`text-2xl font-bold tracking-tight transition-colors ${
                scrolled ? "text-brand-600" : "text-white"
              }`}
            >
              Miltonly
            </span>
          </Link>

          {/* Compact search bar — appears on scroll */}
          {scrolled && (
            <div className="hidden lg:flex items-center flex-1 max-w-md mx-8">
              <input
                type="text"
                placeholder="Address, street, neighbourhood, MLS#..."
                className="w-full px-4 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              />
            </div>
          )}

          {/* Desktop nav links */}
          <nav className="hidden lg:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                  scrolled
                    ? "text-neutral-700 hover:text-brand-600 hover:bg-neutral-50"
                    : "text-white/90 hover:text-white hover:bg-white/10"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Right side: saved, sign in, CTA */}
          <div className="hidden lg:flex items-center gap-3 ml-4">
            <Link
              href="/saved"
              className={`text-sm font-medium transition-colors ${
                scrolled
                  ? "text-neutral-600 hover:text-brand-600"
                  : "text-white/80 hover:text-white"
              }`}
            >
              Saved
            </Link>
            <Link
              href="/signin"
              className={`text-sm font-medium transition-colors ${
                scrolled
                  ? "text-neutral-600 hover:text-brand-600"
                  : "text-white/80 hover:text-white"
              }`}
            >
              Sign In
            </Link>
            <Link
              href="/book"
              className="btn-primary !py-2 !px-4 text-sm"
            >
              Book a Call
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="lg:hidden p-2"
            aria-label="Toggle menu"
          >
            <div className="space-y-1.5">
              <span
                className={`block w-6 h-0.5 transition-all ${
                  mobileOpen
                    ? "rotate-45 translate-y-2 bg-neutral-800"
                    : scrolled
                    ? "bg-neutral-800"
                    : "bg-white"
                }`}
              />
              <span
                className={`block w-6 h-0.5 transition-all ${
                  mobileOpen
                    ? "opacity-0"
                    : scrolled
                    ? "bg-neutral-800"
                    : "bg-white"
                }`}
              />
              <span
                className={`block w-6 h-0.5 transition-all ${
                  mobileOpen
                    ? "-rotate-45 -translate-y-2 bg-neutral-800"
                    : scrolled
                    ? "bg-neutral-800"
                    : "bg-white"
                }`}
              />
            </div>
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="lg:hidden bg-white border-t border-neutral-100 shadow-lg">
          <div className="section-container py-4 space-y-1">
            {/* Mobile search */}
            <div className="pb-3 mb-3 border-b border-neutral-100">
              <input
                type="text"
                placeholder="Search address, street, MLS#..."
                className="w-full px-4 py-2.5 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="block px-3 py-2.5 text-base font-medium text-neutral-700 hover:bg-neutral-50 rounded-md"
              >
                {link.label}
              </Link>
            ))}
            <div className="pt-3 mt-3 border-t border-neutral-100 space-y-2">
              <Link
                href="/saved"
                className="block px-3 py-2 text-sm text-neutral-600"
              >
                Saved Homes
              </Link>
              <Link
                href="/signin"
                className="block px-3 py-2 text-sm text-neutral-600"
              >
                Sign In
              </Link>
              <Link
                href="/book"
                className="block text-center btn-primary w-full mt-2"
              >
                Book a Call
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

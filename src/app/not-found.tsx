import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Page not found — Miltonly",
  description: "The page you're looking for doesn't exist on Miltonly.",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <main className="min-h-screen bg-white flex items-center justify-center px-5 py-20">
      <div className="max-w-md w-full text-center">
        <p className="text-[12px] font-bold text-[#f59e0b] uppercase tracking-[0.14em] mb-3">404 · Not found</p>
        <h1 className="text-[28px] font-extrabold text-[#07111f] tracking-[-0.3px] mb-3">
          We couldn&apos;t find that page
        </h1>
        <p className="text-[14px] text-[#64748b] leading-relaxed mb-8">
          The street, listing, or page you&apos;re looking for may have been removed, or the link might be out of date.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/"
            className="bg-[#07111f] text-[#f59e0b] text-[13px] font-bold px-5 py-3 rounded-lg hover:bg-[#0c1e35] transition-colors"
          >
            Go to homepage
          </Link>
          <Link
            href="/listings"
            className="border border-[#e2e8f0] text-[#475569] text-[13px] font-bold px-5 py-3 rounded-lg hover:border-[#07111f] transition-colors"
          >
            Browse Milton listings
          </Link>
        </div>
      </div>
    </main>
  );
}

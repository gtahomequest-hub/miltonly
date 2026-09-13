import Link from "next/link";
import type { Metadata } from "next";
import { config } from "@/lib/config";
import SiteChrome from "@/components/nav/SiteChrome";

export const metadata: Metadata = {
  title: `Page not found | ${config.SITE_NAME}`,
  description: `The page you're looking for doesn't exist on ${config.SITE_NAME}.`,
  robots: { index: false, follow: false },
};

export default function NotFound() {
  // The forest bar and the map footer around the one page a lost visitor lands on (MH-006).
  return (
    <SiteChrome>
    <main className="min-h-[60vh] bg-[#fffdfa] flex items-center justify-center px-5 py-20">
      <div className="max-w-md w-full text-center">
        <p className="text-[12px] font-bold text-[#017848] uppercase tracking-[0.14em] mb-3">404 · Not found</p>
        <h1 className="text-[28px] font-extrabold text-[#073126] tracking-[-0.3px] mb-3">
          We couldn&apos;t find that page
        </h1>
        <p className="text-[14px] text-[#6b6f6a] leading-relaxed mb-8">
          The street, listing, or page you&apos;re looking for may have been removed, or the link might be out of date.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/"
            className="bg-[#017848] text-white text-[13px] font-bold px-5 py-3 rounded-lg hover:bg-[#0a8f57] transition-colors"
          >
            Go to homepage
          </Link>
          <Link
            href="/listings"
            className="border border-[#dfe0dc] text-[#4f534f] text-[13px] font-bold px-5 py-3 rounded-lg hover:border-[#073126] transition-colors"
          >
            Browse {config.CITY_NAME} listings
          </Link>
        </div>
      </div>
    </main>
    </SiteChrome>
  );
}

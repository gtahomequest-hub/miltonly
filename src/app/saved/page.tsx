import { generateMetadata as genMeta } from "@/lib/seo";
import Link from "next/link";

export const metadata = genMeta({
  title: "Saved Listings — Miltonly",
  description: "Sign in to view your saved Milton real estate listings and get alerts.",
  canonical: "https://miltonly.com/saved",
});

export default function SavedPage() {
  return (
    <div className="min-h-screen bg-[#f8f9fb] flex items-center justify-center px-5">
      <div className="text-center max-w-[400px]">
        <div className="text-[48px] mb-4">♡</div>
        <h1 className="text-[24px] font-extrabold text-[#07111f] mb-3 tracking-[-0.02em]">Saved Listings</h1>
        <p className="text-[14px] text-[#64748b] mb-8 leading-relaxed">
          Sign in to view your saved listings and get alerts when new properties match your preferences.
        </p>
        <Link
          href="/signin"
          className="inline-block bg-[#07111f] text-[#f59e0b] text-[14px] font-bold px-8 py-3.5 rounded-xl hover:bg-[#0c1e35] transition-colors"
        >
          Sign in to view saved
        </Link>
      </div>
    </div>
  );
}

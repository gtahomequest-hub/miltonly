import Link from "next/link";
import { generateMetadata as genMeta } from "@/lib/seo";
import CompareWaitlistForm from "./CompareWaitlistForm";

export const metadata = genMeta({
  title: "Compare Milton Streets — Coming Soon",
  description: "Side-by-side price data, school zones, GO access and market trends for any two Milton streets. Launching soon on Miltonly.",
  canonical: "https://miltonly.com/compare",
});

export default function ComparePage() {
  return (
    <div className="min-h-screen bg-[#07111f] flex items-center justify-center px-5">
      <div className="max-w-lg w-full text-center py-20">
        <span className="inline-block text-[10px] font-bold text-[#f59e0b] uppercase tracking-[0.14em] bg-[rgba(245,158,11,0.1)] px-3 py-1 rounded-full mb-4">
          Coming soon
        </span>

        <h1 className="text-[28px] sm:text-[36px] font-extrabold text-white tracking-[-0.5px] mb-3">
          Compare any two Milton streets
        </h1>

        <p className="text-[15px] text-[#94a3b8] leading-relaxed mb-8">
          Side-by-side price data, school zones, GO access and market trends — launching soon.
        </p>

        <CompareWaitlistForm />

        <div className="mt-8 pt-6 border-t border-[#1e3a5f]">
          <p className="text-[13px] text-[#64748b] mb-3">In the meantime, explore Milton streets individually</p>
          <Link
            href="/streets"
            className="inline-block bg-white text-[#07111f] text-[13px] font-bold px-6 py-2.5 rounded-lg hover:bg-[#f1f5f9] transition-colors"
          >
            Browse all streets
          </Link>
        </div>
      </div>
    </div>
  );
}

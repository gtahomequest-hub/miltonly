import { generateMetadata as genMeta } from "@/lib/seo";

export const metadata = genMeta({
  title: "Milton Real Estate Insights — Coming Soon",
  description: "Market updates, neighbourhood guides and buying tips for Milton Ontario real estate — coming soon.",
  canonical: "https://miltonly.com/blog",
});

export const dynamic = "force-dynamic";

export default function BlogPage() {
  return (
    <div className="min-h-screen bg-[#f8f9fb] flex items-center justify-center px-5">
      <div className="text-center max-w-[440px]">
        <div className="text-[48px] mb-4">📝</div>
        <h1 className="text-[24px] font-extrabold text-[#07111f] mb-2 tracking-[-0.02em]">Milton Real Estate Insights</h1>
        <p className="text-[14px] text-[#64748b] mb-8 leading-relaxed">
          Market updates, neighbourhood guides and buying tips — coming soon.
        </p>
        <div className="flex gap-2 max-w-sm mx-auto">
          <input type="email" placeholder="your@email.com" className="flex-1 px-4 py-3 text-[13px] border border-[#e2e8f0] rounded-xl outline-none focus:border-[#f59e0b] transition-colors" />
          <button className="bg-[#07111f] text-[#f59e0b] text-[13px] font-bold px-5 py-3 rounded-xl hover:bg-[#0c1e35] transition-colors shrink-0">
            Notify me
          </button>
        </div>
        <p className="text-[11px] text-[#94a3b8] mt-3">Get notified when we launch</p>
      </div>
    </div>
  );
}

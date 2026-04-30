import { generateMetadata as genMeta } from "@/lib/seo";
import { config } from "@/lib/config";
import AgentContactSection from "@/components/AgentContactSection";

export const metadata = genMeta({
  title: `About ${config.realtor.name} — ${config.CITY_NAME} Real Estate Agent`,
  description: `${config.realtor.name} has served ${config.CITY_NAME} families for ${config.realtor.yearsExperience} years as a full-time real estate professional. RE/MAX Hall of Fame Award recipient. Buy, sell, or rent in ${config.CITY_NAME}.`,
  canonical: `${config.SITE_URL}/about`,
});

export default function AboutPage() {
  return (
    <div className="bg-[#f8f9fb]">
      {/* Hero */}
      <section className="bg-[#07111f] text-center px-5 sm:px-11 py-20">
        <h1 className="text-[clamp(30px,5vw,48px)] font-extrabold text-[#f8f9fb] leading-[1.1] tracking-[-0.03em] mb-2">
          {config.realtor.name}
        </h1>
        <p className="text-[15px] font-bold text-[#f59e0b] mb-6">
          {config.realtor.title} · {config.brokerage.name}
        </p>
        <p className="text-[15px] text-[#94a3b8] max-w-[560px] mx-auto leading-relaxed">
          {config.realtor.name} has served {config.CITY_NAME} families for {config.realtor.yearsExperience} years as a full-time real estate professional. From first rentals to investment properties, buyers to sellers, {config.realtor.name.split(" ")[0]} provides complete representation at every stage.
        </p>
      </section>

      {/* Awards */}
      <section className="max-w-[600px] mx-auto px-5 pt-14 pb-0 text-center">
        <h2 className="text-[20px] font-extrabold text-[#07111f] mb-8 tracking-[-0.02em]">Awards &amp; Recognition</h2>
        <div className="space-y-3">
          <div className="bg-white rounded-xl border border-[#fde68a] p-4 flex items-center gap-3">
            <span className="text-[24px]">🏆</span>
            <div className="text-left">
              <p className="text-[14px] font-bold text-[#07111f]">RE/MAX Hall of Fame Award</p>
              <p className="text-[11px] text-[#64748b]">Highest career achievement recognition</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-[#fde68a] p-4 flex items-center gap-3">
            <span className="text-[24px]">🏆</span>
            <div className="text-left">
              <p className="text-[14px] font-bold text-[#07111f]">RE/MAX Executive Award</p>
              <p className="text-[11px] text-[#64748b]">Outstanding sales performance</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-[#fde68a] p-4 flex items-center gap-3">
            <span className="text-[24px]">🏆</span>
            <div className="text-left">
              <p className="text-[14px] font-bold text-[#07111f]">RE/MAX 100% Club Award</p>
              <p className="text-[11px] text-[#64748b]">Consistent top-tier production</p>
            </div>
          </div>
        </div>
      </section>

      <AgentContactSection />
    </div>
  );
}

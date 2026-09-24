import { generateMetadata as genMeta } from "@/lib/seo";
import { config } from "@/lib/config";
import AgentContactSection from "@/components/AgentContactSection";
import SiteChrome from "@/components/nav/SiteChrome";

export const metadata = genMeta({
  title: `About ${config.realtor.name} — ${config.CITY_NAME} Real Estate Agent`,
  description: `${config.realtor.name} has helped 235+ families over ${config.realtor.yearsExperience} years as a full-time real estate professional. RE/MAX Hall of Fame Award recipient. Buy, sell, or rent in ${config.CITY_NAME}.`,
  canonical: `${config.SITE_URL}/about`,
});

export default function AboutPage() {
  return (
    <SiteChrome>
    <div className="bg-[#fffdfa]">
      {/* Hero */}
      <section className="bg-[#073126] text-center px-5 sm:px-11 py-20">
        <h1 className="text-[clamp(30px,5vw,48px)] font-extrabold text-[#fffdfa] leading-[1.1] tracking-[-0.03em] mb-2">
          {config.realtor.name}
        </h1>
        <p className="text-[15px] font-bold text-[#00ff80] mb-6">
          {config.realtor.title} · {config.brokerage.name}
        </p>
        <p className="text-[15px] text-white/75 max-w-[560px] mx-auto leading-relaxed">
          {config.realtor.name} has helped 235+ families over {config.realtor.yearsExperience} years as a full-time real estate professional. From first rentals to investment properties, buyers to sellers, {config.realtor.name.split(" ")[0]} provides complete representation at every stage.
        </p>
      </section>

      {/* Awards */}
      <section className="max-w-[600px] mx-auto px-5 pt-14 pb-0 text-center">
        <h2 className="text-[20px] font-extrabold text-[#073126] mb-8 tracking-[-0.02em]">Awards &amp; Recognition</h2>
        {/* Two facts, stated plainly (MC-043): the award by its name, the tenure by its year. No
            ranking words, and the year stays a year, never a duration. Grid items stretch, so the
            pair sits level side by side from 640px and stacks below it. */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="bg-white rounded-xl border border-[#dfe0dc] p-4 flex items-center justify-center gap-3">
            <span className="text-[24px]">🏆</span>
            <p className="text-[14px] font-bold text-[#073126]">RE/MAX Hall of Fame</p>
          </div>
          <div className="bg-white rounded-xl border border-[#dfe0dc] p-4 flex items-center justify-center">
            <p className="text-[14px] font-bold text-[#073126]">Serving {config.CITY_NAME} Since 2011</p>
          </div>
        </div>
      </section>

      <AgentContactSection />
    </div>
    </SiteChrome>
  );
}

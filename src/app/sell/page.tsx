import { generateMetadata as genMeta } from "@/lib/seo";
import { config } from "@/lib/config";
import AgentContactSection from "@/components/AgentContactSection";

export const metadata = genMeta({
  title: `What Is Your ${config.CITY_NAME} Home Worth? — Free Valuation`,
  description: `Get a free, no-obligation home valuation from ${config.realtor.name}. ${config.realtor.yearsExperience} years of ${config.CITY_NAME} real estate experience. RE/MAX Hall of Fame Award recipient.`,
  canonical: `${config.SITE_URL}/sell`,
});

export default function SellPage() {
  return (
    <div className="min-h-screen bg-[#f8f9fb]">
      {/* Hero */}
      <section className="bg-[#07111f] text-center px-5 sm:px-11 py-20">
        <h1 className="text-[clamp(28px,5vw,46px)] font-extrabold text-[#f8f9fb] leading-[1.1] tracking-[-0.03em] mb-4">
          What Is Your {config.CITY_NAME}<br />Home <em className="text-[#f59e0b] not-italic">Worth?</em>
        </h1>
        <p className="text-[15px] text-[#94a3b8] max-w-[520px] mx-auto mb-4">
          Get a free valuation from {config.realtor.name} · {config.brokerage.name.replace(", Brokerage", "")}
        </p>
        <p className="text-[13px] text-[#64748b] max-w-[520px] mx-auto mb-8 leading-relaxed">
          {config.CITY_NAME}&apos;s market moves quickly. With {config.realtor.yearsExperience} years of full-time experience and RE/MAX Hall of Fame recognition, {config.realtor.name.split(" ")[0]} provides accurate, honest valuations — no obligation, no pressure.
        </p>
        <a
          href={`tel:${config.realtor.phoneE164}`}
          className="inline-block bg-[#f59e0b] text-[#07111f] text-[16px] font-extrabold px-10 py-4 rounded-xl hover:bg-[#fbbf24] transition-all hover:-translate-y-0.5"
        >
          📞 Call {config.realtor.name.split(" ")[0]} for a Free Valuation
        </a>
      </section>

      {/* Trust points */}
      <section className="max-w-[700px] mx-auto px-5 py-16">
        <div className="grid sm:grid-cols-3 gap-6">
          <div className="bg-white rounded-xl border border-[#e2e8f0] p-6 text-center">
            <div className="text-[28px] mb-3">✅</div>
            <h3 className="text-[14px] font-bold text-[#07111f] mb-2">Free Home Valuation</h3>
            <p className="text-[12px] text-[#64748b] leading-relaxed">No commitment required. Get an honest assessment of your home&apos;s market value.</p>
          </div>
          <div className="bg-white rounded-xl border border-[#e2e8f0] p-6 text-center">
            <div className="text-[28px] mb-3">📊</div>
            <h3 className="text-[14px] font-bold text-[#07111f] mb-2">{config.realtor.yearsExperience} Years {config.CITY_NAME} Experience</h3>
            <p className="text-[12px] text-[#64748b] leading-relaxed">Deep knowledge of every neighbourhood, street, and pricing trend in {config.CITY_NAME}.</p>
          </div>
          <div className="bg-white rounded-xl border border-[#e2e8f0] p-6 text-center">
            <div className="text-[28px] mb-3">🏆</div>
            <h3 className="text-[14px] font-bold text-[#07111f] mb-2">RE/MAX Hall of Fame</h3>
            <p className="text-[12px] text-[#64748b] leading-relaxed">Award-winning performance recognized by one of the world&apos;s largest real estate brands.</p>
          </div>
        </div>
      </section>

      <AgentContactSection headline={`Ready to sell your ${config.CITY_NAME} home?`} />
    </div>
  );
}

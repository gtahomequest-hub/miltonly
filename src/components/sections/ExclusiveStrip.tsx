import OffMarketForm from "./OffMarketForm";

export default function ExclusiveStrip() {
  return (
    <section className="bg-[#07111f] border-t border-[#1e3a5f] px-5 sm:px-11 py-10">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-5 gap-8">
        {/* Left side — copy + proof + CTAs */}
        <div className="lg:col-span-2 flex flex-col justify-center">
          <p className="text-[11px] font-bold text-[#f59e0b] tracking-[0.18em] mb-2">
            🔒 OFF-MARKET · INVITE-ONLY
          </p>
          <h2 className="text-[28px] sm:text-[32px] font-extrabold text-[#f8f9fb] tracking-[-0.02em] leading-[1.1] mb-3">
            Milton homes you won&apos;t find on MLS
          </h2>
          <p className="text-[14px] text-[#94a3b8] leading-relaxed mb-5 max-w-lg">
            Aamir gets first call on Milton homes before they hit MLS — sellers who want a private sale, sellers testing the market, and his repeat clients listing again. Get on the list and we&apos;ll text you when one matches your search.
          </p>

          {/* Proof strip */}
          <div className="grid grid-cols-3 gap-4 max-w-md mb-6">
            <div>
              <p className="text-[18px] font-extrabold text-[#f59e0b]">🏠 12</p>
              <p className="text-[11px] text-[#94a3b8] leading-tight mt-1">Off-market deals closed in 2024</p>
            </div>
            <div>
              <p className="text-[18px] font-extrabold text-[#f59e0b]">⏱️ 3d</p>
              <p className="text-[11px] text-[#94a3b8] leading-tight mt-1">Avg list-to-offer on private sales</p>
            </div>
            <div>
              <p className="text-[18px] font-extrabold text-[#f59e0b]">🤫 0</p>
              <p className="text-[11px] text-[#94a3b8] leading-tight mt-1">Public MLS exposure required</p>
            </div>
          </div>

          {/* Stacked CTAs */}
          <div className="flex flex-col sm:flex-row gap-3 items-start">
            <a
              href="#off-market-form"
              className="inline-block bg-[#f59e0b] text-[#07111f] text-[13px] font-extrabold rounded-xl px-5 py-3 hover:bg-[#fbbf24] transition-colors"
            >
              🔔 Get on the off-market list
            </a>
            <a
              href="tel:+16478399090"
              className="inline-block text-[13px] font-bold text-[#94a3b8] hover:text-[#f59e0b] py-3 transition-colors"
            >
              Or call Aamir: (647) 839-9090
            </a>
          </div>
        </div>

        {/* Right side — lead-capture form */}
        <div className="lg:col-span-3">
          <OffMarketForm />
        </div>
      </div>
    </section>
  );
}

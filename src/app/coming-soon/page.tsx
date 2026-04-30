import type { Metadata } from "next";
import { config } from "@/lib/config";

export const metadata: Metadata = {
  title: `${config.SITE_NAME} — Launching Soon`,
  description: `${config.CITY_NAME}'s dedicated real estate intelligence site is launching soon. Street-level data, neighbourhood insights, and ${config.CITY_NAME} MLS listings — coming soon.`,
  robots: { index: false, follow: false },
  alternates: { canonical: config.SITE_URL },
};

export default function ComingSoonPage() {
  return (
    <main className="min-h-screen bg-[#0A1628] text-white flex flex-col items-center justify-center px-6 py-20">
      <div className="max-w-xl w-full text-center">
        {/* Logo / Wordmark */}
        <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.25em] text-[#94a3b8] mb-6">
          <span className="h-[1px] w-8 bg-[#2563EB]" />
          {config.CITY_NAME}, {config.CITY_PROVINCE}
          <span className="h-[1px] w-8 bg-[#2563EB]" />
        </div>

        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight mb-6">
          {config.SITE_NAME} is <span className="text-[#60a5fa]">launching soon</span>
        </h1>

        <p className="text-[15px] sm:text-base text-[#94a3b8] leading-relaxed mb-10">
          The most detailed real estate resource ever built for {config.CITY_NAME} is almost ready.
          Street-level data, neighbourhood insights, school zones, and live MLS listings —
          all in one place.
        </p>

        {/* Contact the agent directly */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 sm:p-8 mb-8 backdrop-blur-sm">
          <p className="text-[11px] uppercase tracking-[0.2em] text-[#94a3b8] mb-3">
            Buying or selling in {config.CITY_NAME} right now?
          </p>
          <p className="text-lg font-semibold mb-1">{config.realtor.name}</p>
          <p className="text-[13px] text-[#94a3b8] mb-5">
            {config.realtor.title} · {config.brokerage.name}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href={`tel:${config.realtor.phoneE164}`}
              className="bg-[#2563EB] hover:bg-[#1d4ed8] text-white font-semibold px-6 py-3 rounded-lg transition-colors text-sm"
            >
              Call {config.realtor.phone}
            </a>
            <a
              href={`mailto:${config.realtor.email}`}
              className="bg-white/10 hover:bg-white/20 border border-white/20 text-white font-semibold px-6 py-3 rounded-lg transition-colors text-sm"
            >
              Email {config.realtor.name.split(" ")[0]}
            </a>
          </div>
        </div>

      </div>
    </main>
  );
}

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Miltonly — Launching Soon",
  description:
    "Milton's dedicated real estate intelligence site is launching soon. Street-level data, neighbourhood insights, and Milton MLS listings — coming soon.",
  robots: { index: false, follow: false },
  alternates: { canonical: "https://miltonly.com" },
};

export default function ComingSoonPage() {
  return (
    <main className="min-h-screen bg-[#0A1628] text-white flex flex-col items-center justify-center px-6 py-20">
      <div className="max-w-xl w-full text-center">
        {/* Logo / Wordmark */}
        <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.25em] text-[#94a3b8] mb-6">
          <span className="h-[1px] w-8 bg-[#2563EB]" />
          Milton, Ontario
          <span className="h-[1px] w-8 bg-[#2563EB]" />
        </div>

        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight mb-6">
          Miltonly is <span className="text-[#60a5fa]">launching soon</span>
        </h1>

        <p className="text-[15px] sm:text-base text-[#94a3b8] leading-relaxed mb-10">
          The most detailed real estate resource ever built for Milton is almost ready.
          Street-level data, neighbourhood insights, school zones, and live MLS listings —
          all in one place.
        </p>

        {/* Contact the agent directly */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 sm:p-8 mb-8 backdrop-blur-sm">
          <p className="text-[11px] uppercase tracking-[0.2em] text-[#94a3b8] mb-3">
            Buying or selling in Milton right now?
          </p>
          <p className="text-lg font-semibold mb-1">Aamir Yaqoob</p>
          <p className="text-[13px] text-[#94a3b8] mb-5">
            Sales Representative · RE/MAX Realty Specialists Inc.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href="tel:+16478399090"
              className="bg-[#2563EB] hover:bg-[#1d4ed8] text-white font-semibold px-6 py-3 rounded-lg transition-colors text-sm"
            >
              Call (647) 839-9090
            </a>
            <a
              href="mailto:aamir@miltonly.com"
              className="bg-white/10 hover:bg-white/20 border border-white/20 text-white font-semibold px-6 py-3 rounded-lg transition-colors text-sm"
            >
              Email Aamir
            </a>
          </div>
        </div>

      </div>
    </main>
  );
}

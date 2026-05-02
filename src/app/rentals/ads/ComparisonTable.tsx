// Comparison table — realtor vs DIY vs Out-of-area.
// Desktop: 4-col grid. Mobile (<768px): rows stack as cards.

import { config } from "@/lib/config";

const REALTOR_FIRST_NAME = config.realtor.name.split(" ")[0];

const ROWS: Array<{
  label: string;
  aamir: { mark: "yes" | "no" | "partial"; text: string };
  diy: { mark: "yes" | "no" | "partial"; text: string };
  out: { mark: "yes" | "no" | "partial"; text: string };
}> = [
  {
    label: `Live TREB feed (every ${config.CITY_NAME} listing)`,
    aamir: { mark: "yes", text: "Yes — same data MLS gives me" },
    diy: { mark: "no", text: "Delayed 24–48 hrs" },
    out: { mark: "partial", text: `Yes but no ${config.CITY_NAME} context` },
  },
  {
    label: "Replies within 60 min",
    aamir: { mark: "yes", text: "Yes — guaranteed" },
    diy: { mark: "no", text: "You email landlords yourself" },
    out: { mark: "partial", text: "24–72 hr response typical" },
  },
  {
    label: `Knows ${config.CITY_NAME} schools, transit, builders`,
    aamir: { mark: "yes", text: `Lived & worked here ${config.realtor.yearsExperience} years` },
    diy: { mark: "no", text: "You research alone" },
    out: { mark: "partial", text: "Generic city info" },
  },
  {
    label: "Negotiates rent on your behalf",
    aamir: { mark: "yes", text: "Yes — saved clients $150–$400/mo" },
    diy: { mark: "no", text: "You negotiate alone" },
    out: { mark: "partial", text: "Rarely, not their focus" },
  },
  {
    label: "Reviews lease before you sign",
    aamir: { mark: "yes", text: "Yes — flags hidden clauses" },
    diy: { mark: "no", text: "You sign as-is" },
    out: { mark: "partial", text: "Sometimes" },
  },
  {
    label: "Same-day showings",
    aamir: { mark: "yes", text: "Yes when the property allows" },
    diy: { mark: "no", text: "You coordinate yourself" },
    out: { mark: "partial", text: `Limited ${config.CITY_NAME} availability` },
  },
  {
    label: "Cost to renter",
    aamir: { mark: "yes", text: "$0 — landlord pays commission" },
    diy: { mark: "yes", text: "Free but you do all the work" },
    out: { mark: "yes", text: "$0 but slower & less informed" },
  },
];

function MarkIcon({ mark }: { mark: "yes" | "no" | "partial" }) {
  if (mark === "yes") return <span className="text-green-400 font-bold" aria-label="yes">✓</span>;
  if (mark === "no") return <span className="text-red-400 font-bold" aria-label="no">✗</span>;
  return <span className="text-[#fbbf24] font-bold" aria-label="partial">~</span>;
}

export default function ComparisonTable() {
  return (
    <section className="bg-[#0a1628] border-t border-[#1e3a5f] py-14 sm:py-20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <p className="text-[11px] font-bold tracking-[0.18em] text-[#f59e0b] uppercase mb-3 text-center">
          Why {REALTOR_FIRST_NAME} vs Doing It Yourself
        </p>
        <h2 className="text-[26px] sm:text-[34px] font-extrabold text-white tracking-[-0.02em] leading-[1.15] text-center mb-8 sm:mb-10 max-w-3xl mx-auto">
          The difference between getting <em className="not-italic text-[#cbd5e1]">a</em> place and getting{" "}
          <em className="not-italic text-[#fbbf24]">the right</em> place.
        </h2>

        {/* Desktop table */}
        <div className="hidden md:block overflow-hidden rounded-2xl border border-[#1e3a5f]">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-[#0c1e35]">
                <th className="px-5 py-4 text-[11px] font-bold uppercase tracking-wider text-[#94a3b8]"></th>
                <th className="px-5 py-4 bg-[#f59e0b]/10 border-l border-r border-[#f59e0b]/30">
                  <p className="text-[13px] font-extrabold text-[#fbbf24]">{config.realtor.name}</p>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-[#fbbf24]/70 mt-0.5">RE/MAX Hall of Fame</p>
                </th>
                <th className="px-5 py-4">
                  <p className="text-[13px] font-bold text-white">Realtor.ca / Zillow</p>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-[#94a3b8] mt-0.5">DIY search</p>
                </th>
                <th className="px-5 py-4">
                  <p className="text-[13px] font-bold text-white">Out-of-area agent</p>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-[#94a3b8] mt-0.5">&nbsp;</p>
                </th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((r, i) => (
                <tr
                  key={r.label}
                  className={i % 2 === 0 ? "bg-[#07111f]" : "bg-[#0a1628]"}
                >
                  <td className="px-5 py-4 text-[13px] font-semibold text-[#cbd5e1] border-t border-[#1e3a5f]">{r.label}</td>
                  <td className="px-5 py-4 bg-[#f59e0b]/[0.06] border-l border-r border-[#f59e0b]/30 border-t border-t-[#f59e0b]/20">
                    <span className="inline-flex items-start gap-2 text-[13px] text-[#f8f9fb]">
                      <MarkIcon mark={r.aamir.mark} />
                      <span>{r.aamir.text}</span>
                    </span>
                  </td>
                  <td className="px-5 py-4 border-t border-[#1e3a5f]">
                    <span className="inline-flex items-start gap-2 text-[13px] text-[#94a3b8]">
                      <MarkIcon mark={r.diy.mark} />
                      <span>{r.diy.text}</span>
                    </span>
                  </td>
                  <td className="px-5 py-4 border-t border-[#1e3a5f]">
                    <span className="inline-flex items-start gap-2 text-[13px] text-[#94a3b8]">
                      <MarkIcon mark={r.out.mark} />
                      <span>{r.out.text}</span>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile: stacked cards */}
        <div className="md:hidden space-y-4">
          {ROWS.map((r) => (
            <div key={r.label} className="bg-[#0c1e35] border border-[#1e3a5f] rounded-xl overflow-hidden">
              <p className="px-4 py-3 text-[13px] font-bold text-white border-b border-[#1e3a5f]">{r.label}</p>
              <div className="bg-[#f59e0b]/10 border-b border-[#f59e0b]/30 px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#fbbf24] mb-1">{REALTOR_FIRST_NAME}</p>
                <p className="text-[12px] text-[#f8f9fb] flex items-start gap-2">
                  <MarkIcon mark={r.aamir.mark} />
                  <span>{r.aamir.text}</span>
                </p>
              </div>
              <div className="border-b border-[#1e3a5f] px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#94a3b8] mb-1">DIY</p>
                <p className="text-[12px] text-[#cbd5e1] flex items-start gap-2">
                  <MarkIcon mark={r.diy.mark} />
                  <span>{r.diy.text}</span>
                </p>
              </div>
              <div className="px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#94a3b8] mb-1">Out-of-area</p>
                <p className="text-[12px] text-[#cbd5e1] flex items-start gap-2">
                  <MarkIcon mark={r.out.mark} />
                  <span>{r.out.text}</span>
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="text-center mt-9">
          <a
            href="#lead-form"
            className="inline-block bg-[#f59e0b] hover:bg-[#fbbf24] text-[#07111f] font-extrabold text-[15px] px-8 py-4 rounded-xl shadow-lg shadow-[#f59e0b]/20 transition-all"
          >
            Get matched with {REALTOR_FIRST_NAME} →
          </a>
        </div>
      </div>
    </section>
  );
}

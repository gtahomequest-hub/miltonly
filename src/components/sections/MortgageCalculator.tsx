"use client";
import { useEffect, useState } from "react";
import { monthlyPayment, ontarioLTT, cmhcPremium, stressTestRate, formatMoney, formatMoneyShort } from "@/lib/mortgage-math";
import { attributionPayload } from "@/lib/attribution";

export default function MortgageCalculator() {
  const [price, setPrice] = useState(1050000);
  const [downPct, setDownPct] = useState(20);
  const [rate, setRate] = useState(4.99);
  const [years, setYears] = useState(25);
  const [matchCount, setMatchCount] = useState<number | null>(null);
  const [showLeadForm, setShowLeadForm] = useState(false);

  const downAmount = Math.round(price * downPct / 100);
  const cmhc = cmhcPremium(price, downPct);
  const mortgage = price - downAmount + cmhc;
  const ltt = ontarioLTT(price);
  const monthly = monthlyPayment(mortgage, rate, years);
  const stressRate = stressTestRate(rate);
  const stressMonthly = monthlyPayment(mortgage, stressRate, years);
  const totalCash = downAmount + ltt + 2500; // +$2500 estimated legal/inspection

  // Debounced match count fetch
  useEffect(() => {
    const t = setTimeout(() => {
      fetch(`/api/listings/count?maxPrice=${price}`)
        .then(r => r.json())
        .then(d => setMatchCount(d.count))
        .catch(() => setMatchCount(null));
    }, 400);
    return () => clearTimeout(t);
  }, [price]);

  return (
    <section className="bg-white border-t border-[#e2e8f0] px-5 sm:px-11 py-12">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-5 gap-8">
        {/* LEFT — Inputs */}
        <div className="lg:col-span-2">
          <p className="text-[11px] font-bold text-[#f59e0b] tracking-[0.18em] mb-2">
            🧮 MILTON-SPECIFIC · LAND TRANSFER TAX INCLUDED
          </p>
          <h2 className="text-[28px] sm:text-[32px] font-extrabold text-[#07111f] tracking-[-0.02em] leading-[1.1] mb-3">
            What can you actually afford in Milton?
          </h2>
          <p className="text-[14px] text-[#475569] leading-relaxed mb-6 max-w-md">
            Most calculators show you a payment. We show you the real all-in cost — Ontario land transfer tax, CMHC insurance, and the stress-test rate every Canadian lender uses. No surprises at closing.
          </p>

          {/* Price slider */}
          <div className="mb-5">
            <div className="flex justify-between mb-1.5">
              <label className="text-[12px] font-bold text-[#64748b] uppercase tracking-wider">Home price</label>
              <span className="text-[14px] font-extrabold text-[#07111f]">{formatMoneyShort(price)}</span>
            </div>
            <input type="range" min={400000} max={2500000} step={10000} value={price} onChange={e => setPrice(parseInt(e.target.value))} className="w-full accent-[#f59e0b]" />
            <div className="flex justify-between text-[10px] text-[#94a3b8] mt-1">
              <span>$400K</span><span>$2.5M</span>
            </div>
          </div>

          {/* Down payment slider */}
          <div className="mb-5">
            <div className="flex justify-between mb-1.5">
              <label className="text-[12px] font-bold text-[#64748b] uppercase tracking-wider">Down payment</label>
              <span className="text-[14px] font-extrabold text-[#07111f]">{downPct}% · {formatMoneyShort(downAmount)}</span>
            </div>
            <input type="range" min={5} max={50} step={1} value={downPct} onChange={e => setDownPct(parseInt(e.target.value))} className="w-full accent-[#f59e0b]" />
            <div className="flex justify-between text-[10px] text-[#94a3b8] mt-1">
              <span>5%</span><span>50%</span>
            </div>
          </div>

          {/* Rate slider */}
          <div className="mb-5">
            <div className="flex justify-between mb-1.5">
              <label className="text-[12px] font-bold text-[#64748b] uppercase tracking-wider">Mortgage rate</label>
              <span className="text-[14px] font-extrabold text-[#07111f]">{rate.toFixed(2)}%</span>
            </div>
            <input type="range" min={3} max={8} step={0.05} value={rate} onChange={e => setRate(parseFloat(e.target.value))} className="w-full accent-[#f59e0b]" />
            <p className="text-[10px] text-[#94a3b8] mt-1">Avg Milton 5-yr fixed today</p>
          </div>

          {/* Amortization toggle */}
          <div>
            <label className="text-[12px] font-bold text-[#64748b] uppercase tracking-wider mb-2 block">Amortization</label>
            <div className="flex gap-2">
              {[25, 30].map(y => (
                <button key={y} type="button" onClick={() => setYears(y)}
                  className={`text-[13px] font-bold px-4 py-2 rounded-full border transition-colors ${
                    years === y ? "bg-[#07111f] border-[#07111f] text-[#f59e0b]" : "bg-white border-[#e2e8f0] text-[#64748b] hover:text-[#475569]"
                  }`}>
                  {y} years
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT — Results panel */}
        <div className="lg:col-span-3">
          <div className="bg-[#07111f] rounded-xl p-7">
            <p className="text-[11px] font-bold text-[#f59e0b] tracking-[0.18em] mb-2">YOUR MONTHLY PAYMENT</p>
            <p className="text-[40px] sm:text-[48px] font-extrabold text-[#f8f9fb] tracking-[-0.02em] leading-none">
              {formatMoney(monthly)}<span className="text-[20px] text-[#94a3b8] font-bold">/mo</span>
            </p>
            <p className="text-[12px] text-[#94a3b8] mt-2">Principal + interest, {years}-yr amortization, {rate.toFixed(2)}%</p>

            <div className="border-t border-[#1e3a5f] my-5" />

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <p className="text-[10px] text-[#94a3b8] uppercase tracking-wider mb-1">Mortgage</p>
                <p className="text-[16px] font-extrabold text-[#f8f9fb]">{formatMoneyShort(mortgage)}</p>
              </div>
              <div>
                <p className="text-[10px] text-[#94a3b8] uppercase tracking-wider mb-1">ON Land transfer</p>
                <p className="text-[16px] font-extrabold text-[#f8f9fb]">{formatMoneyShort(ltt)}</p>
              </div>
              <div>
                <p className="text-[10px] text-[#94a3b8] uppercase tracking-wider mb-1">CMHC premium</p>
                <p className="text-[16px] font-extrabold text-[#f8f9fb]">{cmhc === 0 ? "—" : formatMoneyShort(cmhc)}</p>
              </div>
              <div>
                <p className="text-[10px] text-[#94a3b8] uppercase tracking-wider mb-1">Cash to close</p>
                <p className="text-[16px] font-extrabold text-[#f59e0b]">{formatMoneyShort(totalCash)}</p>
              </div>
            </div>

            <div className="border-t border-[#1e3a5f] my-5" />

            <div className="bg-[#0c1e35] border border-[#f59e0b]/30 rounded-lg p-4 mb-5">
              <p className="text-[12px] font-bold text-[#f59e0b] mb-1">🛡️ Stress test: {stressRate.toFixed(2)}% → {formatMoney(stressMonthly)}/mo</p>
              <p className="text-[11px] text-[#94a3b8] leading-relaxed">Canadian lenders qualify you at this higher rate (B-20 rule). To get approved, you need to afford this number — not the headline rate.</p>
            </div>

            {matchCount !== null && matchCount > 0 && (
              <a href={`/listings?maxPrice=${price}`} className="block bg-[#0c1e35] border border-[#1e3a5f] rounded-lg p-4 mb-5 hover:border-[#f59e0b] transition-colors">
                <p className="text-[14px] font-bold text-[#f8f9fb]">📍 {matchCount.toLocaleString()} Milton homes fit this budget →</p>
                <p className="text-[11px] text-[#94a3b8] mt-1">See active listings under {formatMoneyShort(price)}</p>
              </a>
            )}

            <button onClick={() => setShowLeadForm(true)} className="block w-full bg-[#f59e0b] text-[#07111f] text-[14px] font-extrabold py-3 rounded-xl hover:bg-[#fbbf24] transition-colors">
              📞 Get pre-approved with Aamir&apos;s broker
            </button>
            <a href="tel:+16478399090" className="block text-center text-[12px] font-bold text-[#94a3b8] hover:text-[#f59e0b] mt-3 transition-colors">
              Or text Aamir: (647) 839-9090
            </a>
          </div>
        </div>
      </div>

      {showLeadForm && (
        <PreApprovalModal
          onClose={() => setShowLeadForm(false)}
          context={{ price, downAmount, monthly, rate, years }}
        />
      )}
    </section>
  );
}

// Inline modal — keeps the file self-contained
function PreApprovalModal({ onClose, context }: { onClose: () => void; context: { price: number; downAmount: number; monthly: number; rate: number; years: number } }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const formatPhone = (v: string) => {
    const d = v.replace(/\D/g, "").slice(0, 10);
    if (d.length < 4) return d;
    if (d.length < 7) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
    return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const phoneDigits = phone.replace(/\D/g, "");
    if (!name.trim() || phoneDigits.length !== 10) {
      setError("Please enter your name and a valid 10-digit phone.");
      return;
    }
    setSubmitting(true);
    try {
      const notes = `Mortgage calc: ${formatMoneyShort(context.price)} home, ${formatMoneyShort(context.downAmount)} down, ~${formatMoney(context.monthly)}/mo at ${context.rate.toFixed(2)}% over ${context.years}yr`;
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: name.trim(),
          phone: phoneDigits,
          email: email.trim(),
          intent: "buyer",
          source: "homepage-mortgage-calculator",
          notes,
          ...attributionPayload(),
        }),
      });
      if (!res.ok) throw new Error();
      setSuccess(true);
    } catch {
      setError("Something went wrong. Please call (647) 839-9090.");
    } finally {
      setSubmitting(false);
    }
  }

  const fieldCls = "bg-[#07111f] border border-[#1e3a5f] text-[#f8f9fb] rounded-lg px-3 py-2.5 text-[14px] focus:border-[#f59e0b] focus:outline-none w-full";

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#0c1e35] border border-[#1e3a5f] rounded-xl p-6 max-w-md w-full" onClick={e => e.stopPropagation()}>
        {success ? (
          <>
            <p className="text-[24px] mb-2">✅</p>
            <p className="text-[20px] font-extrabold text-[#f8f9fb] mb-2">Aamir&apos;s broker will call you</p>
            <p className="text-[13px] text-[#94a3b8] leading-relaxed mb-5">Usually within 1 business day. They&apos;ll get you a real pre-approval (not a soft estimate) so you can shop with confidence.</p>
            <button onClick={onClose} className="w-full bg-[#f59e0b] text-[#07111f] text-[14px] font-extrabold py-3 rounded-xl hover:bg-[#fbbf24]">Close</button>
          </>
        ) : (
          <form onSubmit={submit}>
            <p className="text-[20px] font-extrabold text-[#f8f9fb] mb-1">Get pre-approved</p>
            <p className="text-[13px] text-[#94a3b8] mb-5">Aamir works with brokers who specialize in Milton. They&apos;ll get you a real pre-approval letter, not a soft estimate.</p>
            <input className={fieldCls + " mb-3"} placeholder="Your name" value={name} onChange={e => setName(e.target.value)} autoFocus />
            <input className={fieldCls + " mb-3"} type="tel" inputMode="tel" placeholder="(___) ___-____" value={phone} onChange={e => setPhone(formatPhone(e.target.value))} />
            <input className={fieldCls + " mb-4"} type="email" inputMode="email" placeholder="Email (optional)" value={email} onChange={e => setEmail(e.target.value)} />
            {error && <p className="text-[12px] text-[#ef4444] mb-3">{error}</p>}
            <button type="submit" disabled={submitting} className="w-full bg-[#f59e0b] text-[#07111f] text-[14px] font-extrabold py-3 rounded-xl hover:bg-[#fbbf24] disabled:opacity-60">
              {submitting ? "Sending…" : "Request pre-approval call →"}
            </button>
            <button type="button" onClick={onClose} className="w-full text-[12px] text-[#94a3b8] mt-3 hover:text-[#f8f9fb]">Cancel</button>
          </form>
        )}
      </div>
    </div>
  );
}

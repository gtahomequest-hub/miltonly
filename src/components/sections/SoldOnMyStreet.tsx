"use client";
import { useState, useEffect, useRef } from "react";
import { attributionPayload } from "@/lib/attribution";
import { config } from "@/lib/config";

type Stats =
  | { found: false; name: string }
  | { found: true; sparse: true; name: string; slug: string; count90: number; count12: number }
  | {
      found: true;
      sparse: false;
      name: string;
      slug: string;
      count90: number;
      count12: number;
      avgSold: number | null;
      medianSold: number | null;
      avgList: number | null;
      avgDom: number | null;
      soldToAskPct: number | null;
      priceYoyPct: number | null;
      temperature: string | null;
      lastUpdated: string;
    };

type AutocompleteItem = { name: string; slug: string };

function formatMoneyShort(n: number | null): string {
  if (n === null) return "—";
  if (n >= 1000000) return `$${(n / 1000000).toFixed(2)}M`;
  if (n >= 1000) return `$${Math.round(n / 1000)}K`;
  return `$${Math.round(n)}`;
}

function tempBadge(t: string | null): { label: string; cls: string } {
  const map: Record<string, { label: string; cls: string }> = {
    hot: { label: "🔥 HOT MARKET", cls: "bg-[#dc2626]/20 text-[#fca5a5] border-[#dc2626]/40" },
    warm: { label: "📈 WARM MARKET", cls: "bg-[#f59e0b]/20 text-[#fbbf24] border-[#f59e0b]/40" },
    balanced: { label: "⚖️ BALANCED", cls: "bg-[#3b82f6]/20 text-[#93c5fd] border-[#3b82f6]/40" },
    cool: { label: "❄️ COOL MARKET", cls: "bg-[#64748b]/20 text-[#94a3b8] border-[#64748b]/40" },
    cold: { label: "🧊 COLD MARKET", cls: "bg-[#475569]/30 text-[#cbd5e1] border-[#475569]/50" },
  };
  return map[t || ""] || { label: "MARKET DATA", cls: "bg-[#1e3a5f] text-[#94a3b8] border-[#1e3a5f]" };
}

export default function SoldOnMyStreet() {
  const [streetInput, setStreetInput] = useState("");
  const [suggestions, setSuggestions] = useState<AutocompleteItem[]>([]);
  const [showSuggest, setShowSuggest] = useState(false);
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Lead capture
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [leadError, setLeadError] = useState("");

  const formatPhone = (v: string) => {
    const d = v.replace(/\D/g, "").slice(0, 10);
    if (d.length < 4) return d;
    if (d.length < 7) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
    return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  };

  // Autocomplete on street input
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = streetInput.trim();
    if (q.length < 2) {
      setSuggestions([]);
      return;
    }
    debounceRef.current = setTimeout(() => {
      fetch(`/api/autocomplete?type=street&q=${encodeURIComponent(q)}`)
        .then(r => r.json())
        .then((items: AutocompleteItem[]) => {
          setSuggestions(Array.isArray(items) ? items.slice(0, 6) : []);
          setShowSuggest(true);
        })
        .catch(() => setSuggestions([]));
    }, 200);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [streetInput]);

  function pickStreet(item: AutocompleteItem) {
    setStreetInput(item.name);
    setSelectedName(item.name);
    setSuggestions([]);
    setShowSuggest(false);
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearchError("");
    if (!selectedName) {
      setSearchError("Please pick your street from the suggestions.");
      return;
    }
    setSearching(true);
    setStats(null);
    try {
      const res = await fetch(`/api/sold-stats?name=${encodeURIComponent(selectedName)}`);
      if (!res.ok) throw new Error();
      const data: Stats = await res.json();
      setStats(data);
    } catch {
      setSearchError(`Couldn't fetch sold data. Please try again or call ${config.realtor.phone}.`);
    } finally {
      setSearching(false);
    }
  }

  async function handleLeadSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLeadError("");
    const phoneDigits = phone.replace(/\D/g, "");
    if (phoneDigits.length !== 10 || !email.includes("@")) {
      setLeadError("Please enter a valid email and 10-digit phone.");
      return;
    }
    setSubmitting(true);
    try {
      let notes = `Street: ${selectedName ?? streetInput}.`;
      if (stats && stats.found && !stats.sparse) {
        notes += ` Stats: ${stats.count90} sales (90d), avg ${formatMoneyShort(stats.avgSold)}, ${stats.avgDom !== null ? Math.round(stats.avgDom) : "?"}d DOM, ${stats.soldToAskPct ?? "?"}% sold-to-ask, ${stats.temperature ?? "?"}.`;
      } else if (stats && stats.found && stats.sparse) {
        notes += ` Sparse-data fallback (count90=${stats.count90}, count12=${stats.count12}).`;
      }
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: "Sold Report Subscriber",
          phone: phoneDigits,
          email,
          intent: "seller",
          source: "homepage-sold-on-my-street",
          notes,
          ...attributionPayload(),
        }),
      });
      if (!res.ok) throw new Error();
      setSuccess(true);
    } catch {
      setLeadError(`Something went wrong. Please call ${config.realtor.phone}.`);
    } finally {
      setSubmitting(false);
    }
  }

  const fieldCls = "bg-[#07111f] border border-[#1e3a5f] text-[#f8f9fb] rounded-lg px-3 py-2.5 text-[14px] focus:border-[#f59e0b] focus:outline-none w-full";
  const hasStats = stats !== null && stats.found;
  const showRich = hasStats && !stats.sparse;
  const temp = showRich ? tempBadge(stats.temperature) : null;

  return (
    <section className="bg-[#07111f] border-t border-[#1e3a5f] px-5 sm:px-11 py-12">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-5 gap-8">
        {/* LEFT — Pitch */}
        <div className="lg:col-span-2 flex flex-col justify-center">
          <p className="text-[11px] font-bold text-[#f59e0b] tracking-[0.18em] mb-2">
            🏷️ FOR SELLERS · OWNERS · CURIOUS NEIGHBOURS
          </p>
          <h2 className="text-[28px] sm:text-[32px] font-extrabold text-[#f8f9fb] tracking-[-0.02em] leading-[1.1] mb-3">
            What sold on my street?
          </h2>
          <p className="text-[14px] text-[#94a3b8] leading-relaxed mb-5 max-w-lg">
            Pick your street. See the live 90-day market — how many homes sold, what they averaged, how the market is leaning right now. Want the full per-address report + a free CMA on your home? Aamir prepares it personally within 1 business day.
          </p>

          <div className="grid grid-cols-3 gap-4 max-w-md mb-5">
            <div>
              <p className="text-[18px] font-extrabold text-[#f59e0b]">🏘️ 7,094</p>
              <p className="text-[11px] text-[#94a3b8] leading-tight mt-1">{config.CITY_NAME} sales tracked</p>
            </div>
            <div>
              <p className="text-[18px] font-extrabold text-[#f59e0b]">💯 100%</p>
              <p className="text-[11px] text-[#94a3b8] leading-tight mt-1">TREB-verified data</p>
            </div>
            <div>
              <p className="text-[18px] font-extrabold text-[#f59e0b]">📅 Daily</p>
              <p className="text-[11px] text-[#94a3b8] leading-tight mt-1">Refreshed every night</p>
            </div>
          </div>

          <div className="bg-[#0c1e35] border border-[#1e3a5f] rounded-lg p-4">
            <p className="text-[11px] font-bold text-[#94a3b8] uppercase tracking-wider mb-2">What you&apos;ll see</p>
            <ul className="space-y-1.5 text-[13px] text-[#f8f9fb]">
              <li>✅ 90-day sale count, avg price, days-on-market</li>
              <li>✅ Sold-to-asking ratio + year-over-year trend</li>
              <li>✅ Live market temperature (hot/warm/cool/cold)</li>
              <li>✅ Free CMA from Aamir — what your home is worth today</li>
            </ul>
            <p className="mt-3 text-[10px] text-[#64748b] leading-relaxed">
              🛡️ TREB VOW compliant. Per-address detail provided privately by a licensed agent (Aamir Yaqoob, RE/MAX).
            </p>
          </div>
        </div>

        {/* RIGHT — Search + result */}
        <div className="lg:col-span-3">
          {!hasStats && !success && (
            <form onSubmit={handleSearch} className="bg-[#0c1e35] border border-[#1e3a5f] rounded-xl p-6 sm:p-7">
              <p className="text-[20px] font-extrabold text-[#f8f9fb] mb-2">See what sold on your street</p>
              <p className="text-[13px] text-[#94a3b8] mb-5">Free aggregate preview — no signup needed for the stats.</p>

              <div className="relative mb-3">
                <label className="text-[12px] font-bold text-[#94a3b8] uppercase tracking-wider mb-1.5 block" htmlFor="sold-street">Your street</label>
                <input
                  id="sold-street"
                  value={streetInput}
                  onChange={(e) => { setStreetInput(e.target.value); setSelectedName(null); }}
                  onFocus={() => setShowSuggest(true)}
                  onBlur={() => setTimeout(() => setShowSuggest(false), 150)}
                  placeholder="Start typing… e.g. Costigan"
                  className={fieldCls}
                  autoComplete="off"
                />
                {showSuggest && suggestions.length > 0 && (
                  <ul className="absolute z-10 left-0 right-0 mt-1 bg-[#07111f] border border-[#1e3a5f] rounded-lg overflow-hidden shadow-lg">
                    {suggestions.map((s) => (
                      <li key={`${s.name}|${s.slug}`}>
                        <button
                          type="button"
                          onMouseDown={(e) => { e.preventDefault(); pickStreet(s); }}
                          className="w-full text-left text-[14px] text-[#f8f9fb] px-3 py-2 hover:bg-[#0c1e35] hover:text-[#f59e0b]"
                        >
                          {s.name}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {searchError && <p className="text-[12px] text-[#ef4444] mb-3">{searchError}</p>}

              <button type="submit" disabled={searching || !selectedName} className="mt-2 w-full bg-[#f59e0b] text-[#07111f] text-[14px] font-extrabold py-3 rounded-xl hover:bg-[#fbbf24] transition-colors disabled:opacity-60 disabled:cursor-not-allowed">
                {searching ? "Loading…" : "🔍 Show me what sold"}
              </button>
            </form>
          )}

          {hasStats && !success && (
            <div className="bg-[#0c1e35] border border-[#1e3a5f] rounded-xl p-6 sm:p-7">
              <div className="flex items-center justify-between mb-4">
                <p className="text-[15px] font-bold text-[#f8f9fb]">📍 Recently sold on {selectedName} · last 90 days</p>
                <button onClick={() => { setStats(null); setSelectedName(null); setStreetInput(""); }} className="text-[12px] text-[#94a3b8] hover:text-[#f59e0b]">← New search</button>
              </div>

              {showRich && (
                <>
                  {temp && (
                    <span className={`inline-block text-[10px] font-bold px-2.5 py-1 rounded-full border tracking-wider mb-4 ${temp.cls}`}>
                      {temp.label}
                    </span>
                  )}

                  <div className="grid grid-cols-3 gap-3 mb-5">
                    <div className="bg-[#07111f] rounded-lg p-3 text-center">
                      <p className="text-[24px] font-extrabold text-[#f59e0b]">{stats.count90}</p>
                      <p className="text-[10px] text-[#94a3b8] uppercase tracking-wider mt-1">Sales · 90d</p>
                    </div>
                    <div className="bg-[#07111f] rounded-lg p-3 text-center">
                      <p className="text-[24px] font-extrabold text-[#f59e0b]">{formatMoneyShort(stats.avgSold)}</p>
                      <p className="text-[10px] text-[#94a3b8] uppercase tracking-wider mt-1">Avg sold</p>
                    </div>
                    <div className="bg-[#07111f] rounded-lg p-3 text-center">
                      <p className="text-[24px] font-extrabold text-[#f59e0b]">{stats.avgDom !== null ? Math.round(stats.avgDom) : "—"}d</p>
                      <p className="text-[10px] text-[#94a3b8] uppercase tracking-wider mt-1">Avg DOM</p>
                    </div>
                  </div>

                  <p className="text-[13px] text-[#94a3b8] mb-1">
                    Asking → selling: <span className="text-[#f8f9fb] font-bold">{formatMoneyShort(stats.avgList)} → {formatMoneyShort(stats.avgSold)}</span>
                  </p>
                  <p className="text-[13px] text-[#94a3b8] mb-1">
                    Sold-to-ask: <span className="text-[#f8f9fb] font-bold">{stats.soldToAskPct}%</span> {stats.soldToAskPct !== null && stats.soldToAskPct >= 100 ? "(over asking)" : "(under asking)"}
                  </p>
                  {stats.priceYoyPct !== null && (
                    <p className="text-[13px] text-[#94a3b8] mb-5">
                      Year-over-year: <span className={`font-bold ${stats.priceYoyPct >= 0 ? "text-[#34d399]" : "text-[#f87171]"}`}>
                        {stats.priceYoyPct >= 0 ? "↑ +" : "↓ "}{stats.priceYoyPct}%
                      </span>
                    </p>
                  )}
                </>
              )}

              {hasStats && stats.sparse && (
                <div className="mb-5">
                  <p className="text-[13px] text-[#94a3b8] leading-relaxed">
                    {stats.count12 > 0
                      ? `Only ${stats.count12} sale${stats.count12 === 1 ? "" : "s"} on this street in the last 12 months — too few for a meaningful 90-day average without compromising seller privacy.`
                      : "Not enough recent activity on this street to publish public stats."}{" "}
                    Aamir can run a custom comp analysis covering nearby streets.
                  </p>
                </div>
              )}

              <form onSubmit={handleLeadSubmit} className="bg-[#07111f] border border-[#f59e0b]/30 rounded-lg p-4">
                <p className="text-[14px] font-bold text-[#f8f9fb] mb-1">
                  {hasStats && stats.sparse
                    ? "🔓 Request a custom CMA from Aamir"
                    : "🔓 Get the full report — addresses + Aamir's CMA"}
                </p>
                <p className="text-[12px] text-[#94a3b8] mb-4">
                  Aamir prepares your per-address breakdown + a free CMA on your home — emailed within 1 business day.
                </p>

                <div className="flex flex-col sm:flex-row gap-2 mb-3">
                  <input type="email" required placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="flex-1 bg-[#0c1e35] border border-[#1e3a5f] text-[#f8f9fb] rounded-lg px-3 py-2.5 text-[14px] focus:border-[#f59e0b] focus:outline-none" />
                  <input type="tel" inputMode="tel" required placeholder="(___) ___-____" value={phone} onChange={(e) => setPhone(formatPhone(e.target.value))} className="flex-1 bg-[#0c1e35] border border-[#1e3a5f] text-[#f8f9fb] rounded-lg px-3 py-2.5 text-[14px] focus:border-[#f59e0b] focus:outline-none" />
                </div>

                {leadError && <p className="text-[12px] text-[#ef4444] mb-3">{leadError}</p>}

                <button type="submit" disabled={submitting} className="w-full bg-[#f59e0b] text-[#07111f] text-[14px] font-extrabold py-3 rounded-xl hover:bg-[#fbbf24] transition-colors disabled:opacity-60">
                  {submitting ? "Sending…" : "Send my report →"}
                </button>
                <p className="mt-2 text-[11px] text-[#64748b] text-center">Free. No spam. CMA prepared by a licensed agent.</p>
              </form>
            </div>
          )}

          {success && (
            <div className="bg-[#0c1e35] border border-[#1e3a5f] rounded-xl p-6 sm:p-7">
              <p className="text-[24px] mb-2">✅</p>
              <p className="text-[20px] font-extrabold text-[#f8f9fb] mb-2">Aamir is on it</p>
              <p className="text-[13px] text-[#94a3b8] leading-relaxed mb-4">
                Your full sold report + free CMA will land in your inbox within 1 business day. Aamir reviews every street personally before sending.
              </p>
              <a href={`tel:${config.realtor.phoneE164}`} className="inline-block text-[13px] font-bold text-[#f59e0b] hover:underline">
                Want to talk now? Call {config.realtor.phone}
              </a>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

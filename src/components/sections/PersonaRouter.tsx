"use client";

import { useState } from "react";
import { attributionPayload } from "@/lib/attribution";

type Persona = {
  emoji: string;
  name: string;
  desc: string;
  bullets: string[];
  source: string;
};

const PERSONAS: Persona[] = [
  {
    emoji: "🏡",
    name: "First-time buyer",
    desc: "Saving your first down payment. Want to understand what's actually affordable in Milton today.",
    bullets: [
      "Down payment + closing cost breakdown",
      "First-Time Buyer Incentive walkthrough",
      "Townhouses under $700K shortlist",
    ],
    source: "homepage-persona-first-time-buyer",
  },
  {
    emoji: "🍁",
    name: "New to Canada",
    desc: "Recently arrived or planning your move. Need a Milton overview, schools, mosques, and the no-Canadian-credit mortgage path.",
    bullets: [
      "Newcomer-friendly lender intros",
      "Schools + community guide",
      "Rental → ownership 2-yr plan",
    ],
    source: "homepage-persona-newcomer",
  },
  {
    emoji: "🏘️",
    name: "Move-up family",
    desc: "Outgrowing your starter home. Want to sell smart and trade up without bridging stress.",
    bullets: [
      "Free CMA on your current home",
      "Sell-then-buy timing strategy",
      "Detached homes by school zone",
    ],
    source: "homepage-persona-move-up",
  },
];

function PersonaCard({ persona }: { persona: Persona }) {
  const [phone, setPhone] = useState("");
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
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) {
      setError("Please enter your 10-digit phone.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: "Persona Lead",
          lastName: "",
          email: "",
          phone: digits,
          source: persona.source,
          notes: `Persona: ${persona.name}`,
          ...attributionPayload(),
        }),
      });
      if (!res.ok) throw new Error();
      setSuccess(true);
    } catch {
      setError("Couldn't send — please try (647) 839-9090 directly");
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="border border-amber-500/60 rounded-xl p-6 bg-[#0c1e35]">
        <p className="text-2xl mb-2">✅</p>
        <p className="text-white font-bold text-base mb-1">Got it.</p>
        <p className="text-slate-300 text-sm leading-relaxed mb-3">
          Aamir will call within 1 business day. Save his number:{" "}
          <a href="tel:6478399090" className="text-amber-400 font-semibold hover:underline">
            (647) 839-9090
          </a>
        </p>
        <button
          type="button"
          onClick={() => { setSuccess(false); setPhone(""); }}
          className="text-xs text-slate-400 hover:text-amber-400"
        >
          ← Pick a different path
        </button>
      </div>
    );
  }

  return (
    <div className="border border-slate-700 hover:border-amber-500/60 rounded-xl p-6 transition bg-[#0c1e35] flex flex-col">
      <div className="text-4xl mb-2">{persona.emoji}</div>
      <p className="text-lg font-bold text-white mb-2">{persona.name}</p>
      <p className="text-sm text-slate-400 leading-relaxed mb-4">{persona.desc}</p>
      <ul className="space-y-1.5 mb-5">
        {persona.bullets.map((b) => (
          <li key={b} className="text-xs text-slate-300 leading-snug">✅ {b}</li>
        ))}
      </ul>
      <form onSubmit={submit} className="mt-auto">
        <input
          type="tel"
          inputMode="tel"
          required
          value={phone}
          onChange={(e) => setPhone(formatPhone(e.target.value))}
          placeholder="Your phone — we'll text you"
          className="w-full bg-[#07111f] border border-slate-700 text-white rounded-lg px-3 py-2.5 text-sm focus:border-amber-500 focus:outline-none mb-3"
          autoComplete="tel"
        />
        {error && <p className="text-xs text-red-400 mb-2">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-amber-500 hover:bg-amber-400 text-[#07111f] font-bold rounded-lg py-3 text-sm disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
        >
          {submitting ? "Sending…" : "Get my Milton roadmap →"}
        </button>
      </form>
    </div>
  );
}

export default function PersonaRouter() {
  return (
    <div className="rounded-2xl p-8 md:p-10 mb-12 bg-[#07111f]">
      <p className="text-xs font-bold uppercase tracking-wider text-amber-500 mb-2">
        🧭 NEW TO MILTON? START HERE
      </p>
      <h2 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight leading-tight mb-3">
        Tell us where you are. We&apos;ll point you to the right Milton.
      </h2>
      <p className="text-sm md:text-base text-slate-400 leading-relaxed max-w-2xl">
        Aamir has helped 400+ Milton families across these three paths. Pick yours, leave a phone, and get a personalized 10-minute call within 1 business day.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mt-8">
        {PERSONAS.map((p) => (
          <PersonaCard key={p.source} persona={p} />
        ))}
      </div>
    </div>
  );
}

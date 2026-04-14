"use client";

import { useState } from "react";

export default function MosqueAlertForm() {
  const [email, setEmail] = useState("");
  const [mosque, setMosque] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    try {
      await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          firstName: "",
          source: "mosque-alert",
          intent: "buyer",
          street: mosque || "Any mosque area",
        }),
      });
      setSubmitted(true);
    } catch {
      // silent fail — lead capture is best-effort
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <p className="text-[14px] font-bold text-[#f59e0b]">
        You&apos;re in — we&apos;ll email you when new listings appear near your preferred area.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row items-center justify-center gap-3 max-w-xl mx-auto">
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Your email"
        className="w-full sm:w-48 px-4 py-3 text-[13px] bg-[#0c1e35] border border-[#1e3a5f] text-[#f8f9fb] placeholder:text-[#64748b] rounded-lg outline-none focus:border-[#f59e0b]"
      />
      <input
        type="text"
        value={mosque}
        onChange={(e) => setMosque(e.target.value)}
        placeholder="Mosque or area (optional)"
        className="w-full sm:w-56 px-4 py-3 text-[13px] bg-[#0c1e35] border border-[#1e3a5f] text-[#f8f9fb] placeholder:text-[#64748b] rounded-lg outline-none focus:border-[#f59e0b]"
      />
      <button
        type="submit"
        disabled={loading}
        className="w-full sm:w-auto bg-[#f59e0b] text-[#07111f] text-[13px] font-bold px-6 py-3 rounded-lg hover:bg-[#fbbf24] transition-colors disabled:opacity-50 shrink-0"
      >
        {loading ? "Sending..." : "Get alerts"}
      </button>
    </form>
  );
}

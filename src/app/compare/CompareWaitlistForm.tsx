"use client";

import { useState } from "react";

export default function CompareWaitlistForm() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    try {
      await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: "Compare Waitlist",
          email,
          source: "compare-waitlist",
          intent: "buyer",
        }),
      });
      setSubmitted(true);
    } catch {
      // still show success — lead may have saved
      setSubmitted(true);
    }
    setLoading(false);
  };

  if (submitted) {
    return (
      <div className="bg-[#0c1e35] border border-[#22c55e]/30 rounded-xl p-5">
        <p className="text-[14px] font-bold text-white mb-1">You&apos;re on the list</p>
        <p className="text-[12px] text-[#94a3b8]">We&apos;ll email you as soon as Compare launches.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 max-w-md mx-auto">
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Enter your email"
        className="flex-1 bg-[#0c1e35] border border-[#334155] rounded-lg px-4 py-3 text-[13px] text-[#f8f9fb] placeholder:text-[#94a3b8] outline-none focus:border-[#f59e0b] transition-colors"
      />
      <button
        type="submit"
        disabled={loading}
        className="bg-[#f59e0b] text-[#07111f] text-[13px] font-extrabold px-5 py-3 rounded-lg hover:bg-[#eab308] transition-colors shrink-0 disabled:opacity-50"
      >
        {loading ? "..." : "Notify me"}
      </button>
    </form>
  );
}

"use client";

import { useState } from "react";

interface Props {
  address: string;
  slug: string;
}

export default function InquiryForm({ address, slug }: Props) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState(`I am interested in ${address}`);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !phone) {
      setErr("Name and phone are required.");
      return;
    }
    setErr("");
    setSending(true);
    try {
      const res = await fetch("/api/exclusive-inquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone, email, message, address, slug }),
      });
      if (res.ok) {
        setSent(true);
      } else {
        setErr("Something went wrong. Please call us directly.");
      }
    } catch {
      setErr("Network error. Please call us directly.");
    }
    setSending(false);
  };

  if (sent) {
    return (
      <div className="bg-white rounded-2xl border border-[#e2e8f0] p-5 mt-4 text-center">
        <p className="text-[15px] font-extrabold text-[#07111f] mb-2">✓ Inquiry sent</p>
        <p className="text-[12px] text-[#64748b]">Aamir will reach out within 15 minutes during business hours.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-[#e2e8f0] p-5 mt-4">
      <h3 className="text-[14px] font-extrabold text-[#07111f] mb-4">Request more information</h3>
      <div className="space-y-3">
        <div>
          <label className="block text-[10px] font-bold text-[#64748b] uppercase tracking-wider mb-1">
            Your name <span className="text-red-500">*</span>
          </label>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2.5 text-[13px] border border-[#e2e8f0] rounded-lg text-[#07111f] outline-none focus:border-[#f59e0b]"
          />
        </div>
        <div>
          <label className="block text-[10px] font-bold text-[#64748b] uppercase tracking-wider mb-1">
            Phone number <span className="text-red-500">*</span>
          </label>
          <input
            required
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="(647) 555-0000"
            className="w-full px-3 py-2.5 text-[13px] border border-[#e2e8f0] rounded-lg text-[#07111f] outline-none focus:border-[#f59e0b]"
          />
        </div>
        <div>
          <label className="block text-[10px] font-bold text-[#64748b] uppercase tracking-wider mb-1">Email (optional)</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2.5 text-[13px] border border-[#e2e8f0] rounded-lg text-[#07111f] outline-none focus:border-[#f59e0b]"
          />
        </div>
        <div>
          <label className="block text-[10px] font-bold text-[#64748b] uppercase tracking-wider mb-1">Message</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            className="w-full px-3 py-2.5 text-[13px] border border-[#e2e8f0] rounded-lg text-[#07111f] outline-none focus:border-[#f59e0b] resize-none"
          />
        </div>
      </div>
      {err && <p className="text-[12px] text-red-600 mt-3">{err}</p>}
      <button
        type="submit"
        disabled={sending}
        className="w-full mt-4 bg-[#f59e0b] text-[#07111f] text-[13px] font-extrabold rounded-xl py-3 hover:bg-[#fbbf24] transition-colors disabled:opacity-60"
      >
        {sending ? "Sending…" : "Send inquiry"}
      </button>
    </form>
  );
}

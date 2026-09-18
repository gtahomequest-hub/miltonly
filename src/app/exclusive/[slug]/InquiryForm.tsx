"use client";

// The off-market listing inquiry. Source "exclusive-listing".
//
// It had its own route, which wrote `email: ""` rather than null, hand-rolled a Resend email
// to the desk, sent Aamir an SMS, and sent the visitor nothing at all. A person who typed
// their email into this form got no acknowledgement of any kind. On the one path they now
// get the source-specific confirmation, and the row carries the environment tag, the
// honeypot verdict and the origin check the old route had none of.

import { useState } from "react";
import { postLeadDetailed, honeypotInputProps, HONEYPOT_WRAPPER_STYLE } from "@/lib/postLeadClient";
import { REPLY_FINE_PRINT } from "@/lib/lead/finePrint";

interface Props {
  address: string;
  slug: string;
}

export default function InquiryForm({ address, slug }: Props) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [honey, setHoney] = useState("");
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
    const result = await postLeadDetailed({
      source: "exclusive-listing",
      intent: "buy",
      name,
      phone,
      email: email || undefined,
      property_address: address,
      message,
      notes: `Off-market listing page: ${slug}`,
      consentText: REPLY_FINE_PRINT,
      consentTimestamp: new Date().toISOString(),
      honeypot: honey,
    });
    setSending(false);
    if (!result.ok) {
      setErr(result.error || "Something went wrong. Please call us directly.");
      return;
    }
    setSent(true);
  };

  if (sent) {
    return (
      <div className="bg-white rounded-2xl border border-[#dfe0dc] p-5 mt-4 text-center">
        <p className="text-[15px] font-extrabold text-[#073126] mb-2">✓ Inquiry sent</p>
        <p className="text-[12px] text-[#6b6f6a]">Aamir will reach out within 15 minutes during business hours.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-[#dfe0dc] p-5 mt-4">
      <h3 className="text-[14px] font-extrabold text-[#073126] mb-4">Request more information</h3>
      <div className="space-y-3">
        <div>
          <label className="block text-[12px] font-bold text-[#6b6f6a] uppercase tracking-wider mb-1">
            Your name <span className="text-red-500">*</span>
          </label>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2.5 text-[13px] border border-[#dfe0dc] rounded-lg text-[#073126] outline-none focus:border-[#00ff80]"
          />
        </div>
        <div>
          <label className="block text-[12px] font-bold text-[#6b6f6a] uppercase tracking-wider mb-1">
            Phone number <span className="text-red-500">*</span>
          </label>
          <input
            required
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="(647) 555-0000"
            className="w-full px-3 py-2.5 text-[13px] border border-[#dfe0dc] rounded-lg text-[#073126] outline-none focus:border-[#00ff80]"
          />
        </div>
        <div>
          <label className="block text-[12px] font-bold text-[#6b6f6a] uppercase tracking-wider mb-1">Email (optional)</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2.5 text-[13px] border border-[#dfe0dc] rounded-lg text-[#073126] outline-none focus:border-[#00ff80]"
          />
        </div>
        <div>
          <label className="block text-[12px] font-bold text-[#6b6f6a] uppercase tracking-wider mb-1">Message</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            className="w-full px-3 py-2.5 text-[13px] border border-[#dfe0dc] rounded-lg text-[#073126] outline-none focus:border-[#00ff80] resize-none"
          />
        </div>
      </div>
      {/* Honeypot. A person never sees it; a bot fills it and the row is silently dropped. */}
      <div style={HONEYPOT_WRAPPER_STYLE} aria-hidden="true">
        <label>
          Company website
          <input {...honeypotInputProps} type="text" value={honey} onChange={(e) => setHoney(e.target.value)} />
        </label>
      </div>
      {err && <p className="text-[12px] text-red-600 mt-3">{err}</p>}
      <button
        type="submit"
        disabled={sending}
        className="w-full mt-4 bg-[#00ff80] text-[#04160f] text-[13px] font-extrabold rounded-xl py-3 hover:bg-[#5cffa8] transition-colors disabled:opacity-60"
      >
        {sending ? "Sending…" : "Send inquiry"}
      </button>
      <p className="text-[11px] text-[#6b6f6a] mt-3 leading-snug">{REPLY_FINE_PRINT}</p>
    </form>
  );
}

"use client";

// The personal information removal form (MC-036, item 12). Three fields and the honeypot,
// posted as JSON to /api/privacy/request, which runs the lead layer's guards. Not a lead: it
// does not call postLead and it carries no consent text, because nobody is consenting to
// anything here; they are withdrawing. On success it shows the reference the desk email and
// the confirmation email both quote.

import { useState } from "react";
import { honeypotInputProps, HONEYPOT_WRAPPER_STYLE } from "@/lib/postLeadClient";

interface Props {
  /** The mailto fallback, shown when the route cannot record the request. */
  fallbackEmail: string;
}

const INPUT = "w-full px-3 py-2.5 text-[14px] border border-[#dfe0dc] rounded-lg text-[#073126] outline-none focus:border-[#017848] bg-white";
const LABEL = "block text-[12px] font-bold text-[#6b6f6a] uppercase tracking-wider mb-1";

export default function RequestForm({ fallbackEmail }: Props) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [details, setDetails] = useState("");
  const [honey, setHoney] = useState("");
  const [sending, setSending] = useState(false);
  const [reference, setReference] = useState<string | null | undefined>(undefined);
  const [err, setErr] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !details.trim()) {
      setErr("Your name, your email and what to remove are all needed.");
      return;
    }
    setErr("");
    setSending(true);
    try {
      const res = await fetch("/api/privacy/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, details, [honeypotInputProps.name]: honey }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; reference?: string | null; error?: string };
      if (!res.ok || data.ok === false) {
        setErr(data.error || `Something went wrong. Email ${fallbackEmail} and it will be handled by hand.`);
        return;
      }
      setReference(data.reference ?? null);
    } catch {
      setErr(`Something went wrong. Email ${fallbackEmail} and it will be handled by hand.`);
    } finally {
      setSending(false);
    }
  };

  if (reference !== undefined) {
    return (
      <div className="bg-[#f6f4ef] rounded-2xl border border-[#dfe0dc] p-6" role="status">
        <p className="text-[16px] font-extrabold text-[#073126] mb-2">Request received</p>
        {reference ? (
          <p className="text-[14px] text-[#292b29] leading-relaxed">
            Your reference is <span className="font-mono font-semibold text-[#073126]">{reference}</span>. A confirmation
            is on its way to {email.trim()}, and you will hear back at that address once the removal is done.
          </p>
        ) : (
          <p className="text-[14px] text-[#292b29] leading-relaxed">You will hear back at {email.trim()} once the removal is done.</p>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-[#dfe0dc] p-6">
      <div className="space-y-4">
        <div>
          <label htmlFor="pir-name" className={LABEL}>Your name</label>
          <input id="pir-name" required maxLength={120} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} className={INPUT} />
        </div>
        <div>
          <label htmlFor="pir-email" className={LABEL}>Your email</label>
          <input id="pir-email" required type="email" maxLength={254} autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={INPUT} />
          <p className="text-[12px] text-[#6b6f6a] mt-1">The address you gave us, so the record can be found, and the address the reply goes to.</p>
        </div>
        <div>
          <label htmlFor="pir-details" className={LABEL}>What to remove</label>
          <textarea
            id="pir-details"
            required
            maxLength={4000}
            rows={5}
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            placeholder="For example: the form I filled on a listing page, my street alert, my account, or everything you hold about me."
            className={`${INPUT} resize-y`}
          />
        </div>
      </div>
      {/* Honeypot. A person never sees it; a bot fills it and the request is silently dropped. */}
      <div style={HONEYPOT_WRAPPER_STYLE} aria-hidden="true">
        <label>
          Company website
          <input {...honeypotInputProps} type="text" value={honey} onChange={(e) => setHoney(e.target.value)} />
        </label>
      </div>
      {err && <p className="text-[13px] text-red-700 mt-3" role="alert">{err}</p>}
      <button
        type="submit"
        disabled={sending}
        className="w-full sm:w-auto mt-5 bg-[#073126] text-[#fffdfa] text-[14px] font-extrabold rounded-xl px-6 py-3 hover:bg-[#017848] transition-colors disabled:opacity-60"
      >
        {sending ? "Sending…" : "Send the request"}
      </button>
    </form>
  );
}

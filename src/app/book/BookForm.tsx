"use client";

// The booking page's form (ML-014). The same fields as the listing card's showing modal (name,
// phone, an optional email, a note), the same helper, the same guards, the same confirmation
// and desk alert. `ref` is the page the visitor came from, read from /book?ref= by the page and
// sent as the lead's landingPage; nothing else is derived from it.

import { useState } from "react";
import { postLeadDetailed, honeypotInputProps, HONEYPOT_WRAPPER_STYLE } from "@/lib/postLeadClient";
import { REPLY_FINE_PRINT } from "@/lib/lead/finePrint";
import { config } from "@/lib/config";

const FIRST_NAME = config.realtor.name.split(" ")[0];

export default function BookForm({ refPath }: { refPath: string | null }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [honey, setHoney] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  // Ten digits, with a leading country code 1 allowed and dropped, as the ingress normalises it.
  const digits = phone.replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (status === "sending") return;
    if (!name.trim() || digits.length !== 10) {
      setError(name.trim() ? "Please enter a 10-digit phone number." : "Please enter your name.");
      return;
    }
    setError(null);
    setStatus("sending");
    const result = await postLeadDetailed({
      source: "book-page",
      intent: "buy",
      name: name.trim(),
      phone: digits,
      email: email.trim() || undefined,
      // The visitor's own words go in `message` (the desk's SMS and alert print it), never `notes`,
      // which the surfaces use for their own labels.
      message: notes.trim() || undefined,
      ref: refPath ?? undefined,
      honeypot: honey,
      consentText: REPLY_FINE_PRINT,
      consentTimestamp: new Date().toISOString(),
    });
    if (!result.ok) {
      setStatus("idle");
      setError(result.error || "Could not send. Please try again, or call.");
      return;
    }
    setStatus("sent");
  };

  if (status === "sent") {
    return (
      <div className="rounded-2xl border border-[#dfe0dc] bg-white p-6" data-book-sent>
        <p className="text-[16px] font-extrabold text-[#073126] mb-2">✓ Request received</p>
        <p className="text-[14px] text-[#292b29] leading-relaxed">
          {FIRST_NAME} confirms a time by phone during business hours. If it is faster, call{" "}
          <a href={`tel:${config.realtor.phoneE164}`} className="font-bold text-[#017848]">{config.realtor.phone}</a>.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border border-[#dfe0dc] bg-white p-6 space-y-4" noValidate>
      <label className="block">
        <span className="block text-[12px] font-bold text-[#073126] mb-1">Your name</span>
        <input
          name="name"
          autoComplete="name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          className="w-full rounded-lg border border-[#dfe0dc] px-3 py-3 text-[15px] text-[#073126] outline-none focus:border-[#017848]"
        />
      </label>
      <label className="block">
        <span className="block text-[12px] font-bold text-[#073126] mb-1">Mobile number</span>
        <input
          name="phone"
          type="tel"
          inputMode="numeric"
          autoComplete="tel"
          required
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="647-839-9090"
          className="w-full rounded-lg border border-[#dfe0dc] px-3 py-3 text-[15px] text-[#073126] outline-none focus:border-[#017848]"
        />
      </label>
      <label className="block">
        <span className="block text-[12px] font-bold text-[#073126] mb-1">Email <span className="font-normal text-[#6b6f6a]">(optional)</span></span>
        <input
          name="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@email.com"
          className="w-full rounded-lg border border-[#dfe0dc] px-3 py-3 text-[15px] text-[#073126] outline-none focus:border-[#017848]"
        />
      </label>
      <label className="block">
        <span className="block text-[12px] font-bold text-[#073126] mb-1">Which home, and when? <span className="font-normal text-[#6b6f6a]">(optional)</span></span>
        <textarea
          name="message"
          rows={3}
          maxLength={1000}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="The address or the MLS number, and a day that suits you"
          className="w-full rounded-lg border border-[#dfe0dc] px-3 py-3 text-[15px] text-[#073126] outline-none focus:border-[#017848]"
        />
      </label>
      {/* Honeypot. A person never sees it; a bot fills it and the row is silently dropped. */}
      <div style={HONEYPOT_WRAPPER_STYLE} aria-hidden="true">
        <label>
          Company website
          <input {...honeypotInputProps} type="text" value={honey} onChange={(e) => setHoney(e.target.value)} />
        </label>
      </div>
      {error && <p className="text-[13px] font-semibold text-[#b42318]" role="alert">{error}</p>}
      <button
        type="submit"
        disabled={status === "sending"}
        className="min-h-[48px] w-full rounded-lg bg-[#00ff80] px-4 py-3 text-[15px] font-extrabold text-[#073126] disabled:opacity-60"
      >
        {status === "sending" ? "Sending…" : "Request a showing"}
      </button>
      <p className="text-center text-[13px] font-semibold text-[#073126]">{FIRST_NAME} confirms within the hour · no obligation</p>
      <p className="text-[12px] leading-relaxed text-[#6b6f6a]">{REPLY_FINE_PRINT}</p>
    </form>
  );
}

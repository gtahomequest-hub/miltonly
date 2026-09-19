"use client";

// The sign-in form (MP-002). One field, then one code.
//
// It carries `redirect` (or the older `next`) from the URL into both requests, so the email's
// link and the typed code land the person on the page they left: the street's sold records,
// the listing they tried to save. The server decides whether the path is safe; the form only
// passes it along.
//
// The honeypot is the lead layer's field, rendered off-screen and left empty. The consent
// sentence under the button is the one the acknowledgement card records; here it is shown at
// the point of collection, which is where PIPEDA wants it read.

import { useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { honeypotInputProps, HONEYPOT_WRAPPER_STYLE } from "@/lib/postLeadClient";
import { PORTAL_CONSENT_TEXT } from "@/lib/portal/consent";

type Step = "email" | "code";

export default function SignInForm() {
  const params = useSearchParams();
  const redirect = params.get("redirect") || params.get("next") || "";
  const soldIntent = params.get("intent") === "sold";

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [honey, setHoney] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const requestCode = async () => {
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, redirect, ...(honey ? { [honeypotInputProps.name]: honey } : {}) }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong");
        return false;
      }
      setMessage(data.message);
      return true;
    } catch {
      setError("Something went wrong");
      return false;
    } finally {
      setLoading(false);
    }
  };

  const handleSendCode = async (e: FormEvent) => {
    e.preventDefault();
    if (await requestCode()) setStep("code");
  };

  const handleVerify = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code, redirect }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "That code is not right.");
        return;
      }
      // A full navigation, not a client push: the page that gated the records is server
      // rendered against the cookie, and the cookie was just set.
      window.location.assign(data.redirect || "/saved");
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  // No street name here: resolveStreetName is the only source of a name on any surface, and
  // the URL carries a slug. The sentence says why the wall exists and nothing about the street.
  const streetLine = soldIntent
    ? "Sold and leased prices are shown to registered consumers under TRREB's VOW rules. One sign-in, then every street."
    : null;

  return (
    <div className="bg-white rounded-2xl border border-[#dfe0dc] p-7 sm:p-8 shadow-sm">
      {step === "email" ? (
        <form onSubmit={handleSendCode} className="space-y-4" noValidate>
          {streetLine && <p className="text-[13px] text-[#4b5563] leading-relaxed">{streetLine}</p>}
          <div>
            <label htmlFor="signin-email" className="block text-[12px] font-bold text-[#292b29] mb-1.5">
              Email
            </label>
            <input
              id="signin-email"
              type="email"
              required
              autoComplete="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@email.com"
              className="w-full border border-[#dfe0dc] rounded-lg px-4 py-3 text-[16px] outline-none focus:border-[#017848] transition-colors"
              autoFocus
            />
          </div>
          <div style={HONEYPOT_WRAPPER_STYLE} aria-hidden="true">
            <label>
              Website
              <input {...honeypotInputProps} type="text" value={honey} onChange={(e) => setHoney(e.target.value)} />
            </label>
          </div>
          {error && <p className="text-[12px] text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading || !email}
            className="w-full bg-[#017848] text-white text-[14px] font-bold py-3.5 rounded-xl hover:bg-[#0a8f57] transition-colors disabled:opacity-50"
          >
            {loading ? "Sending…" : "Email me a sign-in link"}
          </button>
          <p className="text-[12px] text-[#6b6f6a] text-center">No password. The email carries a link and a 6-digit code.</p>
          <p className="text-[11px] text-[#6b6f6a] leading-relaxed border-t border-[#efeee9] pt-3">{PORTAL_CONSENT_TEXT}</p>
        </form>
      ) : (
        <form onSubmit={handleVerify} className="space-y-4">
          <div className="text-center mb-2">
            <p className="text-[14px] font-semibold text-[#073126]">Sent to {email}</p>
            <p className="text-[13px] text-[#6b6f6a] mt-1">{message || "Tap the link in the email, or type the code here."}</p>
          </div>
          <div>
            <label htmlFor="signin-code" className="block text-[12px] font-bold text-[#292b29] mb-1.5">
              6-digit code
            </label>
            <input
              id="signin-code"
              type="text"
              required
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="123456"
              className="w-full border border-[#dfe0dc] rounded-lg px-4 py-3 text-[22px] font-bold text-center tracking-[6px] outline-none focus:border-[#017848] transition-colors"
              autoFocus
            />
          </div>
          {error && <p className="text-[12px] text-red-600 text-center">{error}</p>}
          <button
            type="submit"
            disabled={loading || code.length < 6}
            className="w-full bg-[#017848] text-white text-[14px] font-bold py-3.5 rounded-xl hover:bg-[#0a8f57] transition-colors disabled:opacity-50"
          >
            {loading ? "Checking…" : "Sign in"}
          </button>
          <div className="flex justify-between items-center">
            <button type="button" onClick={() => { setStep("email"); setCode(""); setError(""); }} className="text-[12px] text-[#6b6f6a] hover:text-[#073126]">
              Change email
            </button>
            <button type="button" onClick={requestCode} disabled={loading} className="text-[12px] text-[#017848] font-semibold hover:underline disabled:opacity-50">
              Send a new one
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

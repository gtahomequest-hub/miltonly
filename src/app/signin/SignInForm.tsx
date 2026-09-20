"use client";

// The sign-in form (MP-002, MP-002b). Email, then password; the emailed link or code as the
// fallback.
//
// Three steps. "email": one field. "password": the returning sign-in (R-805(c): the email is
// the username), with "Email me a link instead" for a first visit, a forgotten password, or a
// password not yet set. "code": the link has been sent and the 6-digit code can be typed here.
// Either way the person lands where they started (`redirect`, or the older `next`, passed
// through both requests; the server decides whether the path is safe). A session that came in
// by link still meets the card, which asks for the password before any record shows.
//
// The honeypot is the lead layer's field, rendered off-screen and left empty. The consent
// sentence under the button is the one the acknowledgement card records; here it is shown at
// the point of collection, which is where PIPEDA wants it read.

import { useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { honeypotInputProps, HONEYPOT_WRAPPER_STYLE } from "@/lib/postLeadClient";
import { PORTAL_CONSENT_TEXT } from "@/lib/portal/consent";

type Step = "email" | "password" | "code";

const FIELD =
  "w-full border border-[#dfe0dc] rounded-lg px-4 py-3 text-[16px] outline-none focus:border-[#017848] transition-colors";
const BUTTON =
  "w-full bg-[#017848] text-white text-[14px] font-bold py-3.5 rounded-xl hover:bg-[#0a8f57] transition-colors disabled:opacity-50";

export default function SignInForm() {
  const params = useSearchParams();
  const redirect = params.get("redirect") || params.get("next") || "";
  const soldIntent = params.get("intent") === "sold";

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [honey, setHoney] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const land = (path: string | undefined) => {
    // A full navigation, not a client push: the page that gated the records is server
    // rendered against the cookie, and the cookie was just set.
    window.location.assign(path || "/saved");
  };

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

  const handleEmail = (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setStep("password");
  };

  const handlePassword = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, redirect }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "That email and password do not match.");
        return;
      }
      land(data.redirect);
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleLinkInstead = async () => {
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
      land(data.redirect);
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
      {step === "email" && (
        <form onSubmit={handleEmail} className="space-y-4" noValidate>
          {streetLine && <p className="text-[13px] text-[#4b5563] leading-relaxed">{streetLine}</p>}
          <div>
            <label htmlFor="signin-email" className="block text-[12px] font-bold text-[#292b29] mb-1.5">
              Email
            </label>
            <input
              id="signin-email"
              type="email"
              required
              autoComplete="username"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@email.com"
              className={FIELD}
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
          <button type="submit" disabled={loading || !email.includes("@")} className={BUTTON}>
            Continue
          </button>
          <p className="text-[12px] text-[#6b6f6a] text-center">Your email is your username. New here? We email you a link first.</p>
          <p className="text-[11px] text-[#6b6f6a] leading-relaxed border-t border-[#efeee9] pt-3">{PORTAL_CONSENT_TEXT}</p>
        </form>
      )}

      {step === "password" && (
        <form onSubmit={handlePassword} className="space-y-4">
          <div className="text-center mb-2">
            <p className="text-[14px] font-semibold text-[#073126]">{email}</p>
            <button type="button" onClick={() => { setStep("email"); setPassword(""); setError(""); }} className="text-[12px] text-[#6b6f6a] hover:text-[#073126]">
              Change email
            </button>
          </div>
          <div>
            <label htmlFor="signin-password" className="block text-[12px] font-bold text-[#292b29] mb-1.5">
              Password
            </label>
            <input
              id="signin-password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Your password"
              className={FIELD}
              autoFocus
            />
          </div>
          {error && <p className="text-[12px] text-red-600">{error}</p>}
          <button type="submit" disabled={loading || !password} className={BUTTON}>
            {loading ? "Checking…" : "Sign in"}
          </button>
          <button
            type="button"
            id="signin-link-instead"
            onClick={handleLinkInstead}
            disabled={loading}
            className="w-full border border-[#dfe0dc] text-[#073126] text-[14px] font-bold py-3.5 rounded-xl hover:border-[#017848] transition-colors disabled:opacity-50"
          >
            Email me a link instead
          </button>
          <p className="text-[12px] text-[#6b6f6a] text-center">First time, or forgot your password? The link signs you in and asks you to set one.</p>
        </form>
      )}

      {step === "code" && (
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
          <button type="submit" disabled={loading || code.length < 6} className={BUTTON}>
            {loading ? "Checking…" : "Sign in"}
          </button>
          <div className="flex justify-between items-center">
            <button type="button" onClick={() => { setStep("password"); setCode(""); setError(""); }} className="text-[12px] text-[#6b6f6a] hover:text-[#073126]">
              Use my password
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

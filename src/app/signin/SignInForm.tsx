"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/components/UserProvider";

type Step = "email" | "code";

export default function SignInForm() {
  const router = useRouter();
  const { refresh } = useUser();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, firstName }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong");
        return;
      }
      setMessage(data.message);
      setStep("code");
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Invalid code");
        return;
      }
      await refresh();
      router.push("/saved");
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (res.ok) setMessage("New code sent!");
      else setError(data.error || "Could not resend");
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-[#e2e8f0] p-8 shadow-sm">
      {step === "email" ? (
        <form onSubmit={handleSendCode} className="space-y-4">
          <div>
            <label className="block text-[12px] font-bold text-[#374151] mb-1.5">First name</label>
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="Your first name"
              className="w-full border border-[#e2e8f0] rounded-lg px-4 py-3 text-[14px] outline-none focus:border-[#f59e0b] transition-colors"
            />
          </div>
          <div>
            <label className="block text-[12px] font-bold text-[#374151] mb-1.5">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@email.com"
              className="w-full border border-[#e2e8f0] rounded-lg px-4 py-3 text-[14px] outline-none focus:border-[#f59e0b] transition-colors"
            />
          </div>
          {error && <p className="text-[12px] text-red-500">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#07111f] text-[#f59e0b] text-[14px] font-bold py-3.5 rounded-xl hover:bg-[#0c1e35] transition-colors disabled:opacity-50"
          >
            {loading ? "Sending..." : "Continue with email"}
          </button>
          <p className="text-[11px] text-[#94a3b8] text-center">
            We&apos;ll email you a 6-digit code — no password needed
          </p>
        </form>
      ) : (
        <form onSubmit={handleVerify} className="space-y-4">
          <div className="text-center mb-2">
            <p className="text-[13px] text-[#64748b]">{message || `Code sent to ${email}`}</p>
          </div>
          <div>
            <label className="block text-[12px] font-bold text-[#374151] mb-1.5">Verification code</label>
            <input
              type="text"
              required
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="123456"
              className="w-full border border-[#e2e8f0] rounded-lg px-4 py-3 text-[22px] font-bold text-center tracking-[6px] outline-none focus:border-[#f59e0b] transition-colors"
              autoFocus
            />
          </div>
          {error && <p className="text-[12px] text-red-500 text-center">{error}</p>}
          <button
            type="submit"
            disabled={loading || code.length < 6}
            className="w-full bg-[#07111f] text-[#f59e0b] text-[14px] font-bold py-3.5 rounded-xl hover:bg-[#0c1e35] transition-colors disabled:opacity-50"
          >
            {loading ? "Verifying..." : "Verify & sign in"}
          </button>
          <div className="flex justify-between items-center">
            <button type="button" onClick={() => setStep("email")} className="text-[12px] text-[#64748b] hover:text-[#07111f]">
              ← Change email
            </button>
            <button type="button" onClick={handleResend} disabled={loading} className="text-[12px] text-[#f59e0b] font-semibold hover:underline disabled:opacity-50">
              Resend code
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

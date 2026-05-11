"use client";
import { useState } from "react";
import { config } from "@/lib/config";
import { attributionPayload } from "@/lib/attribution";

export default function OffMarketForm() {
  const [propertyType, setPropertyType] = useState("");
  const [budget, setBudget] = useState("");
  const [bedrooms, setBedrooms] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const labelCls = "text-[12px] font-bold text-[#94a3b8] uppercase tracking-wider mb-1.5 sm:mb-0 sm:w-[40%] sm:flex sm:items-center";
  const fieldCls = "bg-[#07111f] border border-[#1e3a5f] text-[#f8f9fb] rounded-lg px-3 py-2.5 text-[14px] focus:border-[#f59e0b] focus:outline-none w-full sm:w-[60%]";
  const rowCls = "flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 mb-3";

  const formatPhone = (v: string) => {
    const digits = v.replace(/\D/g, "").slice(0, 10);
    if (digits.length < 4) return digits;
    if (digits.length < 7) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const phoneDigits = phone.replace(/\D/g, "");
    if (!propertyType || !budget || !bedrooms) {
      setError("Please fill all fields.");
      return;
    }
    if (phoneDigits.length !== 10) {
      setError("Please enter a valid 10-digit phone number.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/off-market-leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ propertyType, budget, bedrooms, phone: phoneDigits, source: "homepage-exclusive", ...attributionPayload() }),
      });
      if (!res.ok) throw new Error("Request failed");
      setSuccess(true);
    } catch {
      setError(`Something went wrong. Please call ${config.realtor.phone}.`);
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div id="off-market-form" className="bg-[#0c1e35] border border-[#1e3a5f] rounded-xl p-6 sm:p-7">
        <p className="text-[24px] mb-2">✅</p>
        <p className="text-[18px] font-extrabold text-[#f8f9fb] mb-2">You&apos;re on the list</p>
        <p className="text-[13px] text-[#94a3b8] leading-relaxed mb-4">
          We&apos;ll text {phone} the moment a {propertyType.toLowerCase()} in {budget} with {bedrooms} hits Aamir&apos;s pipeline.
        </p>
        <a href={`tel:${config.realtor.phoneE164}`} className="inline-block text-[13px] font-bold text-[#f59e0b] hover:underline">
          Want to talk now? Call {config.realtor.phone}
        </a>
      </div>
    );
  }

  return (
    <form id="off-market-form" onSubmit={handleSubmit} className="bg-[#0c1e35] border border-[#1e3a5f] rounded-xl p-6 sm:p-7">
      <p className="text-[20px] font-extrabold text-[#f8f9fb] mb-2">Get first access to {config.CITY_NAME} off-market homes</p>
      <p className="text-[13px] text-[#94a3b8] mb-5 leading-relaxed">
        Tell us what you&apos;re looking for. We text you when a match comes up — usually 1–3 weeks before MLS.
      </p>

      <div className={rowCls}>
        <label className={labelCls} htmlFor="om-type">Property type</label>
        <select id="om-type" value={propertyType} onChange={(e) => setPropertyType(e.target.value)} className={fieldCls}>
          <option value="">Select…</option>
          <option>Detached</option>
          <option>Semi-detached</option>
          <option>Townhouse</option>
          <option>Condo</option>
          <option>Any</option>
        </select>
      </div>

      <div className={rowCls}>
        <label className={labelCls} htmlFor="om-budget">Budget range</label>
        <select id="om-budget" value={budget} onChange={(e) => setBudget(e.target.value)} className={fieldCls}>
          <option value="">Select…</option>
          <option>Under $700K</option>
          <option>$700K – $900K</option>
          <option>$900K – $1.2M</option>
          <option>$1.2M – $1.5M</option>
          <option>$1.5M – $2M</option>
          <option>$2M+</option>
        </select>
      </div>

      <div className={rowCls}>
        <label className={labelCls} htmlFor="om-beds">Bedrooms</label>
        <select id="om-beds" value={bedrooms} onChange={(e) => setBedrooms(e.target.value)} className={fieldCls}>
          <option value="">Select…</option>
          <option>1+</option>
          <option>2+</option>
          <option>3+</option>
          <option>4+</option>
          <option>5+</option>
        </select>
      </div>

      <div className={rowCls}>
        <label className={labelCls} htmlFor="om-phone">Mobile (we text)</label>
        <input
          id="om-phone"
          type="tel"
          inputMode="tel"
          value={phone}
          onChange={(e) => setPhone(formatPhone(e.target.value))}
          placeholder="(___) ___-____"
          className={fieldCls}
          autoComplete="tel"
        />
      </div>

      {error && <p className="text-[12px] text-[#ef4444] mb-3">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="mt-2 w-full bg-[#f59e0b] text-[#07111f] text-[14px] font-extrabold py-3 rounded-xl hover:bg-[#fbbf24] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {submitting ? "Submitting…" : "🔔 Notify me of off-market matches →"}
      </button>

      <p className="mt-3 text-[11px] text-[#64748b] text-center">
        No spam. Avg 1–2 texts/month. Unsubscribe anytime.
      </p>
    </form>
  );
}

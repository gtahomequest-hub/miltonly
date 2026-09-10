"use client";

// Unlock modal — triggered from any locked listing card in the 3+9 grid.
// Shared form across all 9 locked cards (one modal, not nine inline forms).
// Reaches the same one ingress as the hero form but tags the lead
// with `source: "ads-rentals-lp-modal"` so analytics can split conversions
// by which form drove them.

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { postLeadDetailed, honeypotInputProps } from "@/lib/postLeadClient";
import { config } from "@/lib/config";

const REALTOR_FIRST_NAME = config.realtor.name.split(" ")[0];
const BROKERAGE_SHORT_NAME = config.brokerage.name.replace(", Brokerage", "");
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const BUDGET_OPTIONS = [
  { val: "2500", label: "Under $2,500" },
  { val: "3500", label: "$2,500 – $3,500" },
  { val: "4500", label: "$3,500 – $4,500" },
  { val: "6000", label: "$4,500+" },
];

function formatPhone(v: string): string {
  const digits = v.replace(/\D/g, "").slice(0, 10);
  if (digits.length < 4) return digits;
  if (digits.length < 7) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  initialType: string;
}

export default function UnlockModal({ isOpen, onClose, initialType }: Props) {
  const router = useRouter();

  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [budget, setBudget] = useState<string>("");
  const [honey, setHoney] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // THE PER-SURFACE UTM READ IS GONE. Every one of these forms kept its own copy of
  // "read the six params off the URL", and each copy only saw the URL the visitor happened to
  // land on last. src/components/AttributionCapture.tsx runs in the root layout and persists
  // first-touch and last-touch across the whole session, and the client helper sends both, so
  // the surface no longer has an attribution job.

  // Close on ESC, lock body scroll while open.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const phoneDigits = phone.replace(/\D/g, "");
    const trimmedEmail = email.trim();

    if (phoneDigits.length !== 10) {
      setError("Please enter a 10-digit phone number.");
      return;
    }
    if (!trimmedEmail || !EMAIL_RE.test(trimmedEmail)) {
      setError("Please enter a valid email address.");
      return;
    }
    if (!budget) {
      setError("Please select your budget.");
      return;
    }

    setSubmitting(true);

    if (typeof window !== "undefined") {
      const w = window as unknown as { gtag?: (...a: unknown[]) => void };
      if (w.gtag) w.gtag("event", "form_submit", { source: "rentals/ads", form: "unlock-modal" });
    }

    // Distinct source tag so DB analytics can split modal from hero-form conversions. The
    // thank-you path is built here rather than returned by the route: the surface knows which
    // funnel it is, and the route no longer has a per-branch redirect to hand back.
    const result = await postLeadDetailed({
      source: "ads-rentals-lp-modal",
      intent: "rent",
      name: `Lead ${phoneDigits.slice(-4)}`,
      phone: phone.trim(),
      email: trimmedEmail,
      budget,
      homeType: initialType || "any",
      honeypot: honey,
    });
    if (!result.ok) {
      setError(result.error || `Couldn't submit. Please try again or call ${config.realtor.phone}.`);
      setSubmitting(false);
      return;
    }
    router.push(`/rentals/thank-you?lid=${result.leadId ?? ""}`);
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-0 md:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="unlock-modal-title"
      onClick={(e) => {
        // Click on backdrop (not on the card itself) closes the modal.
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full md:max-w-[520px] md:rounded-2xl bg-white text-[#07111f] shadow-2xl md:max-h-[90vh] overflow-y-auto h-full md:h-auto">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3 right-3 z-10 w-10 h-10 inline-flex items-center justify-center rounded-full text-[#64748b] hover:text-[#07111f] hover:bg-[#f8f9fb] text-[20px] font-bold"
        >
          ×
        </button>

        <form onSubmit={handleSubmit} className="p-5 sm:p-7 pt-12 sm:pt-8" noValidate>
          <h2 id="unlock-modal-title" className="text-[22px] sm:text-[24px] font-extrabold leading-tight mb-1.5">
            {REALTOR_FIRST_NAME}&apos;s matching you right now.
          </h2>
          <p className="text-[13px] sm:text-[14px] text-[#64748b] mb-4">
            Tell {REALTOR_FIRST_NAME} what you need. He&apos;ll text 3–5 hand-picked {config.CITY_NAME} rentals within the hour.
          </p>

          {/* Phone + Email side-by-side on sm+ */}
          <div className="grid sm:grid-cols-2 gap-2 sm:gap-3 mb-3">
            <div>
              <label htmlFor="unlock-phone" className="block text-[11px] font-bold uppercase tracking-wider text-[#64748b] mb-1">
                Mobile number
              </label>
              <input
                id="unlock-phone"
                type="tel"
                inputMode="tel"
                required
                value={phone}
                onChange={(e) => setPhone(formatPhone(e.target.value))}
                placeholder="(647) 555-0123"
                autoComplete="tel"
                className="w-full h-12 px-4 rounded-lg border border-[#e2e8f0] bg-white text-[16px] focus:outline-none focus:border-[#f59e0b] focus:ring-2 focus:ring-[#f59e0b]/20"
              />
            </div>
            <div>
              <label htmlFor="unlock-email" className="block text-[11px] font-bold uppercase tracking-wider text-[#64748b] mb-1">
                Email
              </label>
              <input
                id="unlock-email"
                type="email"
                inputMode="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                autoComplete="email"
                className="w-full h-12 px-4 rounded-lg border border-[#e2e8f0] bg-white text-[16px] focus:outline-none focus:border-[#f59e0b] focus:ring-2 focus:ring-[#f59e0b]/20"
              />
            </div>
          </div>

          <label className="block text-[11px] font-bold uppercase tracking-wider text-[#64748b] mb-1">
            Monthly budget
          </label>
          <div className="grid grid-cols-2 gap-2 mb-4">
            {BUDGET_OPTIONS.map((o) => (
              <button
                key={o.val}
                type="button"
                onClick={() => setBudget(o.val)}
                className={`h-12 rounded-lg text-[13px] sm:text-[14px] font-semibold border transition-all ${
                  budget === o.val
                    ? "bg-[#07111f] text-white border-[#07111f]"
                    : "bg-white text-[#374151] border-[#e2e8f0] hover:border-[#94a3b8]"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>

          <div style={{ position: "absolute", left: "-10000px", top: "-10000px" }} aria-hidden="true">
            <label>
              Company website
              <input
                {...honeypotInputProps}
                type="text"
                value={honey}
                onChange={(e) => setHoney(e.target.value)}
              />
            </label>
          </div>

          {error && (
            <div className="text-[13px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full min-h-[52px] bg-[#f59e0b] hover:bg-[#fbbf24] disabled:opacity-60 disabled:cursor-not-allowed text-[#07111f] font-extrabold text-[15px] sm:text-[16px] rounded-xl transition-all shadow-lg shadow-[#f59e0b]/20 hover:shadow-xl active:scale-[0.99]"
          >
            {submitting ? "Sending…" : "Text me my matches"}
          </button>
          <p className="text-[11px] text-[#64748b] text-center mt-2.5 leading-relaxed">
            🔒 No spam. No fees. By submitting, I consent to receive SMS and email from {config.realtor.name}, {BROKERAGE_SHORT_NAME}. Reply STOP to opt out.{" "}
            <Link href="/privacy" className="underline hover:text-[#07111f]" target="_blank">Privacy</Link>.
          </p>
        </form>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { attributionPayload } from "@/lib/attribution";
import { config } from "@/lib/config";

const REALTOR_FIRST_NAME = config.realtor.name.split(" ")[0];
const HONEYPOT_FIELD = "company_website";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MESSAGE_SOURCE = "sales-rentals-featured-message";

// Format-as-you-type North American 10-digit phone mask. Same rule as
// LeadCaptureForm so client-side validation is consistent across the page.
function formatPhone(v: string): string {
  const digits = v.replace(/\D/g, "").slice(0, 10);
  if (digits.length < 4) return digits;
  if (digits.length < 7) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

type GtagFn = (...a: unknown[]) => void;
function getGtag(): GtagFn | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { gtag?: GtagFn };
  return w.gtag || null;
}

export interface AamirTrustCardProps {
  /** Address line 1 of the listing (e.g. "15 Munch Place"). Used to auto-generate
   *  the message box placeholder + the Text/WhatsApp pre-filled body. */
  listingAddress: string;
  /** MLS number — passed through to the message lead POST body so the
   *  realtor email + SMS can link the message to the listing. */
  mlsNumber: string;
  /** Optional className for the outer wrapper. */
  className?: string;
}

export default function AamirTrustCard({
  listingAddress,
  mlsNumber,
  className = "",
}: AamirTrustCardProps) {
  const placeholder = `Hi ${REALTOR_FIRST_NAME}, I'm interested in ${listingAddress}. Is it still available, and when can I view it?`;

  const [messageText, setMessageText] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Effective message — uses the placeholder when the textarea is empty so
  // the visitor never sends a blank request and so Aamir reads something
  // contextual even on cold first-touch.
  const effectiveMessage = messageText.trim().length > 0 ? messageText.trim() : placeholder;

  function onSendClick() {
    const gtag = getGtag();
    if (gtag) gtag('event', 'message_modal_opened', { listing_mls: mlsNumber });
    setModalOpen(true);
  }

  return (
    <div
      className={`bg-[#0a1628] border border-[#1e3a5f] rounded-[14px] p-[20px] text-white ${className}`}
    >
      <div className="text-[10px] font-medium tracking-[1.4px] uppercase text-[#f59e0b] mb-[14px]">
        Your {config.CITY_NAME} Realtor
      </div>

      {/* Avatar + name */}
      <div className="flex items-center gap-3 mb-4">
        <div
          aria-hidden
          className="shrink-0 w-[52px] h-[52px] rounded-full bg-gradient-to-br from-[#1e3a5f] to-[#2d4f7c] border border-[#f59e0b]/40 flex items-center justify-center text-[#fbbf24] text-[17px] font-medium"
        >
          AY
        </div>
        <div className="min-w-0">
          <div className="text-[15px] font-medium tracking-tight text-white leading-tight">
            {config.realtor.name}
          </div>
          <div className="text-[11px] text-[#94a3b8] mt-[2px]">
            RE/MAX Hall of Fame · REALTOR<sup>&reg;</sup>
          </div>
        </div>
      </div>

      {/* Stats row — 1px navy gap created by the outer bg showing through */}
      <div className="grid grid-cols-3 gap-px bg-[#1e3a5f] rounded-[8px] overflow-hidden mb-4">
        <Stat number={String(config.realtor.yearsExperience)} label="Years" />
        <Stat number="150+" label="Families" />
        <Stat number="$55M+" label="Closed" />
      </div>

      {/* Credentials pills */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        <CredentialPill icon="🏆">Hall of Fame</CredentialPill>
        <CredentialPill icon="📍">{config.CITY_NAME} specialist</CredentialPill>
        <CredentialPill icon="🕐">{config.sla.short}</CredentialPill>
      </div>

      {/* Message box OR confirmation banner */}
      {submitted ? (
        <div className="bg-[#16a34a]/10 border border-[#16a34a]/40 rounded-[10px] p-[14px] flex items-start gap-2 mb-4">
          <Check className="w-4 h-4 text-[#86efac] mt-0.5 shrink-0" aria-hidden />
          <div>
            <div className="text-[13px] font-semibold text-[#86efac] leading-snug">
              Message sent.
            </div>
            <div className="text-[12px] text-[#86efac]/80 mt-0.5">
              {REALTOR_FIRST_NAME} replies within 60 minutes.
            </div>
          </div>
        </div>
      ) : (
        <div className="mb-4">
          <div className="text-[12px] font-semibold text-[#cbd5e1] mb-2">
            Send {REALTOR_FIRST_NAME} a message
          </div>
          <div className="bg-[#07111f] border border-[#1e3a5f] hover:border-[#f59e0b]/40 transition-colors rounded-[10px] p-3">
            <textarea
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder={placeholder}
              rows={3}
              className="w-full min-h-[60px] resize-none bg-transparent text-[12px] text-[#cbd5e1] placeholder:text-[#64748b] placeholder:leading-[1.55] focus:outline-none"
              aria-label={`Message ${REALTOR_FIRST_NAME}`}
            />
            <div className="mt-2 pt-2 border-t border-[#1e3a5f] flex items-center justify-between gap-3">
              <span className="text-[9px] text-[#64748b] tracking-[0.3px] uppercase font-medium">
                {config.sla.short}
              </span>
              <button
                type="button"
                onClick={onSendClick}
                className="h-[32px] px-[14px] rounded-[6px] bg-[#f59e0b] hover:bg-[#fbbf24] text-[#07111f] text-[11px] font-medium transition-colors"
              >
                Send →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* The "— or reach out another way —" divider + the 3-button
          (Text/WhatsApp/Call) grid was removed here. Header CTAs already
          fire click_text_header and click_call_header on every page; the
          duplicate row was both visual noise on a vertical card AND a
          height contributor to the right-column overhang that left the
          left column dead-space at the bottom. WhatsApp had its only
          surface here — accepted loss, to be re-added as a deliberate
          primary placement when analytics shows demand. The textarea
          flow above remains the trust card's primary conversion path. */}

      {modalOpen && (
        <MessageCaptureModal
          messagePreview={effectiveMessage}
          mlsNumber={mlsNumber}
          source={MESSAGE_SOURCE}
          onClose={() => setModalOpen(false)}
          onSuccess={() => {
            const gtag = getGtag();
            if (gtag) gtag('event', 'message_sent_success', { listing_mls: mlsNumber });
            setSubmitted(true);
            setModalOpen(false);
          }}
        />
      )}
    </div>
  );
}

function Stat({ number, label }: { number: string; label: string }) {
  return (
    <div className="bg-[#0a1628] py-[10px] px-[6px] text-center">
      <div className="text-[14px] font-medium text-[#fbbf24] leading-none">{number}</div>
      <div className="text-[9px] uppercase tracking-[0.6px] text-[#94a3b8] font-medium mt-[2px]">
        {label}
      </div>
    </div>
  );
}

function CredentialPill({ icon, children }: { icon: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 bg-[#0c1e35] border border-[#1e3a5f] text-[#cbd5e1] text-[10px] font-medium px-[9px] py-[4px] rounded-full">
      <span aria-hidden>{icon}</span>
      {children}
    </span>
  );
}

interface MessageCaptureModalProps {
  isOpen?: boolean;
  onClose: () => void;
  messagePreview: string;
  mlsNumber: string;
  source: string;
  onSuccess: () => void;
}

function MessageCaptureModal({
  onClose,
  messagePreview,
  mlsNumber,
  source,
  onSuccess,
}: MessageCaptureModalProps) {
  const searchParams = useSearchParams();
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [honey, setHoney] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const phoneInputRef = useRef<HTMLInputElement | null>(null);

  // Capture tracking on mount + Esc-to-close.
  const tracking = useMemo(
    () => ({
      utm_source: searchParams.get("utm_source") || "",
      utm_medium: searchParams.get("utm_medium") || "",
      utm_campaign: searchParams.get("utm_campaign") || "",
      utm_term: searchParams.get("utm_term") || "",
      utm_content: searchParams.get("utm_content") || "",
      gclid: searchParams.get("gclid") || "",
    }),
    [searchParams],
  );

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    phoneInputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

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

    setSubmitting(true);

    const gtag = getGtag();
    if (gtag) gtag('event', 'message_modal_submitted', { listing_mls: mlsNumber });

    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: `Lead ${phoneDigits.slice(-4)}`,
          phone: phone.trim(),
          email: trimmedEmail,
          source,
          intent: "buyer",
          // Message-path leads are mid-browse — they haven't told us
          // pre-approval status or hard timeline. Default to the least
          // committal values so the buyer branch validators accept the
          // payload without inflating the score.
          timeline: "browsing",
          preApproved: "no",
          mlsNumber,
          message: messagePreview,
          utm_source: tracking.utm_source,
          utm_medium: tracking.utm_medium,
          utm_campaign: tracking.utm_campaign,
          utm_term: tracking.utm_term,
          utm_content: tracking.utm_content,
          gclid: tracking.gclid,
          ...attributionPayload(),
          [HONEYPOT_FIELD]: honey,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; id?: string };
      if (!res.ok) {
        setError(`Could not send. Please call ${config.realtor.phone} directly.`);
        setSubmitting(false);
        return;
      }

      // GA4 conversion event — fires only after res.ok (audit F1.4).
      // Trust-card messages are warm leads asking specific questions, not
      // full-pipeline buyer leads — mid-value at $3K, between the
      // market-pulse research-stage ($2.5K) and the top-form direct-buyer
      // ($5K) tiers. intent is "buyer-question" for analytics segmentation
      // even though the DB lead row is persisted with intent="buyer" (the
      // GA event param is a tagging signal independent of the DB schema).
      const gtag = getGtag();
      if (gtag) {
        gtag('event', 'generate_lead', {
          transaction_id: typeof data?.id === "string" ? data.id : "",
          value: 3000,
          currency: "CAD",
          source: "sales-ads-trust-card-message",
          intent: "buyer-question",
          listing_mls: mlsNumber,
        });
      }

      // Success — let parent flip to confirmation. Stay on the page; no
      // /sales/thank-you redirect for message-path leads (intentional;
      // they're mid-browse and the inline banner is the better UX).
      onSuccess();
    } catch {
      setError(`Could not send. Please call ${config.realtor.phone} directly.`);
      setSubmitting(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Send a message to ${REALTOR_FIRST_NAME}`}
      className="fixed inset-0 z-[100] bg-[#07111f]/[0.62] backdrop-blur-[2px] flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-[290px] bg-white text-[#07111f] rounded-[16px] p-[22px] shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-[14px] right-[14px] w-6 h-6 rounded-full bg-[#f1f5f9] text-[#64748b] text-[14px] leading-none flex items-center justify-center hover:bg-[#e2e8f0] transition-colors"
        >
          ×
        </button>

        <div className="text-[9px] font-medium tracking-[1.4px] uppercase text-[#f59e0b] mb-[6px]">
          One quick step
        </div>
        <h3 className="text-[17px] font-medium tracking-tight leading-snug mb-[4px]">
          Where should {REALTOR_FIRST_NAME} reach you?
        </h3>
        <p className="text-[11px] text-[#64748b] mb-[14px] leading-snug">
          He&apos;ll text and email a reply within 60 minutes.
        </p>

        {/* Quoted message preview */}
        <div className="bg-[#f8fafc] border-l-[2px] border-[#f59e0b] p-[10px_12px] rounded-[0_6px_6px_0] text-[11px] text-[#475569] italic mb-[14px] max-h-[88px] overflow-y-auto leading-snug">
          &ldquo;{messagePreview}&rdquo;
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <input
            ref={phoneInputRef}
            type="tel"
            inputMode="tel"
            required
            value={phone}
            onChange={(e) => setPhone(formatPhone(e.target.value))}
            placeholder="(647) 555-0123"
            autoComplete="tel"
            className="w-full h-[42px] px-3 mb-2 rounded-[7px] border border-[#e2e8f0] text-[13px] focus:outline-none focus:border-[#07111f]"
          />
          <input
            type="email"
            inputMode="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@email.com"
            autoComplete="email"
            className="w-full h-[42px] px-3 mb-2 rounded-[7px] border border-[#e2e8f0] text-[13px] focus:outline-none focus:border-[#07111f]"
          />

          {/* Honeypot */}
          <div style={{ position: "absolute", left: "-10000px", top: "-10000px" }} aria-hidden="true">
            <label>
              Company website
              <input
                type="text"
                tabIndex={-1}
                autoComplete="off"
                name={HONEYPOT_FIELD}
                value={honey}
                onChange={(e) => setHoney(e.target.value)}
              />
            </label>
          </div>

          {error && (
            <div className="text-[12px] text-red-600 bg-red-50 border border-red-200 rounded-[6px] px-2.5 py-1.5 mb-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full h-[44px] rounded-[7px] bg-[#07111f] hover:bg-[#1e3a5f] disabled:opacity-60 text-white text-[13px] font-medium transition-colors"
          >
            {submitting ? "Sending…" : `Send to ${REALTOR_FIRST_NAME}`}
          </button>
        </form>

        <p className="text-[10px] text-[#94a3b8] text-center mt-[10px]">
          No spam. Reply STOP anytime.{" "}
          <Link href="/privacy" className="underline hover:text-[#07111f]" target="_blank">
            Privacy
          </Link>
          .
        </p>
        <p className="text-[10px] text-[#94a3b8] text-center mt-[6px]">
          {config.brokerage.name}
        </p>
      </div>
    </div>
  );
}

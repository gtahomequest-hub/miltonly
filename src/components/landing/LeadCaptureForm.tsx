"use client";

// THIS FORM WROTE TWO LEAD ROWS PER SUBMISSION.
//
// The PH3-DUALWRITE block below posted the same visitor to the create route a second time,
// which was harmless while that route wrote ads.leads. Phase 1 repointed it at public.Lead
// and the duplicate became a real one: two rows, two confirmation emails, two desk alerts,
// two CAPI events with different event_ids, for one person filling in one form. It is one
// write now. The Pixel still fires from here with an event_id the server echoes, which is
// what the dual write was actually for.

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { postLeadDetailed, honeypotInputProps } from "@/lib/postLeadClient";
import { config } from "@/lib/config";
import { generateEventId, readFbCookies, firePixelLead } from "@/lib/pixel-client";

const REALTOR_FIRST_NAME = config.realtor.name.split(" ")[0];

// Budget brackets (rental variant). The numeric `val` is read by
// src/lib/lead/fields.ts budgetToBand() into priceRangeMax. $4,500+ uses 6000 as the
// upper-cap proxy so Aamir's qualification has a meaningful number, not "any".
const BUDGET_OPTIONS = [
  { val: "2500", label: "Under $2,500" },
  { val: "3500", label: "$2,500 – $3,500" },
  { val: "4500", label: "$3,500 – $4,500" },
  { val: "6000", label: "$4,500+" },
];

// Buying timeline (sales variant). The `val` reaches Lead.timeline verbatim and is one of
// the two inputs the one scoring rule reads.
const TIMELINE_OPTIONS = [
  { val: "asap", label: "ASAP" },
  { val: "1-3months", label: "Next 1–3 months" },
  { val: "3-6months", label: "3–6 months" },
  { val: "browsing", label: "Just browsing" },
];

// Pre-approval status (sales variant).
const PRE_APPROVED_OPTIONS = [
  { val: "yes", label: "Yes, pre-approved" },
  { val: "no", label: "Not yet" },
];

// Email regex, the same shape as the server-side check. Belt and suspenders: the client
// catches typos, the ingest path still validates on POST.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Format-as-you-type North American 10-digit phone mask. Matches OffMarketForm.
function formatPhone(v: string): string {
  const digits = v.replace(/\D/g, "").slice(0, 10);
  if (digits.length < 4) return digits;
  if (digits.length < 7) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

export interface LeadCaptureFormProps {
  /** Form variant. Defaults to "rental" (preserves current behavior). */
  variant?: "rental" | "sales";
  /** The `source` carried onto the Lead row. Required. Lets parent pages tag the provenance. */
  source: string;
  /** Rental-variant only. The `homeType` token, mapped to Lead.propertyType. Defaults to "any". */
  homeType?: string;
  /** Optional callback fired after successful submission, BEFORE the router.push to thank-you. */
  onSuccess?: (data: { id?: string; redirect?: string }) => void;
  /** Optional className for outer form wrapper, defaults to "" — lets pages style positioning. */
  className?: string;
  /** Optional headline override. Defaults differ by variant. */
  headline?: string;
  /** Optional subheadline override. Defaults differ by variant. */
  subheadline?: string;
  /** Optional CTA button label. Defaults differ by variant. */
  ctaLabel?: string;
  /** Sales-variant passthrough. The MLS number of the listing the lead was viewing
   *  when they submitted. Forwarded as `mlsNumber` on the submission so
   *  the realtor email / SMS can reference the listing. No visual effect. */
  mlsNumber?: string;
  /** When true, the form's internal headline + subheadline are suppressed so
   *  the parent (e.g. the sales-page Polaroid booking band) can render its own
   *  unified header outside the form. Field grid + CTA button still render. */
  hideHeader?: boolean;
  /** Optional ID suffix to uniquely scope the form's element IDs when more
   *  than one LeadCaptureForm renders on the same page. Without it, the
   *  internal IDs (`lead-form`, `lead-phone`, `lead-email`) collide. Pass a
   *  short distinct token per instance — e.g. "top", "book", "modal". Default
   *  unsuffixed behavior preserves the existing rental page. */
  formId?: string;
  /** When true, the form drops its own white card chrome (`bg-white
   *  rounded-2xl shadow-2xl p-4 sm:p-6`) so the fields render flat onto
   *  whatever parent surface is already styled (e.g. the sales-page Polaroid
   *  white card). Internal field padding is preserved via a slimmer inner
   *  wrapper. Default false keeps the existing rental behavior. */
  chromeless?: boolean;
  /** GA4 generate_lead value (CAD). Defaults differ by variant: 5000 for
   *  sales (preserves the original buyer-side conversion value), 2000 for
   *  rental (the lease tenant-side economic value per Phase 1 spec). */
  leadValue?: number;
}

export default function LeadCaptureForm({
  variant = "rental",
  source,
  homeType = "any",
  onSuccess,
  className = "",
  headline,
  subheadline,
  ctaLabel,
  mlsNumber,
  hideHeader = false,
  formId,
  chromeless = false,
  leadValue,
}: LeadCaptureFormProps) {
  // Element-ID suffix so multiple LeadCaptureForm instances on one page don't
  // emit duplicate id="lead-form|lead-phone|lead-email" attributes. The
  // unsuffixed form (legacy rental call sites) keeps the original IDs so
  // existing CSS / GA selectors don't break.
  const suffix = formId ? `-${formId}` : "";
  const wrapperId = `lead-form${suffix}`;
  const phoneId = `lead-phone${suffix}`;
  const emailId = `lead-email${suffix}`;
  const searchParams = useSearchParams();
  const router = useRouter();
  const isSales = variant === "sales";

  // Shared form state across both variants.
  // The name is auto-filled per submit as `Lead ${phoneLast4}` so each row is identifiable
  // when scrolling through recent leads without the form asking for a name.
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [honey, setHoney] = useState(""); // honeypot — must stay empty
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Variant-specific state. Inactive variant's state stays as empty string
  // — never read, never sent.
  const [budget, setBudget] = useState<string>("");           // rental only
  const [timeline, setTimeline] = useState<string>("");        // sales only
  const [preApproved, setPreApproved] = useState<string>("");  // sales only

  // THE PER-SURFACE UTM READ IS GONE. src/components/AttributionCapture.tsx runs in the root
  // layout and persists first-touch and last-touch for the whole session; the client helper
  // sends both. A form reading the current URL only ever saw the last landing page.

  const resolvedHeadline =
    headline ?? (isSales ? "Get info on this listing" : "Get matched in 60 seconds");
  const resolvedSubheadline =
    subheadline ??
    (isSales
      ? `Phone + email + timeline. ${REALTOR_FIRST_NAME} replies under 60 min.`
      : `Phone + email + budget. ${REALTOR_FIRST_NAME} texts 3–5 matches within the hour.`);
  const resolvedCtaLabel =
    ctaLabel ?? (isSales ? "Send me the details" : "Text me my matches");

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
    if (isSales) {
      if (!timeline) {
        setError("Please select your buying timeline.");
        return;
      }
      if (!preApproved) {
        setError("Please tell us if you're pre-approved.");
        return;
      }
    } else {
      if (!budget) {
        setError("Please select your budget.");
        return;
      }
    }

    setSubmitting(true);

    // The Pixel fires from the browser and the CAPI event fires from the server, both with
    // this event_id, so Meta de-duplicates the pair into one Lead. That pairing is the whole
    // reason the old dual write existed; it survives, the second row does not.
    const eventId = generateEventId();
    const { fbc, fbp } = readFbCookies();
    const resolvedValue = leadValue ?? (isSales ? 5000 : 2000);
    try {
      firePixelLead({ eventId, value: resolvedValue, currency: "CAD" });
    } catch (err) {
      // A Pixel failure must not cost the lead.
      console.warn("[lead-capture] pixel lead failed", err);
    }

    const result = await postLeadDetailed({
      source,
      // The vocabulary the value model understands. "buyer" and "renter" both scored 0.
      intent: isSales ? "buy" : "rent",
      // A placeholder name, so the row is scannable in the admin list.
      name: `Lead ${phoneDigits.slice(-4)}`,
      phone: phone.trim(),
      email: trimmedEmail,
      ...(isSales ? { timeline, preApproved } : { budget, homeType }),
      ...(mlsNumber ? { mlsNumber } : {}),
      event_id: eventId,
      fbc,
      fbp,
      fbclid: searchParams.get("fbclid") || undefined,
      honeypot: honey,
    });

    if (!result.ok) {
      setError(result.error || `Couldn't submit. Please try again or call ${config.realtor.phone}.`);
      setSubmitting(false);
      return;
    }

    // GA4 conversion event, fired AFTER the write is confirmed so a refused POST never
    // counts as a conversion. Both variants fire it; the value defaults differ (5000 sale,
    // 2000 rental). The thank-you page fires the same event with the same transaction_id, and
    // GA4 de-duplicates the pair, so only one billable conversion lands per lead while the
    // source and intent attribution is still captured at the moment of submit.
    if (typeof window !== "undefined") {
      const w = window as unknown as { gtag?: (...a: unknown[]) => void };
      if (w.gtag) {
        if (!isSales) w.gtag("event", "form_submit", { source, form: "3-field" });
        w.gtag("event", "generate_lead", {
          transaction_id: result.leadId ?? "",
          source,
          intent: isSales ? "buyer" : "renter",
          value: resolvedValue,
          currency: "CAD",
          listing_mls: mlsNumber || "",
        });
      }
    }

    const redirect = isSales
      ? `/sales/thank-you?lid=${result.leadId ?? ""}`
      : `/rentals/thank-you?lid=${result.leadId ?? ""}`;
    if (onSuccess) onSuccess({ id: result.leadId, redirect });
    router.push(redirect);
  }

  // The default white-card chrome includes its own bg + shadow + rounded
  // corners + padding so the form reads as a self-contained card on dark
  // hero backgrounds (rental flow). When the form is nested inside a parent
  // that already provides those affordances (sales-page Polaroid white
  // card), pass `chromeless` to drop the inner panel and keep only enough
  // padding to space the fields from the form's outer wrapper.
  const formChrome = chromeless
    ? "text-[#07111f]"
    : "bg-white rounded-2xl shadow-2xl p-4 sm:p-6 text-[#07111f]";

  return (
    <div id={wrapperId} className={className}>
      <form
        onSubmit={handleSubmit}
        className={formChrome}
        noValidate
      >
        {!hideHeader && (
          <>
            <h2 className="text-[18px] sm:text-[22px] font-extrabold leading-tight text-[#07111f] mb-1.5">
              {resolvedHeadline}
            </h2>
            <p className="text-[12px] sm:text-[13px] text-[#64748b] mb-3 sm:mb-4">
              {resolvedSubheadline}
            </p>
          </>
        )}

        {/* Phone + Email — side-by-side on desktop (sm+), stacked on mobile */}
        <div className="grid sm:grid-cols-2 gap-2 sm:gap-3 mb-3">
          <div>
            <label htmlFor={phoneId} className="block text-[11px] font-bold uppercase tracking-wider text-[#64748b] mb-1">
              Mobile number
            </label>
            <input
              id={phoneId}
              name="phone"
              type="tel"
              inputMode="numeric"
              pattern="\(\d{3}\) \d{3}-\d{4}"
              title="10-digit phone number, format (647) 555-0123"
              required
              value={phone}
              onChange={(e) => setPhone(formatPhone(e.target.value))}
              placeholder="(647) 555-0123"
              autoComplete="tel"
              className="w-full h-12 px-4 rounded-lg border border-[#e2e8f0] bg-white text-[16px] focus:outline-none focus:border-[#f59e0b] focus:ring-2 focus:ring-[#f59e0b]/20"
            />
          </div>
          <div>
            <label htmlFor={emailId} className="block text-[11px] font-bold uppercase tracking-wider text-[#64748b] mb-1">
              Email
            </label>
            <input
              id={emailId}
              name="email"
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

        {variant === "sales" ? (
          <>
            {/* Buying timeline — 2 cols on mobile, 4 cols on sm+ */}
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[#64748b] mb-1">
              Buying timeline
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
              {TIMELINE_OPTIONS.map((o) => (
                <button
                  key={o.val}
                  type="button"
                  onClick={() => setTimeline(o.val)}
                  className={`h-12 rounded-lg text-[13px] sm:text-[14px] font-semibold border transition-all ${
                    timeline === o.val
                      ? "bg-[#07111f] text-white border-[#07111f]"
                      : "bg-white text-[#374151] border-[#e2e8f0] hover:border-[#94a3b8]"
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>

            {/* Pre-approval — 2 cols */}
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[#64748b] mb-1">
              Pre-approved for a mortgage?
            </label>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {PRE_APPROVED_OPTIONS.map((o) => (
                <button
                  key={o.val}
                  type="button"
                  onClick={() => setPreApproved(o.val)}
                  className={`h-12 rounded-lg text-[13px] sm:text-[14px] font-semibold border transition-all ${
                    preApproved === o.val
                      ? "bg-[#07111f] text-white border-[#07111f]"
                      : "bg-white text-[#374151] border-[#e2e8f0] hover:border-[#94a3b8]"
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            {/* Budget — 2x2 button grid */}
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
          </>
        )}

        {/* Honeypot — silent spam trap */}
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
          {submitting ? "Sending…" : resolvedCtaLabel}
        </button>
        <p className="text-[11px] text-[#64748b] text-center mt-2.5 leading-relaxed">
          🔒 No spam. No fees. By submitting, I consent to receive SMS and email from {config.realtor.name}, {config.brokerage.name}. Reply STOP to opt out.{" "}
          <Link href="/privacy" className="underline hover:text-[#07111f]" target="_blank">Privacy</Link>.
        </p>
      </form>
    </div>
  );
}

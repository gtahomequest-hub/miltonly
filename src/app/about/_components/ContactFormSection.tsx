"use client";

import { useState } from "react";
import type { IntentOption } from "./_types";
import { ABOUT_EVENTS, fireAboutEvent } from "./_tracking";

interface ContactFormSectionProps {
  /** Lead-source tag. Locked: "about-page-direct-contact" (D2). */
  source: string;
  /** generate_lead value in CAD. Locked: 3000 — matches trust-card tier. */
  leadValue: number;
  /** Radio options for the "I'm interested in..." field. Values
   *  submitted to /api/leads via the general-inquiry intent branch
   *  (D2, validator extension pending). */
  intentOptions: IntentOption[];
  phoneDisplay: string;
  phoneE164: string;
  whatsappE164: string;
  email: string;
  /** Eyebrow above the heading, e.g. "Direct contact". */
  eyebrow: string;
  /** Section heading, e.g. "Talk to Aamir". */
  heading: string;
  /** Subline under heading. */
  subheading: string;
}

const HONEYPOT_FIELD = "company_website";
const PHONE_PATTERN = "[0-9]{3}-[0-9]{3}-[0-9]{4}";

function formatPhoneOnInput(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
}

/**
 * Direct-contact section: inline lead form + 3 alternative contact
 * methods. Form complies with the Phase 4.1 locked input standard
 * (name= on every input, inputMode="numeric" for phone, pattern
 * safety net, autoComplete tags throughout).
 *
 * Gate 7 ships the UI only. Submission is intentionally stubbed —
 * the /api/leads validator needs the general-inquiry intent branch
 * (D2 parallel workstream) before this form posts a real payload.
 * Submitting today shows a "form wiring lands shortly" notice and
 * fires form_submit_attempt for funnel measurement.
 */
export default function ContactFormSection(props: ContactFormSectionProps) {
  const [focused, setFocused] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [inquiryType, setInquiryType] = useState(
    props.intentOptions[0]?.value ?? "",
  );
  const [message, setMessage] = useState("");
  const [submitNotice, setSubmitNotice] = useState<string | null>(null);

  function onFirstFocus() {
    if (focused) return;
    fireAboutEvent(ABOUT_EVENTS.formFieldFocus);
    setFocused(true);
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    fireAboutEvent(ABOUT_EVENTS.formSubmitAttempt, {
      inquiry_type: inquiryType,
    });
    setSubmitNotice(
      `Form wiring lands shortly. Until then, call ${props.phoneDisplay} or use the contact options below.`,
    );
  }

  return (
    <section
      id="about-contact"
      data-section="about-contact"
      aria-labelledby="about-contact-heading"
      className="bg-[#f8f9fb]"
    >
      <div className="max-w-4xl mx-auto px-5 sm:px-8 py-12 sm:py-16">
        <div className="text-center mb-6 sm:mb-8">
          <div className="text-[11px] font-bold uppercase tracking-[1.5px] text-[#f59e0b] mb-2">
            {props.eyebrow}
          </div>
          <h2
            id="about-contact-heading"
            className="text-[24px] sm:text-[28px] font-extrabold text-[#07111f] tracking-[-0.02em] mb-2"
          >
            {props.heading}
          </h2>
          <p className="text-[13px] sm:text-[14px] text-[#64748b] max-w-[520px] mx-auto leading-relaxed">
            {props.subheading}
          </p>
        </div>

        <form
          method="post"
          action="/api/leads"
          data-source={props.source}
          data-lead-value={props.leadValue}
          onFocus={onFirstFocus}
          onSubmit={onSubmit}
          noValidate
          className="bg-white rounded-2xl shadow-lg p-5 sm:p-7 border border-[#e2e8f0]"
        >
          {/* Honeypot — hidden field; bots will fill it. Server discards
              submissions where this field has a value. */}
          <input
            type="text"
            name={HONEYPOT_FIELD}
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            className="hidden"
            value=""
            readOnly
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-3 sm:mb-4">
            <label className="block">
              <span className="block text-[12px] font-semibold text-[#07111f] mb-1.5">
                Your name
              </span>
              <input
                type="text"
                name="firstName"
                autoComplete="name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-[#f8f9fb] border border-[#e2e8f0] rounded-lg px-3 py-3 text-[14px] text-[#07111f] focus:outline-none focus:border-[#f59e0b] focus:bg-white transition-colors"
                placeholder="Aamir Y."
              />
            </label>

            <label className="block">
              <span className="block text-[12px] font-semibold text-[#07111f] mb-1.5">
                Phone
              </span>
              <input
                type="text"
                name="phone"
                inputMode="numeric"
                pattern={PHONE_PATTERN}
                autoComplete="tel-national"
                required
                value={phone}
                onChange={(e) => setPhone(formatPhoneOnInput(e.target.value))}
                placeholder="647-839-9090"
                className="w-full bg-[#f8f9fb] border border-[#e2e8f0] rounded-lg px-3 py-3 text-[14px] text-[#07111f] focus:outline-none focus:border-[#f59e0b] focus:bg-white transition-colors"
              />
            </label>
          </div>

          <label className="block mb-3 sm:mb-4">
            <span className="block text-[12px] font-semibold text-[#07111f] mb-1.5">
              Email
            </span>
            <input
              type="email"
              name="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full bg-[#f8f9fb] border border-[#e2e8f0] rounded-lg px-3 py-3 text-[14px] text-[#07111f] focus:outline-none focus:border-[#f59e0b] focus:bg-white transition-colors"
            />
          </label>

          <fieldset className="mb-3 sm:mb-4">
            <legend className="block text-[12px] font-semibold text-[#07111f] mb-2">
              I&apos;m interested in
            </legend>
            <div className="flex flex-wrap gap-2">
              {props.intentOptions.map((opt) => {
                const checked = inquiryType === opt.value;
                return (
                  <label
                    key={opt.value}
                    className={`inline-flex items-center gap-2 px-3 py-2 rounded-full border text-[13px] cursor-pointer transition-colors ${
                      checked
                        ? "bg-[#07111f] border-[#07111f] text-[#f8f9fb]"
                        : "bg-white border-[#e2e8f0] text-[#07111f] hover:border-[#94a3b8]"
                    }`}
                  >
                    <input
                      type="radio"
                      name="inquiryType"
                      value={opt.value}
                      checked={checked}
                      onChange={(e) => setInquiryType(e.target.value)}
                      className="sr-only"
                    />
                    {opt.label}
                  </label>
                );
              })}
            </div>
          </fieldset>

          <label className="block mb-4 sm:mb-5">
            <span className="block text-[12px] font-semibold text-[#07111f] mb-1.5">
              Anything I should know? <span className="text-[#64748b] font-normal">(optional)</span>
            </span>
            <textarea
              name="message"
              autoComplete="off"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              className="w-full bg-[#f8f9fb] border border-[#e2e8f0] rounded-lg px-3 py-3 text-[14px] text-[#07111f] focus:outline-none focus:border-[#f59e0b] focus:bg-white transition-colors resize-none"
              placeholder="Timeline, neighbourhood, budget — whatever helps."
            />
          </label>

          <button
            type="submit"
            className="w-full bg-[#f59e0b] hover:bg-[#fbbf24] text-[#07111f] font-extrabold text-[15px] px-6 py-3.5 rounded-lg transition-colors min-h-[52px]"
          >
            Send to {props.phoneDisplay.split(" ")[0]}
          </button>

          {submitNotice ? (
            <p
              role="status"
              className="mt-3 text-[12px] text-[#64748b] text-center leading-relaxed"
            >
              {submitNotice}
            </p>
          ) : (
            <p className="mt-3 text-[11px] text-[#64748b] text-center leading-relaxed">
              By submitting you agree {props.phoneDisplay} may call or text you about your inquiry. Standard rates may apply.
            </p>
          )}
        </form>

        {/* Alt-contact rail. Three channels, click-tracked individually. */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3 mt-6">
          <a
            href={`tel:${props.phoneE164}`}
            onClick={() => fireAboutEvent(ABOUT_EVENTS.clickCallAbout)}
            className="inline-flex items-center justify-center gap-2 bg-white border border-[#e2e8f0] hover:border-[#f59e0b] text-[#07111f] font-bold text-[14px] px-4 py-3 rounded-lg transition-colors min-h-[48px]"
          >
            <span aria-hidden>📞</span> Call {props.phoneDisplay}
          </a>
          <a
            href={`https://wa.me/${props.whatsappE164}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => fireAboutEvent(ABOUT_EVENTS.clickWhatsappAbout)}
            className="inline-flex items-center justify-center gap-2 bg-white border border-[#e2e8f0] hover:border-[#f59e0b] text-[#07111f] font-bold text-[14px] px-4 py-3 rounded-lg transition-colors min-h-[48px]"
          >
            <span aria-hidden>💬</span> WhatsApp
          </a>
          <a
            href={`mailto:${props.email}`}
            onClick={() => fireAboutEvent(ABOUT_EVENTS.clickEmailAbout)}
            className="inline-flex items-center justify-center gap-2 bg-white border border-[#e2e8f0] hover:border-[#f59e0b] text-[#07111f] font-bold text-[14px] px-4 py-3 rounded-lg transition-colors min-h-[48px]"
          >
            <span aria-hidden>✉️</span> Email
          </a>
        </div>
      </div>
    </section>
  );
}

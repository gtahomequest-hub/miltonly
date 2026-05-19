"use client";

import { useRef } from "react";
import type { FAQItem } from "./_types";
import { ABOUT_EVENTS, fireAboutEvent } from "./_tracking";

interface FAQSectionProps {
  questions: FAQItem[];
  /** Eyebrow above heading. */
  eyebrow: string;
  /** Section heading. */
  heading: string;
}

/**
 * FAQ accordion. Renders native <details>/<summary> so it works
 * without JS and stays accessible by default; the surrounding client
 * wrapper fires faq_expand once per question_id on first open.
 *
 * Section renders nothing when no questions are provided (optional
 * per the locked spec — only ships once Aamir confirms answers).
 *
 * Schema.org FAQPage JSON-LD injection is owned by
 * src/lib/schema/faq.ts and rendered by page.tsx (Gate 6 of schema work).
 */
export default function FAQSection(props: FAQSectionProps) {
  const fired = useRef<Set<string>>(new Set());

  if (props.questions.length === 0) return null;

  function onToggle(item: FAQItem, e: React.SyntheticEvent<HTMLDetailsElement>) {
    const opened = (e.currentTarget as HTMLDetailsElement).open;
    if (!opened) return;
    if (fired.current.has(item.id)) return;
    fired.current.add(item.id);
    fireAboutEvent(ABOUT_EVENTS.faqExpand, { question_id: item.id });
  }

  return (
    <section
      data-section="about-faq"
      aria-labelledby="about-faq-heading"
      className="bg-[#f8f9fb]"
    >
      <div className="max-w-3xl mx-auto px-5 sm:px-8 py-12 sm:py-16">
        <div className="text-center mb-6 sm:mb-8">
          <div className="text-[11px] font-bold uppercase tracking-[1.5px] text-[#f59e0b] mb-2">
            {props.eyebrow}
          </div>
          <h2
            id="about-faq-heading"
            className="text-[24px] sm:text-[28px] font-extrabold text-[#07111f] tracking-[-0.02em]"
          >
            {props.heading}
          </h2>
        </div>

        <div className="divide-y divide-[#e2e8f0] bg-white rounded-2xl shadow-sm border border-[#e2e8f0]">
          {props.questions.map((q) => (
            <details
              key={q.id}
              onToggle={(e) => onToggle(q, e)}
              className="group"
            >
              <summary className="flex items-center justify-between gap-3 cursor-pointer list-none px-4 sm:px-6 py-4 sm:py-5 text-[14px] sm:text-[15px] font-semibold text-[#07111f] hover:bg-[#f8f9fb] transition-colors">
                <span>{q.question}</span>
                <span
                  aria-hidden
                  className="shrink-0 text-[#f59e0b] text-[20px] leading-none transition-transform group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <div className="px-4 sm:px-6 pb-4 sm:pb-5 text-[13px] sm:text-[14px] text-[#475569] leading-relaxed whitespace-pre-line">
                {q.answer}
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

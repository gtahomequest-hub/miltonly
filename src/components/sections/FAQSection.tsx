"use client";

import { useState } from "react";
import { homepageFAQs } from "@/lib/faqs";
import { config } from "@/lib/config";

export default function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section className="bg-neutral-50/70">
      <div className="section-container section-padding">
        <div className="text-center mb-12">
          <span className="section-label text-brand-500">FAQ</span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-navy mt-2">
            Frequently Asked Questions
          </h2>
          <p className="text-neutral-500 mt-3 max-w-lg mx-auto">
            Common questions about {config.CITY_NAME} {config.CITY_PROVINCE} real estate.
          </p>
        </div>

        <div className="max-w-3xl mx-auto space-y-3">
          {homepageFAQs.map((faq, i) => {
            const isOpen = openIndex === i;
            return (
              <div
                key={i}
                className="card overflow-hidden"
              >
                <button
                  onClick={() => setOpenIndex(isOpen ? null : i)}
                  className="w-full flex items-center justify-between p-5 sm:p-6 text-left"
                >
                  <span className="text-[15px] font-bold text-navy pr-4">
                    {faq.question}
                  </span>
                  <svg
                    className={`w-5 h-5 text-neutral-400 shrink-0 transition-transform duration-200 ${
                      isOpen ? "rotate-180" : ""
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>
                {isOpen && (
                  <div className="px-5 sm:px-6 pb-5 sm:pb-6">
                    <p className="text-sm text-neutral-600 leading-relaxed">
                      {faq.answer}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

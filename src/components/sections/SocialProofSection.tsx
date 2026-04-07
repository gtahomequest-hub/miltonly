export default function SocialProofSection() {
  const testimonials = [
    {
      name: "Sarah & James T.",
      location: "Willmott",
      quote:
        "We found our dream home in Willmott thanks to the street data. Knowing the sold prices on the exact street gave us the confidence to make our offer.",
    },
    {
      name: "Michael R.",
      location: "Old Milton",
      quote:
        "Sold my home for $45K over asking. The market data and pricing strategy made all the difference. Listed to sold in 6 days.",
    },
    {
      name: "Priya & Arjun K.",
      location: "Hawthorne Village",
      quote:
        "As investors, the neighbourhood comparison tool was a game-changer. We could see exactly which streets had the best rental yield.",
    },
  ];

  return (
    <section className="bg-neutral-50">
      <div className="section-container section-padding">
        <div className="text-center mb-10">
          <h2 className="text-3xl lg:text-4xl font-bold text-neutral-900">
            Trusted by Milton Families
          </h2>
          <p className="text-neutral-600 mt-2">
            Real results from real Milton homeowners.
          </p>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-12">
          {[
            { value: "500+", label: "Families Helped" },
            { value: "4.9", label: "Google Rating" },
            { value: "12", label: "Avg. Days to Sell" },
            { value: "15+", label: "Years in Milton" },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <p className="text-3xl lg:text-4xl font-bold text-brand-600">
                {stat.value}
              </p>
              <p className="text-sm text-neutral-500 mt-1">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Testimonial cards */}
        <div className="grid md:grid-cols-3 gap-6">
          {testimonials.map((t) => (
            <div
              key={t.name}
              className="bg-white rounded-xl border border-neutral-200 p-6"
            >
              {/* Stars */}
              <div className="flex gap-1 mb-4">
                {[...Array(5)].map((_, i) => (
                  <svg key={i} className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
              <p className="text-neutral-700 text-sm leading-relaxed">
                &ldquo;{t.quote}&rdquo;
              </p>
              <div className="mt-4 pt-4 border-t border-neutral-100">
                <p className="font-semibold text-neutral-900 text-sm">
                  {t.name}
                </p>
                <p className="text-neutral-500 text-xs">{t.location}, Milton</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

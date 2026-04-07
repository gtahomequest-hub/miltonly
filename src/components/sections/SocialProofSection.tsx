export default function SocialProofSection() {
  const testimonials = [
    {
      name: "Sarah & James T.",
      location: "Willmott",
      quote: "We found our dream home in Willmott thanks to the street data. Knowing the sold prices on the exact street gave us confidence to make our offer.",
    },
    {
      name: "Michael R.",
      location: "Old Milton",
      quote: "Sold my home for $45K over asking. The market data and pricing strategy made all the difference. Listed to sold in 6 days.",
    },
    {
      name: "Priya & Arjun K.",
      location: "Hawthorne Village",
      quote: "As investors, the neighbourhood comparison tool was a game-changer. We could see exactly which streets had the best rental yield.",
    },
  ];

  return (
    <section className="bg-neutral-50/70">
      <div className="section-container section-padding">
        <div className="text-center mb-12">
          <span className="section-label text-brand-500">Social Proof</span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-navy mt-2">
            Trusted by Milton Families
          </h2>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-14">
          {[
            { value: "500+", label: "Families Helped" },
            { value: "4.9", label: "Google Rating" },
            { value: "12", label: "Avg. Days to Sell" },
            { value: "15+", label: "Years in Milton" },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <p className="text-4xl sm:text-5xl font-extrabold text-navy tracking-tight">
                {stat.value}
              </p>
              <p className="text-sm text-neutral-400 mt-2 font-medium">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Testimonials + video placeholders */}
        <div className="grid md:grid-cols-3 gap-5">
          {testimonials.map((t) => (
            <div key={t.name} className="card p-6">
              {/* Video thumbnail placeholder */}
              <div className="aspect-video bg-gradient-to-br from-navy to-brand-800 rounded-xl mb-5 relative overflow-hidden group cursor-pointer">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-12 h-12 bg-white/20 group-hover:bg-white/30 backdrop-blur-sm rounded-full flex items-center justify-center transition-all">
                    <svg className="w-5 h-5 text-white ml-0.5" fill="currentColor" viewBox="0 0 20 20"><path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z"/></svg>
                  </div>
                </div>
              </div>

              {/* Stars */}
              <div className="flex gap-0.5 mb-3">
                {[...Array(5)].map((_, i) => (
                  <svg key={i} className="w-4 h-4 text-gold-400" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>

              <p className="text-neutral-600 text-sm leading-relaxed">
                &ldquo;{t.quote}&rdquo;
              </p>
              <div className="mt-4 pt-4 border-t border-neutral-100">
                <p className="font-bold text-navy text-sm">{t.name}</p>
                <p className="text-neutral-400 text-xs mt-0.5">{t.location}, Milton</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

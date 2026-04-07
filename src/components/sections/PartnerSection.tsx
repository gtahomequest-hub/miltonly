const partners = [
  { type: "Mortgage Broker", description: "Get pre-approved and find the best rates for your Milton home.", badge: "Finance" },
  { type: "Real Estate Lawyer", description: "Experienced Milton real estate lawyers for smooth closings.", badge: "Legal" },
  { type: "Home Inspector", description: "Trusted home inspectors who know Milton properties.", badge: "Inspection" },
  { type: "Moving Company", description: "Local movers who make your Milton move stress-free.", badge: "Moving" },
  { type: "Contractor", description: "Renovation pros for pre-sale prep or your new home.", badge: "Renovations" },
];

export default function PartnerSection() {
  return (
    <section className="bg-white">
      <div className="section-container section-padding">
        <div className="text-center mb-12">
          <span className="section-label text-brand-500">Partner Network</span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-navy mt-2">
            The Milton Home Network
          </h2>
          <p className="text-neutral-500 mt-3 max-w-lg mx-auto">
            Trusted professionals — mortgage, legal, inspection, moving, and more.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {partners.map((p) => (
            <div key={p.type} className="card card-hover p-6 text-center">
              {/* Logo placeholder */}
              <div className="w-14 h-14 bg-neutral-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <span className="text-xl font-bold text-neutral-300">
                  {p.type.charAt(0)}
                </span>
              </div>
              <span className="inline-block text-[10px] font-bold uppercase tracking-wider text-brand-500 bg-brand-50 px-2.5 py-1 rounded-full mb-3">
                {p.badge}
              </span>
              <h3 className="font-bold text-navy text-sm">{p.type}</h3>
              <p className="text-neutral-400 text-xs mt-2 leading-relaxed">
                {p.description}
              </p>
              <button className="mt-4 text-sm font-semibold text-brand-500 hover:text-brand-600 transition-colors">
                Get Referred
              </button>
            </div>
          ))}
        </div>

        {/* Mortgage calculator teaser */}
        <div className="mt-10 card p-6 sm:p-8 text-center border-brand-100 bg-brand-50/30">
          <h3 className="text-xl font-extrabold text-navy">
            How much can I afford?
          </h3>
          <p className="text-neutral-500 text-sm mt-2 mb-5 max-w-md mx-auto">
            Use our mortgage calculator to find your budget, then connect with
            our trusted mortgage partner.
          </p>
          <button className="btn-primary">Open Mortgage Calculator</button>
        </div>
      </div>
    </section>
  );
}

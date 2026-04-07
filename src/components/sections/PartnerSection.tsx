const partners = [
  {
    type: "Mortgage Broker",
    description: "Get pre-approved and find the best rates for your Milton home.",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
      </svg>
    ),
  },
  {
    type: "Real Estate Lawyer",
    description: "Experienced Milton real estate lawyers for smooth closings.",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 3v17.25m0 0c-1.472 0-2.882.265-4.185.75M12 20.25c1.472 0 2.882.265 4.185.75M18.75 4.97A48.416 48.416 0 0012 4.5c-2.291 0-4.545.16-6.75.47m13.5 0c1.01.143 2.01.317 3 .52m-3-.52l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.988 5.988 0 01-2.031.352 5.988 5.988 0 01-2.031-.352c-.483-.174-.711-.703-.59-1.202L18.75 4.97zm-16.5.52c.99-.203 1.99-.377 3-.52m0 0l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.989 5.989 0 01-2.031.352 5.989 5.989 0 01-2.031-.352c-.483-.174-.711-.703-.59-1.202L5.25 4.97z" />
      </svg>
    ),
  },
  {
    type: "Home Inspector",
    description: "Trusted home inspectors who know Milton properties.",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
      </svg>
    ),
  },
  {
    type: "Moving Company",
    description: "Local movers who make your Milton move stress-free.",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0H6.375c-.621 0-1.125-.504-1.125-1.125V11.25m19.5 0h-1.5m-16.5 0h1.5m14.25 0V6.375c0-.621-.504-1.125-1.125-1.125H4.125C3.504 5.25 3 5.754 3 6.375V11.25" />
      </svg>
    ),
  },
  {
    type: "Contractor",
    description: "Renovation pros for pre-sale prep or your new home.",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.42 15.17l-5.1-5.1a2.121 2.121 0 113-3l5.1 5.1m0 0L18 9.75M11.42 15.17L6.43 20.16a2.121 2.121 0 01-3-3l4.99-4.99" />
      </svg>
    ),
  },
];

export default function PartnerSection() {
  return (
    <section className="bg-white">
      <div className="section-container section-padding">
        <div className="text-center mb-10">
          <h2 className="text-3xl lg:text-4xl font-bold text-neutral-900">
            The Milton Home Network
          </h2>
          <p className="text-neutral-600 mt-2">
            Trusted professionals — mortgage, legal, inspection, moving, and more.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {partners.map((p) => (
            <div
              key={p.type}
              className="bg-neutral-50 rounded-xl border border-neutral-200 p-5 text-center hover:border-brand-200 hover:shadow-sm transition-all group"
            >
              <div className="w-12 h-12 bg-brand-50 text-brand-600 rounded-lg flex items-center justify-center mx-auto mb-4 group-hover:bg-brand-100 transition-colors">
                {p.icon}
              </div>
              <h3 className="font-bold text-neutral-900 text-sm">{p.type}</h3>
              <p className="text-neutral-500 text-xs mt-2 leading-relaxed">
                {p.description}
              </p>
              <button className="mt-4 text-sm font-semibold text-brand-600 hover:text-brand-700">
                Get Referred
              </button>
            </div>
          ))}
        </div>

        {/* Mortgage calculator teaser */}
        <div className="mt-10 bg-brand-50 rounded-xl border border-brand-100 p-6 lg:p-8 text-center">
          <h3 className="text-xl font-bold text-neutral-900">
            How much can I afford?
          </h3>
          <p className="text-neutral-600 text-sm mt-2 mb-4">
            Use our mortgage calculator to find your budget, then connect with
            our trusted mortgage partner.
          </p>
          <button className="btn-primary">Open Mortgage Calculator</button>
        </div>
      </div>
    </section>
  );
}

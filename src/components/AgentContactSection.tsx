interface Props {
  headline?: string;
}

export default function AgentContactSection({ headline = "Your Milton Real Estate Expert" }: Props) {
  return (
    <section className="acs">
      <div className="acs-inner">
        <h2 className="acs-name">Aamir Yaqoob</h2>
        <p className="acs-brokerage">Sales Representative · RE/MAX Realty Specialists Inc.</p>
        <p className="acs-tagline">{headline}</p>
        <p className="acs-bio">
          With 14 years of full-time experience, Aamir knows that real estate is about far more than price — it is about finding the right fit, the right protection, and the right outcome. Whether you are a tenant, a landlord, or ready to buy or sell, Aamir represents your interests completely.
        </p>
        <div className="acs-awards">
          <div className="acs-award">🏆 RE/MAX Hall of Fame Award</div>
          <div className="acs-award">🏆 RE/MAX Executive Award</div>
          <div className="acs-award">🏆 RE/MAX 100% Club Award</div>
        </div>
        <div className="acs-pills">
          <span className="acs-pill">14 Years Full-Time</span>
          <span className="acs-pill">Tenants &amp; Landlords</span>
          <span className="acs-pill">Buyers &amp; Sellers</span>
          <span className="acs-pill">Milton Specialist</span>
        </div>
        <div className="acs-btns">
          <a href="tel:+16478399090" className="acs-btn-call">📞 Call or Text (647) 839-9090</a>
          <a href="https://wa.me/16478399090" target="_blank" rel="noopener noreferrer" className="acs-btn-wa">💬 WhatsApp (647) 839-9090</a>
        </div>
        <a href="mailto:gtahomequest@gmail.com" className="acs-email">gtahomequest@gmail.com</a>
      </div>
    </section>
  );
}

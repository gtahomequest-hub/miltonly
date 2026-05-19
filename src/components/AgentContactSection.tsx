import { config } from "@/lib/config";

interface Props {
  headline?: string;
}

export default function AgentContactSection({ headline = "Your Milton Real Estate Expert" }: Props) {
  const yrs = config.realtor.yearsExperience;
  const firstName = config.realtor.name.split(" ")[0];
  const brokerageShort = config.brokerage.name.replace(", Brokerage", "");
  const contact = config.realtor.contact;

  return (
    <section className="acs">
      <div className="acs-inner">
        <h2 className="acs-name">{config.realtor.name}</h2>
        <p className="acs-brokerage">{config.realtor.title} · {brokerageShort}</p>
        <p className="acs-tagline">{headline}</p>
        <p className="acs-bio">
          With {yrs} years of full-time experience, {firstName} knows that real estate is about far more than price — it is about finding the right fit, the right protection, and the right outcome. Whether you are a tenant, a landlord, or ready to buy or sell, {firstName} represents your interests completely.
        </p>
        <div className="acs-awards">
          <div className="acs-award">🏆 RE/MAX Hall of Fame Award</div>
          <div className="acs-award">🏆 RE/MAX Executive Award</div>
          <div className="acs-award">🏆 RE/MAX 100% Club Award</div>
        </div>
        <div className="acs-pills">
          <span className="acs-pill">{yrs} Years Full-Time</span>
          <span className="acs-pill">Tenants &amp; Landlords</span>
          <span className="acs-pill">Buyers &amp; Sellers</span>
          <span className="acs-pill">Milton Specialist</span>
        </div>
        <div className="acs-btns">
          <a href={`tel:${contact.phoneE164}`} className="acs-btn-call">📞 Call or Text {contact.phoneDisplay}</a>
          <a href={`https://wa.me/${contact.whatsapp}`} target="_blank" rel="noopener noreferrer" className="acs-btn-wa">💬 WhatsApp {contact.phoneDisplay}</a>
        </div>
        <a href={`mailto:${contact.email}`} className="acs-email">{contact.email}</a>
      </div>
    </section>
  );
}

"use client";

import { config } from "@/lib/config";

interface Props {
  headline?: string;
}

type GtagFn = (...args: unknown[]) => void;

function getGtag(): GtagFn | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { gtag?: GtagFn };
  return typeof w.gtag === "function" ? w.gtag : null;
}

// tel:, wa.me, and mailto: clicks navigate away from the document
// immediately. Standard gtag('event', …) often loses the request
// to that navigation. transport_type: 'beacon' makes GA4 use
// navigator.sendBeacon under the hood — fire-and-forget delivery
// that survives the page unload.
function fireGenerateLead(source: string) {
  const gtag = getGtag();
  if (!gtag) return;
  gtag("event", "generate_lead", {
    source,
    value: 1500,
    currency: "CAD",
    transport_type: "beacon",
  });
}

export default function AgentContactSection({ headline = "Your Milton Real Estate Expert" }: Props) {
  const yrs = config.realtor.yearsExperience;
  const email = config.realtor.contact.email;

  return (
    <section className="acs">
      <div className="acs-inner">
        <h2 className="acs-name">Aamir Yaqoob</h2>
        <p className="acs-brokerage">Sales Representative · RE/MAX Realty Specialists Inc.</p>
        <p className="acs-tagline">{headline}</p>
        <p className="acs-bio">
          With {yrs} years of full-time experience, Aamir knows that real estate is about far more than price — it is about finding the right fit, the right protection, and the right outcome. Whether you are a tenant, a landlord, or ready to buy or sell, Aamir represents your interests completely.
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
          <a
            href="tel:+16478399090"
            className="acs-btn-call"
            onClick={() => fireGenerateLead("about-page-call")}
          >
            📞 Call or Text (647) 839-9090
          </a>
          <a
            href="https://wa.me/16478399090"
            target="_blank"
            rel="noopener noreferrer"
            className="acs-btn-wa"
            onClick={() => fireGenerateLead("about-page-whatsapp")}
          >
            💬 WhatsApp (647) 839-9090
          </a>
        </div>
        <a
          href={`mailto:${email}`}
          className="acs-email"
          onClick={() => fireGenerateLead("about-page-email")}
        >
          {email}
        </a>
      </div>
    </section>
  );
}

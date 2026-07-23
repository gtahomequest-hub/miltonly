import { Suspense } from "react";
import { generateMetadata as genMeta } from "@/lib/seo";
import { config } from "@/lib/config";
import SiteNav from "@/components/nav/SiteNav";
import HomeValuationCard from "@/components/landing/HomeValuationCard";
import AgentContactSection from "@/components/AgentContactSection";
import FooterSection from "@/components/sections/FooterSection";
import "./sell-theme.css";

export const metadata = genMeta({
  title: `What Is Your ${config.CITY_NAME} Home Worth? — Free Valuation`,
  description: `Get a free, no-obligation home valuation from ${config.realtor.name}. ${config.realtor.yearsExperience} years of ${config.CITY_NAME} real estate experience. RE/MAX Hall of Fame Award recipient.`,
  canonical: `${config.SITE_URL}/sell`,
});

// Same user-confirmed real business facts as getHomepageData().trust
// (src/lib/homepageData.ts) — repeated as literals so /sell stays static
// with no DB module in its graph.
const TRUST = {
  rating: "5.0",
  reviewCount: "235+",
  idx: "1809031",
  vow: "1848370",
};

const FIRST_NAME = config.realtor.name.split(" ")[0];
const WHATSAPP_URL = `https://wa.me/${config.realtor.phoneE164.replace("+", "")}`;

export default function SellPage() {
  return (
    <div className="sell-v2">
      <SiteNav variant="page" />

      {/* hero — copy left, the proven valuation form right */}
      <section className="s-hero">
        <div className="s-wrap s-hero-grid">
          <div>
            <span className="s-eyebrow">Free home valuation</span>
            <h1>
              What Is Your {config.CITY_NAME}
              <br />
              Home <em>Worth?</em>
            </h1>
            <p className="s-lede">
              {config.CITY_NAME}&apos;s market moves quickly. {FIRST_NAME} prepares
              every valuation personally — comparable sales, recent listings, and
              current conditions — and emails your written report within 24
              business hours.
            </p>
            <ul className="s-hero-points">
              <li>No obligation, no pressure — the report is yours to keep</li>
              <li>{config.realtor.yearsExperience} years full-time in {config.CITY_NAME} real estate</li>
              <li>RE/MAX Hall of Fame Award recipient</li>
            </ul>
            <div className="s-hero-ctas">
              <a href={`tel:${config.realtor.phoneE164}`} className="s-cta-sec">
                📞 Call or text {config.realtor.phone}
              </a>
              <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="s-cta-sec">
                💬 WhatsApp {FIRST_NAME}
              </a>
            </div>
          </div>
          <div id="valuation">
            <Suspense fallback={null}>
              <HomeValuationCard
                mlsNumber=""
                source="sell-page"
                theme="forest"
                kicker="Free valuation — no obligation"
                title={`What's your ${config.CITY_NAME} home worth?`}
              />
            </Suspense>
          </div>
        </div>
      </section>

      {/* why list with Aamir */}
      <section className="s-block">
        <div className="s-wrap">
          <div className="s-sechead">
            <span className="s-eyebrow">Why list with {FIRST_NAME}</span>
            <h2>A valuation done by hand, backed by a track record</h2>
          </div>
          <div className="s-whygrid">
            <div className="s-why">
              <div className="s-why-num">01</div>
              <h3>{config.realtor.yearsExperience} years, full-time, {config.CITY_NAME}</h3>
              <p>
                Deep knowledge of every neighbourhood, street, and pricing trend in{" "}
                {config.CITY_NAME} — not a generalist spreading across the GTA.
              </p>
            </div>
            <div className="s-why">
              <div className="s-why-num">02</div>
              <h3>Personal CMA, no algorithm</h3>
              <p>
                Every valuation starts with a fresh comparable pull done by{" "}
                {FIRST_NAME} himself. A written report in your inbox within 24
                business hours.
              </p>
            </div>
            <div className="s-why">
              <div className="s-why-num">03</div>
              <h3>RE/MAX Hall of Fame</h3>
              <p>
                Hall of Fame, Executive, and 100% Club awards — performance
                recognized by one of the world&apos;s largest real estate brands.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* social proof — real business facts */}
      <section className="s-block s-alt">
        <div className="s-wrap">
          <div className="s-sechead">
            <span className="s-eyebrow">Trusted, verified</span>
            <h2>The numbers behind the name</h2>
          </div>
          <div className="s-proofgrid">
            <div className="s-proof">
              <div className="s-proof-stat">★ {TRUST.rating}</div>
              <div className="s-proof-label">Client rating</div>
            </div>
            <div className="s-proof">
              <div className="s-proof-stat">{TRUST.reviewCount}</div>
              <div className="s-proof-label">Families helped</div>
            </div>
            <div className="s-proof">
              <div className="s-proof-stat">IDX #{TRUST.idx}</div>
              <div className="s-proof-label">Licensed TREB IDX data feed</div>
            </div>
            <div className="s-proof">
              <div className="s-proof-stat">VOW #{TRUST.vow}</div>
              <div className="s-proof-label">Licensed TREB VOW data feed</div>
            </div>
          </div>
        </div>
      </section>

      {/* agent strip — shared component, forest via .sell-v2 .acs overrides */}
      <AgentContactSection headline={`Ready to sell your ${config.CITY_NAME} home?`} />

      {/* closer */}
      <section className="s-closer">
        <div className="s-wrap">
          <h2>Find out what your home is worth</h2>
          <p>
            Two minutes to ask. A written, comparables-backed answer from{" "}
            {FIRST_NAME} within 24 business hours.
          </p>
          <a className="s-cta-main" href="#valuation">
            Get my free valuation
          </a>
          <div className="s-hero-ctas">
            <a href={`tel:${config.realtor.phoneE164}`} className="s-cta-sec">
              📞 {config.realtor.phone}
            </a>
            <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="s-cta-sec">
              💬 WhatsApp
            </a>
          </div>
        </div>
      </section>

      <FooterSection />
    </div>
  );
}

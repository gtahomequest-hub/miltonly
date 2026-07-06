// src/components/value/ValueLanding.tsx
//
// Presentational shell for the /value door-hanger valuation landing page.
// SERVER component (no "use client") — renders the reused .sell-v2 forest
// shell + the reused HomeValuationCard (client) inside <Suspense>.
//
// EXTENSION SEAM: this component takes a resolved { locationName, data }
// contract, NOT a slug. /value/[neighbourhood] resolves neighbourhood-grain
// data; a future /value/[neighbourhood]/[street] resolves street-grain data
// and renders the SAME shell + SAME form — swap the data fetch, not the UI.
//
// data === null  -> the sub-k / no-hub number-free editorial variant
// (nullStats discipline, same as the /potl tenure hub): NEVER a fabricated
// median, never $0/NaN. data present -> the grounded live-numbers block.

import { Suspense } from "react";
import SiteNav from "@/components/nav/SiteNav";
import HomeValuationCard from "@/components/landing/HomeValuationCard";
import FooterSection from "@/components/sections/FooterSection";
import { fullPrice } from "@/components/hub/format";
import { config } from "@/lib/config";

export interface ValueData {
  typicalPrice: number; // k-anon-cleared typical sold $ (never null here)
  sold12mo: number; // 12-mo sold count (> 0 here)
  dom: number | null; // avg days on market (getHubData.stats.dom)
}

export interface ValueLandingProps {
  /** Display name of the location (neighbourhood now; street later). */
  locationName: string;
  /** Grounded live-data packet, or null for the sub-k/no-hub variant. */
  data: ValueData | null;
}

const FIRST_NAME = config.realtor.name.split(" ")[0];
const WHATSAPP_URL = `https://wa.me/${config.realtor.phoneE164.replace("+", "")}`;

export default function ValueLanding({ locationName, data }: ValueLandingProps) {
  // Live-data sentence (grounded) vs number-free editorial (sub-k/no-hub).
  // Built as JS strings (not JSX text) so apostrophes need no escaping.
  const domFragment = data && data.dom != null ? ` — median days on market ${data.dom}` : "";
  const freeData = data
    ? `Here's what's happening in ${locationName} right now: ${data.sold12mo} homes sold in the last 12 months — typical sold price ~${fullPrice(data.typicalPrice)}${domFragment}. Prices move street by street, and your home's exact value depends on its type, size, and condition — but this is the real local baseline, not a national estimate.`
    : `${locationName} is one of Milton's smaller, tightly-held pockets — homes here don't change hands often, which makes public averages misleading. That's exactly why a real, address-specific read matters more here than anywhere: a handful of sales can't tell you what your home is worth, but 15 years of selling across Milton can.`;

  const ask = `Want your home's specific value? Enter your address and I'll send you a personal valuation — grounded in ${locationName} sold data, not an algorithm's guess.`;
  const trust = `Aamir Yaqoob — RE/MAX Hall of Fame — 15+ years in Milton — $57M+ in local sales, 165+ Milton families. Your valuation comes from someone who actually sells in ${locationName}, not a call centre.`;

  return (
    <div className="sell-v2">
      <SiteNav variant="page" />

      <section className="s-hero">
        {/* Mobile-first single column (not the /sell two-col hero grid). */}
        <div className="s-wrap v-col">
          <span className="s-eyebrow">{locationName}, {config.CITY_NAME}</span>
          <h1>
            See Your Home&apos;s <em>Value</em>
          </h1>

          {/* FREE DATA (grounded) or NUMBER-FREE editorial (sub-k) — no gate. */}
          <p className="s-lede">{freeData}</p>

          {/* The ask — both variants. */}
          <p className="v-ask">{ask}</p>

          {/* Reused form, VERBATIM. mlsNumber="" (no originating listing);
              source tags every lead as door-hanger; theme forest matches. */}
          <div id="valuation" className="v-form">
            <Suspense fallback={null}>
              <HomeValuationCard
                mlsNumber=""
                source="doorhanger-valuation"
                theme="forest"
                kicker={`${locationName}, ${config.CITY_NAME}`}
                title="See your home's value"
                ctaLabel="Send me my valuation"
                hint="Aamir prepares every valuation by hand from local sold data. You'll get a written report by email within 24 business hours."
              />
            </Suspense>
          </div>

          {/* Trust close — both variants. */}
          <p className="v-trust">{trust}</p>

          <div className="s-hero-ctas">
            <a href={`tel:${config.realtor.phoneE164}`} className="s-cta-sec">
              📞 Call or text {config.realtor.phone}
            </a>
            <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="s-cta-sec">
              💬 WhatsApp {FIRST_NAME}
            </a>
          </div>
        </div>
      </section>

      <FooterSection />
    </div>
  );
}

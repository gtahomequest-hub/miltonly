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
// MC-046 Stage 1 (PropTx VOW Best Practices item 40). The page used to open on "N homes sold
// in the last 12 months, typical sold price ~$X, median days on market D", all derived from
// VOW records, and its thin-pool variant on "homes here don't change hands often", a claim
// derived from the same records. Every figure is gone and there is one figure-free lede for
// every location; the sold block's place carries the neutral line. The route is noindex, follow.

import { Suspense } from "react";
import SiteNav from "@/components/nav/SiteNav";
import type { MegaLive } from "@/components/nav/megaTypes";
import HomeValuationCard from "@/components/landing/HomeValuationCard";
import SiteFooter from "@/components/nav/SiteFooter";
import SoldHistoryLine from "@/components/vow/SoldHistoryLine";
import { config } from "@/lib/config";

export interface ValueLandingProps {
  /** Display name of the location (neighbourhood now; street later). The registry name. */
  locationName: string;
  /** The portal's sold view for the location, for the neutral line (e.g. /sold?nbhd=<slug>). */
  soldViewHref?: string;
  /** This page's own path, the sign-in return when there is no sold view. */
  returnPath: string;
  /** the menu's live content, read by the server page; absent renders the rails */
  live?: MegaLive;
}

const FIRST_NAME = config.realtor.name.split(" ")[0];
const WHATSAPP_URL = `https://wa.me/${config.realtor.phoneE164.replace("+", "")}`;

export default function ValueLanding({ locationName, soldViewHref, returnPath, live }: ValueLandingProps) {
  // One figure-free lede for every location. Built as JS strings (not JSX text) so apostrophes
  // need no escaping.
  const lede = `Every home in ${locationName} is its own case: the street, the type, the size, the lot and the condition all count. A written, address-specific valuation from someone who sells here reads all of that; a national estimate reads none of it.`;

  const ask = `Want your home's specific value? Enter your address and I'll send you a personal valuation, prepared by hand for your address, not an algorithm's guess.`;
  const trust = `Aamir Yaqoob, RE/MAX Hall of Fame, 15+ years in Milton, $57M+ in local sales, 235+ families helped. Your valuation comes from someone who actually sells in ${locationName}, not a call centre.`;

  return (
    <div className="sell-v2">
      <SiteNav variant="page" live={live} />

      <section className="s-hero">
        {/* Mobile-first single column (not the /sell two-col hero grid). */}
        <div className="s-wrap v-col">
          <span className="s-eyebrow">{locationName}, {config.CITY_NAME}</span>
          <h1>
            See Your Home&apos;s <em>Value</em>
          </h1>

          {/* MC-046: figure-free for every location; the neutral line where the sold block was. */}
          <p className="s-lede">{lede}</p>
          <SoldHistoryLine subject={locationName} soldViewHref={soldViewHref} returnPath={returnPath} tone="dark" className="mb-5" />

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

      <SiteFooter />
    </div>
  );
}

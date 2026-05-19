import { generateMetadata as genMeta } from "@/lib/seo";
import { config } from "@/lib/config";
import HeroSection from "./_components/HeroSection";
import VideoIntroSection from "./_components/VideoIntroSection";
import ServiceAreaSection from "./_components/ServiceAreaSection";
import ContactFormSection from "./_components/ContactFormSection";
import FAQSection from "./_components/FAQSection";
import AboutStickyBar from "./_components/AboutStickyBar";
import type { FAQItem, IntentOption, Stat } from "./_components/_types";

// /about page — rebuild in flight on feat/about-world-class branch.
// Locked framing per DEC-ABOUT-CANONICAL 2026-05-19: Ontario-wide
// service with Milton as a home-base anchor only (never a boundary).
//
// This file is pure orchestration: pulls realtor + metrics + service
// area from config, composes section props, and renders in order.
// Each section is parameterised — the same components compose a
// future Homesly fork (Oakville, Mississauga, etc.) by swapping
// config values only.
//
// Gate status (post Gate 3-8, partial):
//   Hero          ✓ Gate 3 — visual built, stats render "—" for null
//   VideoIntro    ✓ Gate 4 — poster placeholder, video swap pending B12
//   ServiceArea   ✓ Gate 5 — Ontario embed + view tracking
//   Proof         pending — testimonials require Aamir + PIPEDA consent
//   HowIWork      pending — copy review for Ontario framing
//   Bio           pending — bio interview required
//   ContactForm   ✓ Gate 7 — UI only; submit stubbed until D2 lands
//   FAQ          ✓ Gate 8 — placeholder Q/A; answers pending Aamir
//   StickyBar     ✓ Gate 1 — visible after scrolling past hero

export const metadata = genMeta({
  title: `About ${config.realtor.name} — RE/MAX Hall of Fame Realtor Serving Ontario`,
  description: `${config.realtor.name}, RE/MAX Hall of Fame realtor based in ${config.realtor.areaServed.primaryCity}. ${config.realtor.yearsExperience} years serving buyers, sellers, and tenants across ${config.realtor.areaServed.licensedRegion}. Talk to Aamir today.`,
  canonical: `${config.SITE_URL}/about`,
});

const REALTOR_FIRST_NAME = config.realtor.name.split(" ")[0];

// Compose the hero subhead from config so all three tokens stay in
// lockstep with config.realtor.* — never inline literal copy here.
const heroSubhead =
  `${config.realtor.awards[0]} realtor · ` +
  `Serving all of ${config.realtor.areaServed.licensedRegion} · ` +
  `${config.realtor.yearsExperience} years from ${config.realtor.areaServed.primaryCity}`;

// Stat tiles — "—" placeholder for any null metric per gate spec.
// totalVolumeClosed is currently "$57.5M" (A1 confirmed). Others null
// until Aamir resolves A2/A4/A5 unique-vs-repeat and review counts.
function buildHeroStats(): Stat[] {
  const m = config.realtor.metrics;
  return [
    { label: "closed", value: m.totalVolumeClosed ?? "—" },
    {
      label: "transactions",
      value: m.transactionCount !== null ? String(m.transactionCount) : "—",
    },
    {
      label: `years in ${config.realtor.areaServed.primaryCity}`,
      value: m.yearsInMilton !== null ? String(m.yearsInMilton) : "—",
    },
    {
      label: "Google rating",
      value: m.googleRating !== null ? `${m.googleRating}★` : "—",
      sub:
        m.googleReviewsCount !== null
          ? `${m.googleReviewsCount} reviews`
          : "reviews coming soon",
    },
  ];
}

// Inquiry-type radio options per D2. Submitted to /api/leads as
// inquiryType under the general-inquiry intent branch (validator
// extension pending, tracked as a parallel workstream).
const INTENT_OPTIONS: IntentOption[] = [
  { value: "buying", label: "Buying a home" },
  { value: "selling", label: "Selling a home" },
  { value: "renting", label: "Renting a home" },
  { value: "listing-for-rent", label: "Listing my home for rent" },
  { value: "learning-more", label: "Just learning more" },
];

// FAQ placeholders. Questions are the locked starting set; answers are
// intentional placeholders for Aamir to confirm (PIPEDA + RECO + brokerage
// review apply). Schema.org FAQPage injection deferred to schema gate.
const FAQ_PLACEHOLDERS: FAQItem[] = [
  {
    id: "response-time",
    question: "How fast do you respond?",
    answer: `${REALTOR_FIRST_NAME} replies under 60 min during business hours (9am – 9pm ET, 7 days). Full answer pending Aamir review.`,
  },
  {
    id: "commission",
    question: "What's your commission?",
    answer: "Pending Aamir review. Commission discussion happens once Aamir understands your specific transaction — call or text for details.",
  },
  {
    id: "first-time-buyers",
    question: "Do you work with first-time buyers?",
    answer: "Pending Aamir review.",
  },
  {
    id: "sell-and-buy",
    question: "Can you help me sell and buy at the same time?",
    answer: "Pending Aamir review.",
  },
  {
    id: "outside-milton",
    question: `What if I'm moving from outside ${config.realtor.areaServed.primaryCity}?`,
    answer: `${REALTOR_FIRST_NAME} serves buyers, sellers, and tenants across ${config.realtor.areaServed.licensedRegion}. ${config.realtor.areaServed.primaryCity} is where market data is deepest; same standards apply anywhere in the province. Full answer pending Aamir review.`,
  },
];

export default function AboutPage() {
  return (
    <>
      <HeroSection
        name={config.realtor.name}
        subhead={heroSubhead}
        stats={buildHeroStats()}
        primaryCta={{
          label: `Talk to ${REALTOR_FIRST_NAME} now`,
          href: "#about-contact",
        }}
        secondaryCta={{
          label: `📞 ${config.realtor.contact.phoneDisplay}`,
          href: `tel:${config.realtor.contact.phoneE164}`,
        }}
        headshotPath=""
        headshotAlt={`${config.realtor.name} headshot`}
        badgeLabel={`${config.realtor.awards[0]}`}
      />

      <VideoIntroSection
        videoPath={null}
        posterPath=""
        posterAlt={`${REALTOR_FIRST_NAME} on camera`}
        captionsPath={null}
        transcript=""
        eyebrow="60-second intro"
        heading={`Meet ${REALTOR_FIRST_NAME}`}
      />

      <ServiceAreaSection
        primaryCity={config.realtor.areaServed.primaryCity}
        licensedRegion={config.realtor.areaServed.licensedRegion}
        display={config.realtor.areaServed.serviceAreaDisplay}
        subtext={config.realtor.areaServed.serviceAreaSubtext}
      />

      <ContactFormSection
        source="about-page-direct-contact"
        leadValue={3000}
        intentOptions={INTENT_OPTIONS}
        phoneDisplay={config.realtor.contact.phoneDisplay}
        phoneE164={config.realtor.contact.phoneE164}
        whatsappE164={config.realtor.contact.whatsapp}
        email={config.realtor.contact.email}
        eyebrow="Direct contact"
        heading={`Talk to ${REALTOR_FIRST_NAME}`}
        subheading={config.sla.topFormSubline}
      />

      <FAQSection
        questions={FAQ_PLACEHOLDERS}
        eyebrow="Questions and answers"
        heading="Common questions"
      />

      <AboutStickyBar
        phoneDisplay={config.realtor.contact.phoneDisplay}
        phoneE164={config.realtor.contact.phoneE164}
        whatsappE164={config.realtor.contact.whatsapp}
      />
    </>
  );
}

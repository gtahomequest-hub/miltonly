import SchemaScript from "@/components/SchemaScript";
import {
  generateLocalBusinessSchema,
  generateWebSiteSchema,
  generateFAQSchema,
  generateBreadcrumbSchema,
} from "@/lib/schema";
import { homepageFAQs } from "@/lib/faqs";

import HeroSection from "@/components/sections/HeroSection";
import TrustBarSection from "@/components/sections/TrustBarSection";
import QuickSearchPills from "@/components/sections/QuickSearchPills";
import IntelligenceCentre from "@/components/sections/IntelligenceCentre";
import FeaturedListings from "@/components/sections/FeaturedListings";
import BuyerAlertSection from "@/components/sections/BuyerAlertSection";
import MapSection from "@/components/sections/MapSection";
import SchoolGoSection from "@/components/sections/SchoolGoSection";
import NeighbourhoodSection from "@/components/sections/NeighbourhoodSection";
import SellerSection from "@/components/sections/SellerSection";
import InvestorSection from "@/components/sections/InvestorSection";
import SocialProofSection from "@/components/sections/SocialProofSection";
import FAQSection from "@/components/sections/FAQSection";
import PartnerSection from "@/components/sections/PartnerSection";
import FooterSection from "@/components/sections/FooterSection";

export default function HomePage() {
  const schemas = [
    generateLocalBusinessSchema(),
    generateWebSiteSchema(),
    generateFAQSchema(homepageFAQs),
    generateBreadcrumbSchema([
      { name: "Milton Real Estate", url: "https://miltonly.com" },
    ]),
  ];

  return (
    <>
      <SchemaScript schemas={schemas} />
      <main>
        <HeroSection />
        <TrustBarSection />
        <QuickSearchPills />
        <IntelligenceCentre />
        <FeaturedListings />
        <BuyerAlertSection />
        <MapSection />
        <SchoolGoSection />
        <NeighbourhoodSection />
        <SellerSection />
        <InvestorSection />
        <SocialProofSection />
        <FAQSection />
        <PartnerSection />
        <FooterSection />
      </main>
    </>
  );
}

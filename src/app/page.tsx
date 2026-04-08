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
      </main>
      <FooterSection />
    </>
  );
}

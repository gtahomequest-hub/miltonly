import SchemaScript from "@/components/SchemaScript";
import {
  generateLocalBusinessSchema,
  generateWebSiteSchema,
  generateFAQSchema,
  generateBreadcrumbSchema,
} from "@/lib/schema";
import { homepageFAQs } from "@/lib/faqs";
import { getHeroStats, getFeaturedListings, getPropertyTypeStats } from "@/lib/stats";

import HeroSection from "@/components/sections/HeroSection";
import TrustBarSection from "@/components/sections/TrustBarSection";
import IntelligenceCentre from "@/components/sections/IntelligenceCentre";
import ExclusiveStrip from "@/components/sections/ExclusiveStrip";
import FeaturedListings from "@/components/sections/FeaturedListings";
import SeoLinkGrid from "@/components/sections/SeoLinkGrid";
import FooterSection from "@/components/sections/FooterSection";

export default async function HomePage() {
  const [stats, featured, typeStats] = await Promise.all([
    getHeroStats(),
    getFeaturedListings(),
    getPropertyTypeStats(),
  ]);

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
        <HeroSection stats={stats} typeStats={typeStats} />
        <TrustBarSection stats={stats} />
        <IntelligenceCentre />
        <ExclusiveStrip />
        <FeaturedListings listings={featured} />
        <SeoLinkGrid />
      </main>
      <FooterSection />
    </>
  );
}

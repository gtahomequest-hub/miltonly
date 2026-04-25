import SchemaScript from "@/components/SchemaScript";
import {
  generateLocalBusinessSchema,
  generateWebSiteSchema,
  generateFAQSchema,
  generateBreadcrumbSchema,
} from "@/lib/schema";
import { homepageFAQs } from "@/lib/faqs";
import { getHeroStats, getFeaturedListings, getPropertyTypeStats, getTrendingStreets } from "@/lib/stats";
import { getMiltonSoldTotals } from "@/lib/sold-data";

import HeroSection from "@/components/sections/HeroSection";
import TrustBarSection from "@/components/sections/TrustBarSection";
import IntelligenceCentre from "@/components/sections/IntelligenceCentre";
import ExclusiveStrip from "@/components/sections/ExclusiveStrip";
import FeaturedListings from "@/components/sections/FeaturedListings";
import MortgageCalculator from "@/components/sections/MortgageCalculator";
import SoldOnMyStreet from "@/components/sections/SoldOnMyStreet";
import SeoLinkGrid from "@/components/sections/SeoLinkGrid";
import PreFooterCTA from "@/components/sections/PreFooterCTA";
import FooterSection from "@/components/sections/FooterSection";

export default async function HomePage() {
  const [stats, featured, typeStats, trendingStreets, soldTotals] = await Promise.all([
    getHeroStats(),
    getFeaturedListings(),
    getPropertyTypeStats(),
    getTrendingStreets(),
    getMiltonSoldTotals().catch(() => ({ last30: 0, last90: 0 })),
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
        <HeroSection stats={stats} typeStats={typeStats} trendingStreets={trendingStreets} />
        <TrustBarSection stats={stats} soldLast30={soldTotals.last30} />
        <IntelligenceCentre />
        <ExclusiveStrip />
        <FeaturedListings listings={featured} />
        <MortgageCalculator />
        <SoldOnMyStreet />
        <SeoLinkGrid />
      </main>
      <PreFooterCTA />
      <FooterSection />
    </>
  );
}

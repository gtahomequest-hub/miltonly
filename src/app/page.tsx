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
import PartnerSection from "@/components/sections/PartnerSection";
import FooterSection from "@/components/sections/FooterSection";

export default function HomePage() {
  return (
    <main>
      {/* Section 1: Navbar is in layout.tsx */}
      {/* Section 2 */}
      <HeroSection />
      {/* Section 3 */}
      <TrustBarSection />
      {/* Section 4 */}
      <QuickSearchPills />
      {/* Section 5 */}
      <IntelligenceCentre />
      {/* Section 6 */}
      <FeaturedListings />
      {/* Section 7 */}
      <BuyerAlertSection />
      {/* Section 8 */}
      <MapSection />
      {/* Section 9 */}
      <SchoolGoSection />
      {/* Section 10 */}
      <NeighbourhoodSection />
      {/* Section 11 */}
      <SellerSection />
      {/* Section 12 */}
      <InvestorSection />
      {/* Section 13 */}
      <SocialProofSection />
      {/* Section 14 */}
      <PartnerSection />
      {/* Section 15: Final CTA + Footer */}
      <FooterSection />
    </main>
  );
}

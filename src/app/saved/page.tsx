import { generateMetadata as genMeta } from "@/lib/seo";
import { config } from "@/lib/config";
import SavedDashboard from "./SavedDashboard";
import SiteChrome from "@/components/nav/SiteChrome";

export const metadata = genMeta({
  title: `Saved Listings & Alerts — ${config.SITE_NAME}`,
  description: `View your saved ${config.CITY_NAME} real estate listings, manage search alerts, and track new matches.`,
  canonical: `${config.SITE_URL}/saved`,
});

export default function SavedPage() {
  return (
    <SiteChrome>
      <SavedDashboard />
    </SiteChrome>
  );
}

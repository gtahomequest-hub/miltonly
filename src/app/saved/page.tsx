import { generateMetadata as genMeta } from "@/lib/seo";
import SavedDashboard from "./SavedDashboard";

export const metadata = genMeta({
  title: "Saved Listings & Alerts — Miltonly",
  description: "View your saved Milton real estate listings, manage search alerts, and track new matches.",
  canonical: "https://miltonly.com/saved",
});

export default function SavedPage() {
  return <SavedDashboard />;
}

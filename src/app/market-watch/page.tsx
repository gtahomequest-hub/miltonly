// src/app/market-watch/page.tsx
// MARKET WATCH AFTER MC-046 STAGE 1 (R6, R4). The weekly edition was sold statistics derived from
// VOW records, so its figures, summary, interpretation and edition content left the page for
// everyone. The page stays a 200 with its heading and the neutral line, is `noindex, follow`, is out
// of the sitemap, and its head carries no figure. It reads no MarketEdition row at all.
import type { Metadata } from "next";
import { generateMetadata as genMeta } from "@/lib/seo";
import { config } from "@/lib/config";
import MarketWatchPage from "@/components/marketwatch/MarketWatchPage";
import SiteNavLive from "@/components/nav/SiteNavLive";
import SiteFooter from "@/components/nav/SiteFooter";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const meta = genMeta({
    title: `${config.CITY_NAME} Market Watch`,
    description: `${config.CITY_NAME} Market Watch, ${config.CITY_PROVINCE}. Sold history is for registered readers; ${config.CITY_NAME} homes for sale and for lease are open to everyone.`,
    canonical: `${config.SITE_URL}/market-watch`,
  });
  return { ...meta, robots: { index: false, follow: true } };
}

export default function MarketWatchIndex() {
  return (
    <>
      <SiteNavLive variant="page" />
      <MarketWatchPage />
      <SiteFooter />
    </>
  );
}

import SchemaScript from "@/components/SchemaScript";
import {
  generateLocalBusinessSchema,
  generateOrganizationSchema,
  generateWebSiteSchema,
  generateFAQSchema,
  generateBreadcrumbSchema,
} from "@/lib/schema";
import { homepageFAQs } from "@/lib/faqs";
import { config } from "@/lib/config";
import { getHomepageData, buildMegaLive } from "@/lib/homepageData";
import { getBoardData } from "@/lib/board/boardData";
import HomePage from "@/components/home/HomePage";

// TITLE AND CANONICAL, SET HERE RATHER THAN INHERITED (Brain's pick, 2026-09-10).
//
// The homepage was serving the root layout's fallback: 101 characters, ending in
// " | Miltonly". The layout's own comment records that this length was measured as harmful
// on street pages, where it pushed 298 of 431 titles past Google's cut, and that Google
// takes the site-name line from og:site_name rather than from the title tag — so the
// suffix costs characters and buys nothing. 39 characters replaces it, and the canonical
// is now DECLARED for "/" instead of arriving by layout inheritance.
export const metadata = {
  title: "Milton Homes for Sale, Street by Street",
  alternates: { canonical: config.SITE_URL },
};

// Live Milton stats render per request; also keeps the homepage off the static
// prerender path (the global Navbar is already suppressed on "/" via ChromeGate).
export const dynamic = "force-dynamic";

export default async function Page() {
  const [data, board] = await Promise.all([getHomepageData(), getBoardData()]);
  // The nav's live panels are composed from data the page already has — no second
  // query, and the sell panel reads the SAME Board row the Board renders below it.
  const mega = buildMegaLive(data, board);

  const schemas = [
    generateOrganizationSchema(),
    generateLocalBusinessSchema(),
    generateWebSiteSchema(),
    generateFAQSchema(homepageFAQs),
    generateBreadcrumbSchema([{ name: `${config.CITY_NAME} Real Estate`, url: config.SITE_URL }]),
  ];

  return (
    <>
      <SchemaScript schemas={schemas} />
      <HomePage data={data} board={board} mega={mega} />
    </>
  );
}

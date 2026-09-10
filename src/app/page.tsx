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

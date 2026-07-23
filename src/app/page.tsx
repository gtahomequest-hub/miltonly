import SchemaScript from "@/components/SchemaScript";
import {
  generateLocalBusinessSchema,
  generateWebSiteSchema,
  generateFAQSchema,
  generateBreadcrumbSchema,
} from "@/lib/schema";
import { homepageFAQs } from "@/lib/faqs";
import { config } from "@/lib/config";
import { getHomepageData } from "@/lib/homepageData";
import { getBoardData } from "@/lib/board/boardData";
import HomePage from "@/components/home/HomePage";

// Live Milton stats render per request; also keeps the homepage off the static
// prerender path (the global Navbar is already suppressed on "/" via ChromeGate).
export const dynamic = "force-dynamic";

export default async function Page() {
  const [data, board] = await Promise.all([getHomepageData(), getBoardData()]);

  const schemas = [
    generateLocalBusinessSchema(),
    generateWebSiteSchema(),
    generateFAQSchema(homepageFAQs),
    generateBreadcrumbSchema([{ name: `${config.CITY_NAME} Real Estate`, url: config.SITE_URL }]),
  ];

  return (
    <>
      <SchemaScript schemas={schemas} />
      <HomePage data={data} board={board} />
    </>
  );
}

import type { MetadataRoute } from "next";
import { config } from "@/lib/config";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin/", "/signin", "/streets-terminal-preview"] },
    sitemap: `${config.SITE_URL}/sitemap.xml`,
  };
}

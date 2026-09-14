// src/app/sitemap-index.xml/route.ts
//
// The sitemap index (MC-015): /sitemap.xml (every page, Next's own sitemap.ts) and
// /sitemap-video.xml (every page carrying a clip, once per clip). sitemap.ts emits one urlset
// and cannot name a sibling file, so the index lives here and robots.ts points at it; the two
// child files keep their URLs, which Search Console and the battery already read.

import { config } from "@/lib/config";

export const dynamic = "force-dynamic";

export function GET() {
  const now = new Date().toISOString();
  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    `  <sitemap><loc>${config.SITE_URL}/sitemap.xml</loc><lastmod>${now}</lastmod></sitemap>\n` +
    `  <sitemap><loc>${config.SITE_URL}/sitemap-video.xml</loc><lastmod>${now}</lastmod></sitemap>\n` +
    `</sitemapindex>\n`;
  return new Response(xml, {
    headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
  });
}

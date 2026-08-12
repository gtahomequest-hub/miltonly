import type { MetadataRoute } from "next";
import { config } from "@/lib/config";

// THE ONLY robots source. public/robots.txt was deleted: with both present the ROUTE wins, so the
// static file was dead code — and its `Disallow: /api/` was silently unenforced for as long as both
// existed. Verified against the live file before changing anything (it carried the route's rules,
// including the capitalised "User-Agent:" that Next emits, not the static file's lowercase form).
//
// The disallows below close ~986 crawl paths the site generates for itself, measured in GSC:
//   /signin   670 URLs — one per VOW gate CTA, each carrying a unique redirect/intent/street triple
//   /listings 116 URLs — the filter param space (?page, ?maxPrice, ?type&beds&page, ?neighbourhood)
//   /sold     200 URLs — the filter chips
// Canonical tags consolidate AFTER a crawl is spent; robots prevents the spend. The pages
// themselves (/signin, /listings, /sold) stay crawlable — only their PARAM space is closed.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin/",
        "/api/",     // was only ever in the dead static file
        "/signin",   // matches /signin and every /signin?... permutation
        "/listings?", // the param space only — /listings and /listings/<mls> stay crawlable
        "/sold?",     // ditto for /sold
        "/rentals?",
      ],
    },
    sitemap: `${config.SITE_URL}/sitemap.xml`,
  };
}

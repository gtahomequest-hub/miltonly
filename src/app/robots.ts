import type { MetadataRoute } from "next";
import { config } from "@/lib/config";

// THE ONLY robots source. public/robots.txt was deleted: with both present the ROUTE wins, so the
// static file was dead code — and its `Disallow: /api/` was silently unenforced for as long as both
// existed. Verified against the live file before changing anything (it carried the route's rules,
// including the capitalised "User-Agent:" that Next emits, not the static file's lowercase form).
//
// TWO DIFFERENT CRAWL-BUDGET STRATEGIES, one per problem shape:
//
//   /signin — worthless to index at ANY param (auth wall, infinite redirect/intent/street
//     permutations). Hard-block here + rel="nofollow" on every CTA that links it (VowGate,
//     the sold islands, the sold hub) so Google stops discovering them. Nothing of value is
//     lost by never crawling it.
//
//   /listings? and /sold? — faceted browse. Their PARAM variants must NOT be blocked: a
//     robots-blocked URL can still sit in the index as a zombie because Google can't fetch it
//     to read the rel=canonical / noindex that would drop it. So these stay CRAWLABLE and the
//     pages self-demote instead — every filtered variant emits rel=canonical to the clean base
//     and robots `noindex, follow` (see generateMetadata in each page). Google crawls once,
//     drops it from the index, follows the links out, and consolidates. Pagination stays
//     crawlable and canonicalised. (Was: "/listings?" + "/sold?" disallowed here — removed,
//     because the block was preventing the very canonical it was meant to let consolidate.)
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin/",
        "/api/",     // was only ever in the dead static file
        "/signin",   // matches /signin and every /signin?... permutation
        "/rentals?",
      ],
    },
    sitemap: `${config.SITE_URL}/sitemap.xml`,
  };
}

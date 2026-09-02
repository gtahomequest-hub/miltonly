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
//     permutations). rel="nofollow" now covers every LIVE CTA that links it: the sitewide
//     Navbar (desktop + mobile), the sold hub, the listings-v2 gate, the v2 street sold
//     island, the listing-detail VOW teaser, and the /saved empty state. (An earlier note
//     here credited VowGate and the v1 street island — both are dead code, zero importers,
//     so their nofollows render nothing. The two anchors that actually mint URLs were the
//     ones this comment claimed were already covered.)
//
//     THE DISALLOW IS NOW GONE — deliberately, and this is the second half of a two-step.
//     Step 1 (shipped 0e1871d) nofollowed the last two anchors that minted these URLs, the
//     worst being ListingExtras' VOW teaser, which emitted one /signin?redirect=/listings/<mls>
//     per listing. Removing the block before that would have re-opened an inventory-scaled
//     generator to crawling; removing it after is safe, and it is the ONLY way the page's
//     noindex becomes readable. A blocked URL cannot be de-indexed — the same reasoning
//     applied to /listings? and /sold? below.
//
//     Confirmed before doing this: GSC URL Inspection on /signin?redirect=/listings/W13448534
//     (a listing first seen 2026-06-16, one day AFTER the block) returned "URL is unknown to
//     Google" — never crawled, no referring page. So the block WAS holding and the ~1,150 URLs
//     in "Alternate page with proper canonical tag" are frozen pre-block history, explained by
//     the canonical that has been on /signin since 2026-04-10. They are not indexed and cost no
//     crawl budget. Unblocking lets them be re-fetched once, read the noindex, and drop out.
//     Expect a small one-time crawl of a tiny auth form, not a budget drain — the URL space no
//     longer grows now that the anchors are nofollowed. This is report hygiene, not urgent.
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
        "/rentals?",
      ],
    },
    sitemap: `${config.SITE_URL}/sitemap.xml`,
  };
}

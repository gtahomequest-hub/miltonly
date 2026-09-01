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
//     THE DISALLOW BELOW AND THE PAGE'S noindex ARE MUTUALLY EXCLUSIVE, NOT REDUNDANT.
//     Google cannot read a noindex on a URL it is forbidden to fetch — the same trap this
//     file avoids for /listings? and /sold? below. The block is kept ON PURPOSE for now:
//     removing it while ListingExtras still minted one /signin URL per listing would have
//     re-opened an inventory-scaled generator to crawling. Now that the anchors are fixed,
//     dropping "/signin" from the disallow is the follow-up deploy — that is the only way
//     the ~1,150 URLs sitting in GSC's "Alternate page with proper canonical tag" bucket
//     can migrate to "Excluded by noindex" and drop out. Sequence it, never simultaneous.
//
//     Note those URLs are NOT indexed and cost no crawl budget while blocked; the canonical
//     has been on /signin since 2026-04-10, two months before this block (2026-06-15), so
//     that bucket is fully explained by pre-block crawls. Confirm with GSC URL Inspection ->
//     "Last crawl" before touching the rule: a date after 2026-06-15 would mean the block
//     is not holding and should come out immediately.
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

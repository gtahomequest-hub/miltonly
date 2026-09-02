/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      { source: "/sold/:slug", destination: "/streets/:slug", permanent: true },
      // Dead marketing paths with clear intent, 404ing and discarding whatever signal they carry.
      // Nothing in src/ emits either any more — they are historic/external. /mo and /10 are NOT
      // redirected: they are artifacts (a truncated "$X / mo" rent string and a pagination
      // fragment) with no destination a user could have meant, so they keep 404ing.
      { source: "/buy", destination: "/listings", permanent: true },
      { source: "/build-wealth", destination: "/listings", permanent: true },
      // Google Ads property-type landing pages — temporary 302 redirects to the
      // single /rentals/ads page until dedicated per-property-type pages ship.
      // ?type= preserves the intent for analytics + future form pre-filling.
      // Use permanent:false so browsers don't cache after dedicated pages land.
      { source: "/rentals/condo",     destination: "/rentals/ads?type=condo",     permanent: false },
      { source: "/rentals/detached",  destination: "/rentals/ads?type=detached",  permanent: false },
      { source: "/rentals/semi",      destination: "/rentals/ads?type=semi",      permanent: false },
      { source: "/rentals/townhouse", destination: "/rentals/ads?type=townhouse", permanent: false },
      // Step-4-proper registry cleanup (2026-07): published bad slugs (dupes/typos/
      // mis-suffixed) 301 to their OFFICIAL registry slug. Their entities + StreetContent
      // are retired at the same merge that ships these redirects.
      { source: "/streets/miltonbrock-crescent-milton", destination: "/streets/miltonbrook-crescent-milton", permanent: true },
      { source: "/streets/1-line-milton", destination: "/streets/first-line-milton", permanent: true },
      { source: "/streets/mcdougall-cross-milton", destination: "/streets/mcdougall-crossing-milton", permanent: true },
      // DEC-NAME-SOURCE Build 1 — the remaining published slugs with no registry row. Each was
      // checked against BOTH the Town registry and the Town centreline layer (townRoadFacts):
      //   wood-close-n-a          slug carries fossilised "N/A" junk; WOOD CLOSE is a registry row
      //                           and wood-close-milton is already published — a live duplicate.
      //   first-line-nassagaweya-line  trailing type word doubled; FIRST LINE NASSAGAWEYA is a
      //                           registry row and is already published — also a live duplicate.
      //   clitherow-drive         the Town lists CLITHEROW STREET only, and its centreline layer
      //                           has "clitherow||street" (5 segments) and no clitherow||drive.
      //   jarrett-cross           the Town lists JARRETT CROSSING only; "jarrett||crossing" appears
      //                           in the centreline layer as a neighbour of dalgleish||garden and
      //                           duncan||lane. Same shape as the mcdougall-cross fix above.
      // NOTE: jarrett-crossing-milton has no StreetContent row yet, so it renders via
      // dynamicParams and is absent from the sitemap. The four source rows still need retiring
      // (status -> unpublished) at merge, per the precedent noted above, or the sitemap will keep
      // listing URLs that 301.
      { source: "/streets/wood-close-n-a-milton", destination: "/streets/wood-close-milton", permanent: true },
      { source: "/streets/first-line-nassagaweya-line-milton", destination: "/streets/first-line-nassagaweya-milton", permanent: true },
      { source: "/streets/clitherow-drive-milton", destination: "/streets/clitherow-street-milton", permanent: true },
      { source: "/streets/jarrett-cross-milton", destination: "/streets/jarrett-crossing-milton", permanent: true },
      { source: "/streets/pineview-trail-milton", destination: "/streets/pine-view-trail-milton", permanent: true },
      { source: "/streets/watercres-way-milton", destination: "/streets/watercress-way-milton", permanent: true },
      { source: "/streets/weller-cross-milton", destination: "/streets/weller-crossing-milton", permanent: true },
      { source: "/streets/symons-cross-milton", destination: "/streets/symons-crossing-milton", permanent: true },
      { source: "/streets/fourth-line-nassagaweya-n-a-milton", destination: "/streets/fourth-line-nassagaweya-milton", permanent: true },
      { source: "/streets/hwy-7-n-a-milton", destination: "/streets/highway-7-milton", permanent: true },
      { source: "/streets/sixth-line-nassagaweya-n-a-milton", destination: "/streets/sixth-line-nassagaweya-milton", permanent: true },
      { source: "/streets/campbellville-avenue-milton", destination: "/streets/campbellville-road-milton", permanent: true },
      { source: "/streets/lloyd-landing-n-a-milton", destination: "/streets/lloyd-landing-milton", permanent: true },
      { source: "/streets/wetenhall-landing-n-a-milton", destination: "/streets/wetenhall-landing-milton", permanent: true },
      { source: "/streets/wise-crossing-n-a-milton", destination: "/streets/wise-crossing-milton", permanent: true },
      { source: "/streets/marigold-crescent-milton", destination: "/streets/marigold-court-milton", permanent: true },
      { source: "/streets/nippising-road-milton", destination: "/streets/nipissing-road-milton", permanent: true },
      { source: "/streets/4th-line-nassagaweya-line-milton", destination: "/streets/fourth-line-nassagaweya-milton", permanent: true },
      { source: "/streets/french-gardens-milton", destination: "/streets/french-garden-milton", permanent: true },
      { source: "/streets/first-line-nassagaweya-n-a-milton", destination: "/streets/first-line-nassagaweya-milton", permanent: true },
      { source: "/streets/restivo-line-milton", destination: "/streets/restivo-lane-milton", permanent: true },
      { source: "/streets/nassagaweya-puslinch-n-a-milton", destination: "/streets/nassagaweya-puslinch-townline-milton", permanent: true },
      { source: "/streets/rigo-crossing-crescent-milton", destination: "/streets/rigo-crossing-milton", permanent: true },
    ];
  },
};

export default nextConfig;

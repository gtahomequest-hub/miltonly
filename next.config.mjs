/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      { source: "/sold/:slug", destination: "/streets/:slug", permanent: true },
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

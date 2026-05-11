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
    ];
  },
};

export default nextConfig;

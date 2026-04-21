/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      { source: "/sold/:slug", destination: "/streets/:slug", permanent: true },
    ];
  },
};

export default nextConfig;

import type { MetadataRoute } from "next";
import { config } from "@/lib/config";

// THE ICON SET (MH-005 pre-step). The site served the default Next favicon and a navy manifest
// pointing at two placeholder PNGs. The icon is the wordmark's "M" (Kaushan Script, the nav's
// face) in the brand gradient on the forest ground: favicon.ico at 16, 32 and 48, icon.svg,
// apple-touch-icon at 180, and the two manifest sizes below. Colours are the site tokens.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${config.SITE_NAME}: ${config.CITY_NAME} real estate, street by street`,
    short_name: config.SITE_NAME,
    description: `${config.CITY_NAME}, ${config.CITY_PROVINCE}: homes for sale and rent, every street's prices and sales history, neighbourhood by neighbourhood.`,
    start_url: "/",
    display: "standalone",
    background_color: "#073126",
    theme_color: "#073126",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
  };
}

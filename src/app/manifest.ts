import type { MetadataRoute } from "next";
import { config } from "@/lib/config";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${config.SITE_NAME} — ${config.CITY_NAME} ${config.CITY_PROVINCE} Real Estate`,
    short_name: config.SITE_NAME,
    description: `${config.CITY_NAME} ${config.CITY_PROVINCE}'s only dedicated real estate platform. Homes for sale, street intelligence, and market data.`,
    start_url: "/",
    display: "standalone",
    background_color: "#0A1628",
    theme_color: "#0A1628",
    icons: [
      {
        src: "/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}

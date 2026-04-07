import type { Metadata } from "next";

const SITE_URL = "https://miltonly.com";
const SITE_NAME = "Miltonly";
const DEFAULT_OG_IMAGE = `${SITE_URL}/og-image.jpg`;

interface GenerateMetadataOptions {
  title?: string;
  description?: string;
  canonical?: string;
  ogImage?: string;
  noIndex?: boolean;
  keywords?: string[];
}

export function generateMetadata({
  title,
  description,
  canonical,
  ogImage,
  noIndex = false,
  keywords,
}: GenerateMetadataOptions = {}): Metadata {
  const metaTitle = title
    ? `${title} | ${SITE_NAME}.com`
    : "Milton Ontario Real Estate — Homes For Sale, Street Data & Market Intelligence | Miltonly.com";

  const metaDescription =
    description ??
    "Milton Ontario's only dedicated real estate platform. Search homes for sale, compare streets and neighbourhoods, get your home value, and access street-level market data. Live TREB listings updated daily.";

  const metaCanonical = canonical ?? SITE_URL;
  const metaOgImage = ogImage ?? DEFAULT_OG_IMAGE;

  return {
    title: metaTitle,
    description: metaDescription,
    keywords: keywords ?? [
      "Milton Ontario real estate",
      "Milton homes for sale",
      "Milton real estate listings",
      "Milton Ontario homes",
      "buy home Milton",
      "sell home Milton",
      "Milton real estate market",
      "Milton neighbourhood comparison",
    ],
    alternates: {
      canonical: metaCanonical,
    },
    openGraph: {
      type: "website",
      locale: "en_CA",
      siteName: SITE_NAME,
      title: title ? `${title} | ${SITE_NAME}.com` : `Milton Ontario Real Estate | ${SITE_NAME}.com`,
      description: metaDescription,
      url: metaCanonical,
      images: [
        {
          url: metaOgImage,
          width: 1200,
          height: 630,
          alt: "Miltonly — Milton Ontario real estate platform",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: title ? `${title} | ${SITE_NAME}.com` : `Milton Ontario Real Estate | ${SITE_NAME}.com`,
      description: metaDescription,
      images: [metaOgImage],
    },
    robots: noIndex
      ? { index: false, follow: false }
      : { index: true, follow: true },
  };
}

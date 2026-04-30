import type { Metadata } from "next";
import { config } from "./config";

const DEFAULT_OG_IMAGE = `${config.SITE_URL}/og-image.jpg`;
const REAL_ESTATE_LABEL = `${config.CITY_NAME} ${config.CITY_PROVINCE} Real Estate`;

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
  const metaTitle = title ? title : config.seo.defaultTitleSuffix;

  const metaDescription = description ?? config.seo.defaultDescription;

  const metaCanonical = canonical ?? config.SITE_URL;
  const metaOgImage = ogImage ?? DEFAULT_OG_IMAGE;

  return {
    title: metaTitle,
    description: metaDescription,
    keywords: keywords ?? [...config.seo.keywords],
    alternates: {
      canonical: metaCanonical,
    },
    openGraph: {
      type: "website",
      locale: "en_CA",
      siteName: config.SITE_NAME,
      title: title
        ? `${title} | ${config.SITE_NAME}.com`
        : `${REAL_ESTATE_LABEL} | ${config.SITE_NAME}.com`,
      description: metaDescription,
      url: metaCanonical,
      images: [
        {
          url: metaOgImage,
          width: 1200,
          height: 630,
          alt: `${config.SITE_NAME} — ${REAL_ESTATE_LABEL} platform`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: title
        ? `${title} | ${config.SITE_NAME}.com`
        : `${REAL_ESTATE_LABEL} | ${config.SITE_NAME}.com`,
      description: metaDescription,
      images: [metaOgImage],
    },
    robots: noIndex
      ? { index: false, follow: false }
      : { index: true, follow: true },
  };
}

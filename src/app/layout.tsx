import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Fraunces, Inter, JetBrains_Mono } from "next/font/google";
import Navbar from "@/components/Navbar";
import CrispChat from "@/components/CrispChat";
import GoogleAnalytics from "@/components/GoogleAnalytics";
import UserProvider from "@/components/UserProvider";
import ConsentBanner from "@/components/consent/ConsentBanner";
import ChromeGate from "@/components/ChromeGate";
import AttributionCapture from "@/components/AttributionCapture";
import { config } from "@/lib/config";
import "./globals.css";

const REAL_ESTATE_LABEL = `${config.CITY_NAME} ${config.CITY_PROVINCE} Real Estate`;
const OG_DESCRIPTION = `The only real estate platform built exclusively for ${config.CITY_NAME} ${config.CITY_PROVINCE}. Street intelligence, school zones, GO commute data, and live TREB listings.`;

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  axes: ["opsz"],
  variable: "--font-fraunces",
  display: "swap",
});
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-jetbrains",
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0A1628",
};

export const metadata: Metadata = {
  metadataBase: new URL(config.SITE_URL),
  title: {
    default: `${REAL_ESTATE_LABEL}, Homes For Sale, Street Data & Market Intelligence | ${config.SITE_NAME}`,
    template: `%s | ${config.SITE_NAME}`,
  },
  description: config.seo.defaultDescription,
  keywords: [...config.seo.keywords],
  alternates: {
    canonical: config.SITE_URL,
  },
  openGraph: {
    type: "website",
    locale: "en_CA",
    siteName: config.SITE_NAME,
    title: `${REAL_ESTATE_LABEL} | ${config.SITE_NAME}`,
    description: OG_DESCRIPTION,
    url: config.SITE_URL,
    images: [
      {
        url: `${config.SITE_URL}/og-image.jpg`,
        width: 1200,
        height: 630,
        alt: `${config.SITE_NAME}, ${REAL_ESTATE_LABEL} platform`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${REAL_ESTATE_LABEL} | ${config.SITE_NAME}`,
    description: OG_DESCRIPTION,
    images: [`${config.SITE_URL}/og-image.jpg`],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} ${inter.variable} ${jetbrainsMono.variable} font-sans antialiased`}
      >
        <GoogleAnalytics />
        <AttributionCapture />
        <UserProvider>
          <ChromeGate>
            <Navbar />
          </ChromeGate>
          {children}
          <ChromeGate>
            <CrispChat />
            <ConsentBanner />
          </ChromeGate>
        </UserProvider>
      </body>
    </html>
  );
}

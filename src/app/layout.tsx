import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import Navbar from "@/components/Navbar";
import AgentStrip from "@/components/AgentStrip";
import CrispChat from "@/components/CrispChat";
import GoogleAnalytics from "@/components/GoogleAnalytics";
import "./globals.css";

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

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0A1628",
};

export const metadata: Metadata = {
  metadataBase: new URL("https://miltonly.com"),
  title: {
    default:
      "Milton Ontario Real Estate — Homes For Sale, Street Data & Market Intelligence | Miltonly.com",
    template: "%s | Miltonly.com",
  },
  description:
    "Milton Ontario's only dedicated real estate platform. Search homes for sale, compare streets and neighbourhoods, get your home value, and access street-level market data. Live TREB listings updated daily.",
  keywords: [
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
    canonical: "https://miltonly.com",
  },
  openGraph: {
    type: "website",
    locale: "en_CA",
    siteName: "Miltonly",
    title: "Milton Ontario Real Estate | Miltonly.com",
    description:
      "The only real estate platform built exclusively for Milton Ontario. Street intelligence, school zones, GO commute data, and live TREB listings.",
    url: "https://miltonly.com",
    images: [
      {
        url: "https://miltonly.com/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "Miltonly — Milton Ontario real estate platform",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Milton Ontario Real Estate | Miltonly.com",
    description:
      "The only real estate platform built exclusively for Milton Ontario. Street intelligence, school zones, GO commute data, and live TREB listings.",
    images: ["https://miltonly.com/og-image.jpg"],
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
        className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}
      >
        <GoogleAnalytics />
        <Navbar />
        {children}
        <AgentStrip />
        <CrispChat />
      </body>
    </html>
  );
}

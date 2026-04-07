import type { Metadata } from "next";
import localFont from "next/font/local";
import Navbar from "@/components/Navbar";
import CrispChat from "@/components/CrispChat";
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

export const metadata: Metadata = {
  title: {
    default: "Miltonly — Milton Ontario Real Estate | Homes For Sale, Sold Prices & Market Data",
    template: "%s | Miltonly.com",
  },
  description:
    "Milton Ontario's only dedicated real estate platform. Search homes for sale, sold prices, street intelligence, school zones, GO commute times, and neighbourhood comparisons. Updated daily from TREB.",
  keywords: [
    "Milton homes for sale",
    "Milton Ontario real estate",
    "Milton sold prices",
    "Milton neighbourhood comparison",
    "homes near Milton GO station",
    "Milton school zones",
    "Milton condo buildings",
    "Milton street prices",
    "sell my home Milton",
    "Milton market report",
  ],
  openGraph: {
    type: "website",
    locale: "en_CA",
    siteName: "Miltonly",
    title: "Miltonly — Milton Ontario Real Estate",
    description:
      "Milton Ontario's only dedicated real estate platform. Homes for sale, sold data, street intelligence, and market reports.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Miltonly — Milton Ontario Real Estate",
    description:
      "Milton Ontario's only dedicated real estate platform. Homes for sale, sold data, street intelligence, and market reports.",
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
        <Navbar />
        {children}
        <CrispChat />
      </body>
    </html>
  );
}

import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Fraunces, Inter, JetBrains_Mono, Kaushan_Script, Playfair_Display } from "next/font/google";
import Navbar from "@/components/Navbar";
import CrispChat from "@/components/CrispChat";
import GoogleAnalytics from "@/components/GoogleAnalytics";
import MetaPixel from "@/components/MetaPixel";
import UserProvider from "@/components/UserProvider";
import ConsentBanner from "@/components/consent/ConsentBanner";
import ChromeGate from "@/components/ChromeGate";
import AttributionCapture from "@/components/AttributionCapture";
import { config } from "@/lib/config";
import "./globals.css";

const REAL_ESTATE_LABEL = `${config.CITY_NAME} ${config.CITY_PROVINCE} Real Estate`;
const ENCYCLOPEDIA_LABEL = `${config.CITY_NAME} Real Estate Encyclopedia`;
const OG_DESCRIPTION = `${ENCYCLOPEDIA_LABEL} — the only real estate platform built exclusively for ${config.CITY_NAME} ${config.CITY_PROVINCE}. Street intelligence, school zones, GO commute data, and live TREB listings.`;

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
// Hero headline faces (2026-07-20, Aamir-approved mockup). Bound ONLY via
// their CSS variables — next/font registers hashed family names, so a literal
// "Kaushan Script" / "Playfair Display" declaration binds to nothing (the
// Fraunces lesson, commit de80bcb).
const kaushan = Kaushan_Script({
  subsets: ["latin"],
  weight: "400", // its only weight
  variable: "--font-kaushan",
  display: "swap",
});
const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: "500",
  variable: "--font-playfair",
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0A1628",
};

export const metadata: Metadata = {
  metadataBase: new URL(config.SITE_URL),
  // NO `template` HERE, DELIBERATELY. It used to be `%s | ${config.SITE_NAME}`, which Next appends
  // to every page returning a plain-string title — which is every page, since seo.ts:32 returns one.
  // It cost 11 chars / 84px on all of them and bought nothing: Google sources the site-name line
  // from og:site_name (set below), not from the title tag.
  //
  // Two measured harms. (1) On /streets/[slug] it pushed 298 of 431 titles past Google's ~580px cut;
  // without it, 12. On the long-name tail it ate the copy itself — "Nassagaweya Esquesing Townline"
  // rendered at 768px. (2) Eight routes already embed SITE_NAME in their own title, so they rendered
  // it TWICE: "Sign In — Miltonly | Miltonly", "Milton Rentals | Miltonly | Miltonly", and the same
  // on /saved, /rentals, /sales/ads, /not-found, /coming-soon, /exclusive/[slug].
  //
  // A per-route `title: { absolute }` override was the alternative; it would have fixed the 431 street
  // pages and left those eight still stuttering. 25 routes lose a " | Miltonly" suffix by this deletion,
  // which is the intended trade — none of them needed it. `default` stays: it still covers any page
  // that sets no title of its own.
  // Plain string, not { default, template }: Next's TemplateString type requires `template` beside
  // `default`, and the whole point here is that there is no template. A bare string behaves the same
  // way `default` did — any page that sets no title of its own inherits this one.
  title: `${ENCYCLOPEDIA_LABEL} — ${REAL_ESTATE_LABEL}, Homes For Sale & Street Data | ${config.SITE_NAME}`,
  description: config.seo.defaultDescription,
  keywords: [...config.seo.keywords],
  alternates: {
    canonical: config.SITE_URL,
  },
  openGraph: {
    type: "website",
    locale: "en_CA",
    siteName: config.SITE_NAME,
    title: `${ENCYCLOPEDIA_LABEL} | ${config.SITE_NAME}`,
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
    title: `${ENCYCLOPEDIA_LABEL} | ${config.SITE_NAME}`,
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
        className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} ${inter.variable} ${jetbrainsMono.variable} ${kaushan.variable} ${playfair.variable} font-sans antialiased`}
      >
        <GoogleAnalytics />
        <MetaPixel />
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

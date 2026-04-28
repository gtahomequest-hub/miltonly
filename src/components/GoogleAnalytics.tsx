import Script from "next/script";
import { GA_ID } from "@/lib/analytics";

const AW_ID = (process.env.NEXT_PUBLIC_AW_CONVERSION_ID ?? "").trim();

export default function GoogleAnalytics() {
  if (!GA_ID) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
        strategy="afterInteractive"
      />
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA_ID}');
          ${AW_ID ? `gtag('config', '${AW_ID}');` : ""}
        `}
      </Script>
    </>
  );
}

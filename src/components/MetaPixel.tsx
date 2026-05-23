"use client";

import Script from "next/script";

// Meta Pixel base code. fbq('init') + fbq('track','PageView') run inside
// the inline script the moment it loads — synchronous, no React-side race
// condition for the initial pageview.
//
// Helper events fired AFTER mount (Lead, Contact, etc.) live in
// src/lib/pixel-client.ts and use a setTimeout retry guard for the rare
// case where a slow connection has the inline script still parsing when
// a user already clicks Submit.
//
// Gated by:
//   * NODE_ENV === 'production' (default)
//   * OR NEXT_PUBLIC_META_PIXEL_DEBUG === 'true' (opt-in for local dev)
// so local development doesn't pollute the Pixel with noise.

const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID;

function shouldMount(): boolean {
  if (!PIXEL_ID) return false;
  if (process.env.NODE_ENV === "production") return true;
  if (process.env.NEXT_PUBLIC_META_PIXEL_DEBUG === "true") return true;
  return false;
}

export default function MetaPixel() {
  if (!shouldMount()) return null;

  return (
    <>
      <Script id="meta-pixel-base" strategy="afterInteractive">
        {`
          !function(f,b,e,v,n,t,s)
          {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
          n.callMethod.apply(n,arguments):n.queue.push(arguments)};
          if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
          n.queue=[];t=b.createElement(e);t.async=!0;
          t.src=v;s=b.getElementsByTagName(e)[0];
          s.parentNode.insertBefore(t,s)}(window, document,'script',
          'https://connect.facebook.net/en_US/fbevents.js');
          fbq('init', '${PIXEL_ID}');
          fbq('track', 'PageView');
        `}
      </Script>
      <noscript>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          height="1"
          width="1"
          style={{ display: "none" }}
          src={`https://www.facebook.com/tr?id=${PIXEL_ID}&ev=PageView&noscript=1`}
          alt=""
        />
      </noscript>
    </>
  );
}

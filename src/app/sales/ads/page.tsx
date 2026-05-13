// Bare /sales/ads route — there's no generic sales landing page. Cold ad
// traffic must hit a per-listing /sales/ads/[mlsNumber] URL, so the bare
// URL redirects to /rentals (the existing search index) to recover any
// visitor who manually trimmed the URL. Mirrors the spec for never wasting
// ad spend on dead landing pages.

import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function SalesAdsIndex(): never {
  redirect("/rentals");
}

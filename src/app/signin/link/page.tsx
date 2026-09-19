// /signin/link: where the email's link lands (MP-002).
//
// The token is consumed by a POST from the browser, not by the GET that opened this page.
// Mail scanners and link previews fetch every URL in an email; if the GET itself signed the
// person in, the scanner would spend the one-time token and the person's tap would find it
// dead. The page renders nothing but a spinner and a fallback line; the client half posts the
// token, then navigates to the path the link carried.

import { generateMetadata as genMeta } from "@/lib/seo";
import { config } from "@/lib/config";
import { Suspense } from "react";
import SiteChrome from "@/components/nav/SiteChrome";
import LinkLanding from "./LinkLanding";

export const metadata = genMeta({
  title: `Signing in — ${config.SITE_NAME}`,
  description: `Signing in to ${config.SITE_NAME}.`,
  canonical: `${config.SITE_URL}/signin`,
  noIndex: true,
});

export default function SignInLinkPage() {
  return (
    <SiteChrome>
      <div className="min-h-screen bg-[#fffdfa] flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-[400px]">
          <Suspense fallback={null}>
            <LinkLanding />
          </Suspense>
        </div>
      </div>
    </SiteChrome>
  );
}

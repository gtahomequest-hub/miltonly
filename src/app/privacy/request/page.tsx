// /privacy/request: where a person asks for their personal information to be removed
// (MC-036, VOW Best Practices item 12). A plain server page around one client form; the
// route it posts to is /api/privacy/request and the record is src/lib/privacy/request.ts.

import Link from "next/link";
import { generateMetadata as genMeta } from "@/lib/seo";
import { config } from "@/lib/config";
import SiteChrome from "@/components/nav/SiteChrome";
import { FALLBACK_EMAIL } from "@/lib/privacy/request";
import RequestForm from "./RequestForm";

export const metadata = genMeta({
  title: "Remove my personal information",
  description: `Ask ${config.SITE_NAME} to remove the personal information it holds about you: a form you filled, an alert, an account. One form, a reference by email, a reply when it is done.`,
  canonical: `${config.SITE_URL}/privacy/request`,
});

export default function PrivacyRequestPage() {
  return (
    <SiteChrome>
      <main className="bg-white text-[#073126] min-h-screen py-12 sm:py-16">
        <div className="max-w-3xl mx-auto px-5 sm:px-6">
          <Link href="/privacy" className="text-[13px] text-[#6b6f6a] hover:text-[#073126]">← Privacy policy</Link>

          <h1 className="text-[32px] sm:text-[40px] font-extrabold mt-4 mb-3">Remove my personal information</h1>
          <p className="text-[15px] leading-relaxed text-[#292b29] mb-8 max-w-[62ch]">
            Tell us who you are and what to remove. {config.realtor.name.split(" ")[0]} removes it from {config.SITE_NAME}&apos;s
            systems and, where a listing or a brokerage was involved, advises PropTx and the listing brokerage of your
            request. You get a reference by email now and a reply at the same address when it is done. Records the Real
            Estate and Business Brokers Act requires us to keep are named in that reply.
          </p>

          <RequestForm fallbackEmail={FALLBACK_EMAIL} />

          <p className="text-[13px] text-[#6b6f6a] mt-6 leading-relaxed">
            Prefer email? Write to <a href={`mailto:${FALLBACK_EMAIL}`} className="text-[#017848] underline">{FALLBACK_EMAIL}</a> or
            call <a href={`tel:${config.realtor.phoneE164}`} className="text-[#017848] underline">{config.realtor.phone}</a>. To stop one
            email without removing anything, use the unsubscribe link at the bottom of that email.
          </p>
        </div>
      </main>
    </SiteChrome>
  );
}

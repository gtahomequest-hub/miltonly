import Link from "next/link";
import { generateMetadata as genMeta } from "@/lib/seo";
import { config } from "@/lib/config";
import SiteChrome from "@/components/nav/SiteChrome";

export const metadata = genMeta({
  title: "Terms of Use",
  description: `Terms and MLS® data disclaimer for ${config.SITE_DOMAIN}.`,
  canonical: `${config.SITE_URL}/terms`,
});

export default function TermsPage() {
  return (
    <SiteChrome>
    <main className="bg-white text-[#073126] min-h-screen py-12 sm:py-16">
      <div className="max-w-3xl mx-auto px-5 sm:px-6">
        <Link href="/" className="text-[13px] text-[#6b6f6a] hover:text-[#073126]">← Back to {config.SITE_NAME}</Link>

        <h1 className="text-[32px] sm:text-[40px] font-extrabold mt-4 mb-2">Terms of Use</h1>
        <p className="text-[13px] text-[#6b6f6a] mb-8">Last updated: April 23, 2026</p>

        <div className="space-y-6 text-[15px] leading-relaxed">
          <p>
            {config.SITE_DOMAIN} is operated by {config.realtor.name}, {config.realtor.title} at {config.brokerage.name}.
            By using this site you agree to the terms below.
          </p>

          <h2 className="text-[22px] font-extrabold mt-8 mb-2">Information is not advice</h2>
          <p>
            Nothing on {config.SITE_DOMAIN} is legal, tax, or financial advice. Real estate transactions have material consequences
            — consult a licensed Realtor, lawyer, and/or accountant before acting on anything you read here.
          </p>

          <h2 className="text-[22px] font-extrabold mt-8 mb-2">MLS® data disclaimer</h2>
          <p>
            Listings and market data on this site are provided by the Toronto Regional Real Estate Board (TRREB) and
            other REALTOR® members. Information is deemed reliable but is not guaranteed accurate. Listings may be
            withdrawn, sold, leased, or change in price at any time without notice. The trademarks MLS®, Multiple Listing
            Service® and the associated logos are owned by The Canadian Real Estate Association (CREA) and identify the
            quality of services provided by real estate professionals who are members of CREA.
          </p>

          <h2 className="text-[22px] font-extrabold mt-8 mb-2">No representation without agreement</h2>
          <p>
            Submitting a form or calling does not create an agency relationship. A written representation agreement is
            required before {config.realtor.name} can formally represent you in a real estate transaction.
          </p>

          <h2 className="text-[22px] font-extrabold mt-8 mb-2">Acceptable use</h2>
          <p>
            You may not scrape, copy, or republish listing data from this site except as permitted by TRREB&apos;s VOW/IDX
            rules and copyright law. You may not use this site to send spam, test security, or impersonate others.
          </p>

          <h2 className="text-[22px] font-extrabold mt-8 mb-2">Signing in and sold data</h2>
          <p>
            Sold and leased MLS® records are shown only to registered consumers with a bona fide interest in buying,
            selling or leasing, under TRREB&apos;s VOW rules. Registration is your name, a verified email and your
            agreement to the acknowledgement shown at first sign-in. There is no password: your email address is your
            username, and the one-time code or link sent to it is your credential. Each sign-in lasts at most 90 days,
            after which you confirm your email again. The records of your registration are kept for at least 180 days
            after a sign-in expires, as the VOW rules require. This sign-in method stands pending the brokerage&apos;s
            broker of record confirming it against the TRREB VOW Policy; if a password is required, one will be added to
            the same account.
          </p>

          <h2 className="text-[22px] font-extrabold mt-8 mb-2">Limitation of liability</h2>
          <p>
            This site is provided &quot;as is.&quot; To the fullest extent permitted by law, {config.SITE_DOMAIN}, {config.realtor.name}, and
            {" "}{config.brokerage.name} disclaim all warranties and are not liable for any indirect,
            incidental, or consequential damages arising from your use of this site.
          </p>

          <h2 className="text-[22px] font-extrabold mt-8 mb-2">Privacy</h2>
          <p>
            Your personal information is handled under our <Link href="/privacy" className="text-[#017848] underline">Privacy Policy</Link>.
          </p>

          <h2 className="text-[22px] font-extrabold mt-8 mb-2">Contact</h2>
          <p>
            <strong>{config.realtor.name}</strong>, {config.realtor.title}<br />
            {config.brokerage.name}<br />
            Email: <a href="mailto:gtahomequest@gmail.com" className="text-[#017848] underline">gtahomequest@gmail.com</a><br />
            Phone: <a href={`tel:${config.realtor.phoneE164}`} className="text-[#017848] underline">{config.realtor.phone}</a>
          </p>
        </div>
      </div>
    </main>
    </SiteChrome>
  );
}

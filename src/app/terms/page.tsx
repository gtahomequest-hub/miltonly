import Link from "next/link";
import { generateMetadata as genMeta } from "@/lib/seo";
import { config } from "@/lib/config";
import SiteChrome from "@/components/nav/SiteChrome";
import ReviewerNotice from "@/components/vow/ReviewerNotice";
import { VOW_TERMS_CLAUSES, VOW_TERMS_VERSION } from "@/lib/vow-acknowledgement";
import { REGISTRANT_BROKERAGE_LINE, REGISTRANT_NAME_LINE } from "@/lib/compliance/registrant";

export const metadata = genMeta({
  title: "VOW Terms of Use",
  description: `The VOW Terms of Use between you and ${REGISTRANT_NAME_LINE}, ${REGISTRANT_BROKERAGE_LINE}, and the MLS® data disclaimer.`,
  canonical: `${config.SITE_URL}/terms`,
});

export default function TermsPage() {
  return (
    <SiteChrome>
    <main className="bg-white text-[#073126] min-h-screen py-12 sm:py-16">
      <div className="max-w-3xl mx-auto px-5 sm:px-6">
        <Link href="/" className="text-[13px] text-[#6b6f6a] hover:text-[#073126]">← Back to {config.SITE_NAME}</Link>

        {/* PUBLIC, TITLED AND BETWEEN THE CONSUMER AND THE MEMBER (MC-047, TRREB's audit of homesly.ca,
            finding A2). The clauses below are the same array the sign-in card shows and stores
            (src/lib/vow-acknowledgement.ts), so the page and the agreement cannot drift. */}
        <h1 className="text-[32px] sm:text-[40px] font-extrabold mt-4 mb-2">VOW Terms of Use</h1>
        <p className="text-[13px] text-[#6b6f6a] mb-8" data-terms-version={VOW_TERMS_VERSION}>
          Version {VOW_TERMS_VERSION}, last updated September 29, 2026
        </p>

        <div className="space-y-6 text-[15px] leading-relaxed">
          <p data-terms-party>
            These terms are an agreement between you and <strong>{REGISTRANT_NAME_LINE}</strong>,{" "}
            <strong>{REGISTRANT_BROKERAGE_LINE}</strong> (the Member), who operates {config.SITE_DOMAIN} as a Virtual Office
            Website (VOW) under the rules of the Toronto Regional Real Estate Board (TRREB) and PropTx Innovations Inc.
            (PropTx). By using this site you agree to them.
          </p>

          <h2 className="text-[22px] font-extrabold mt-8 mb-2">The VOW terms you agree to at sign-in</h2>
          <p>
            To see sold and leased MLS<sup>®</sup> records you register and agree to these clauses, word for word, by a
            click. Your agreement is recorded with the version number, the time, your IP address and browser.
          </p>
          <ol className="list-decimal pl-6 space-y-2" data-vow-terms-clauses>
            {VOW_TERMS_CLAUSES.map((c) => (
              <li key={c.key}>{c.bold ? <strong>{c.text}</strong> : c.text}</li>
            ))}
          </ol>

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

          <ReviewerNotice className="my-6" />

          <h2 className="text-[22px] font-extrabold mt-8 mb-2">Signing in and sold data</h2>
          <p>
            Sold and leased MLS® records are shown only to registered consumers with a bona fide interest in buying,
            selling or leasing, under TRREB&apos;s VOW rules (R-805). Registration is a username and a password: your
            username is your verified email address, and you choose your password (twelve characters or more) at first
            sign-in, after agreeing to the terms of use shown there (the nine clauses PropTx requires, including that
            the MLS® data is for your personal, non-commercial use, that TRREB and PropTx own it, and that PropTx and TRREB may audit
            this site and its consumers). A one-time emailed link or code verifies your email and stands in when you
            forget your password; no sold record is shown until your password is set. Your password expires 90 days
            after you set it and you confirm or change it then; a sign-in ends after 60 minutes without activity and in
            any case 90 days after it began. Licensed real estate registrants may not use the VOW. Your access to the
            records is logged (who, when, what, from where) and the log, with your registration records, is kept for at
            least 180 days after your password expires and may be provided to PropTx or TRREB on request.
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

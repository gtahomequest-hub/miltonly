import Link from "next/link";
import { generateMetadata as genMeta } from "@/lib/seo";

export const metadata = genMeta({
  title: "Terms of Use",
  description: "Terms and MLS® data disclaimer for Miltonly.com.",
  canonical: "https://miltonly.com/terms",
});

export default function TermsPage() {
  return (
    <main className="bg-white text-[#07111f] min-h-screen py-12 sm:py-16">
      <div className="max-w-3xl mx-auto px-5 sm:px-6">
        <Link href="/" className="text-[13px] text-[#64748b] hover:text-[#07111f]">← Back to Miltonly</Link>

        <h1 className="text-[32px] sm:text-[40px] font-extrabold mt-4 mb-2">Terms of Use</h1>
        <p className="text-[13px] text-[#64748b] mb-8">Last updated: April 23, 2026</p>

        <div className="space-y-6 text-[15px] leading-relaxed">
          <p>
            Miltonly.com is operated by Aamir Yaqoob, Sales Representative at RE/MAX Realty Specialists Inc., Brokerage.
            By using this site you agree to the terms below.
          </p>

          <h2 className="text-[22px] font-extrabold mt-8 mb-2">Information is not advice</h2>
          <p>
            Nothing on Miltonly.com is legal, tax, or financial advice. Real estate transactions have material consequences
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
            required before Aamir Yaqoob can formally represent you in a real estate transaction.
          </p>

          <h2 className="text-[22px] font-extrabold mt-8 mb-2">Acceptable use</h2>
          <p>
            You may not scrape, copy, or republish listing data from this site except as permitted by TRREB&apos;s VOW/IDX
            rules and copyright law. You may not use this site to send spam, test security, or impersonate others.
          </p>

          <h2 className="text-[22px] font-extrabold mt-8 mb-2">Limitation of liability</h2>
          <p>
            This site is provided &quot;as is.&quot; To the fullest extent permitted by law, Miltonly.com, Aamir Yaqoob, and
            RE/MAX Realty Specialists Inc., Brokerage disclaim all warranties and are not liable for any indirect,
            incidental, or consequential damages arising from your use of this site.
          </p>

          <h2 className="text-[22px] font-extrabold mt-8 mb-2">Privacy</h2>
          <p>
            Your personal information is handled under our <Link href="/privacy" className="text-[#f59e0b] underline">Privacy Policy</Link>.
          </p>

          <h2 className="text-[22px] font-extrabold mt-8 mb-2">Contact</h2>
          <p>
            <strong>Aamir Yaqoob</strong>, Sales Representative<br />
            RE/MAX Realty Specialists Inc., Brokerage<br />
            Email: <a href="mailto:gtahomequest@gmail.com" className="text-[#f59e0b] underline">gtahomequest@gmail.com</a><br />
            Phone: <a href="tel:+16478399090" className="text-[#f59e0b] underline">(647) 839-9090</a>
          </p>
        </div>
      </div>
    </main>
  );
}

import Link from "next/link";
import { generateMetadata as genMeta } from "@/lib/seo";
import { config } from "@/lib/config";

export const metadata = genMeta({
  title: "Privacy Policy",
  description: `How ${config.SITE_DOMAIN} and ${config.realtor.name} collect, use, and protect your personal information.`,
  canonical: `${config.SITE_URL}/privacy`,
});

export default function PrivacyPage() {
  return (
    <main className="bg-white text-[#07111f] min-h-screen py-12 sm:py-16">
      <div className="max-w-3xl mx-auto px-5 sm:px-6">
        <Link href="/" className="text-[13px] text-[#64748b] hover:text-[#07111f]">← Back to {config.SITE_NAME}</Link>

        <h1 className="text-[32px] sm:text-[40px] font-extrabold mt-4 mb-2">Privacy Policy</h1>
        <p className="text-[13px] text-[#64748b] mb-8">Last updated: April 23, 2026</p>

        <div className="prose prose-slate max-w-none space-y-6 text-[15px] leading-relaxed">
          <p>
            {config.SITE_DOMAIN} (&quot;we&quot;, &quot;us&quot;, or &quot;{config.SITE_NAME}&quot;) is operated by {config.realtor.name}, {config.realtor.title} at
            {" "}{config.brokerage.name}. We take your privacy seriously and comply with Canada&apos;s Personal
            Information Protection and Electronic Documents Act (PIPEDA) and applicable {config.CITY_PROVINCE} legislation.
          </p>

          <h2 className="text-[22px] font-extrabold mt-8 mb-2">What we collect</h2>
          <p>When you contact us through a form on this site, we may collect:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Your name</li>
            <li>Phone number</li>
            <li>Email address (optional)</li>
            <li>Your rental, buying, or selling preferences (e.g. property type, bedrooms, budget, move-in date)</li>
            <li>The page or ad that referred you (including UTM parameters)</li>
          </ul>
          <p>
            We also collect standard web-analytics information (IP address, browser, pages visited) via Google Analytics.
            You can disable analytics cookies using the consent banner.
          </p>

          <h2 className="text-[22px] font-extrabold mt-8 mb-2">How we use it</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>To contact you about {config.CITY_NAME} rentals or homes that match your needs</li>
            <li>To arrange showings and represent you in real estate transactions</li>
            <li>To send optional listing alerts (you can unsubscribe at any time)</li>
            <li>To improve this website and measure ad performance</li>
          </ul>
          <p>We do <strong>not</strong> sell your personal information to third parties.</p>

          <h2 className="text-[22px] font-extrabold mt-8 mb-2">Who sees your information</h2>
          <p>
            Your contact information is seen by {config.realtor.name} and, where required for a specific transaction, by
            {" "}{config.brokerage.name} and the other parties to the transaction (e.g. landlord&apos;s Realtor).
            We use the following service providers to store and process data on our behalf:
          </p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Vercel (website hosting)</li>
            <li>Our database provider (encrypted lead storage)</li>
            <li>Google Analytics and Google Ads (traffic measurement)</li>
            <li>Email delivery service (to notify {config.realtor.name.split(" ")[0]} of your inquiry)</li>
          </ul>

          <h2 className="text-[22px] font-extrabold mt-8 mb-2">How long we keep it</h2>
          <p>
            We retain inquiry information for as long as is reasonably necessary to provide the service you requested
            and to meet record-keeping obligations under the Real Estate and Business Brokers Act (REBBA) — typically
            up to 7 years. You can request earlier deletion at any time.
          </p>

          <h2 className="text-[22px] font-extrabold mt-8 mb-2">Your rights</h2>
          <p>You have the right to:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Access the personal information we hold about you</li>
            <li>Correct it if it&apos;s inaccurate</li>
            <li>Request deletion (subject to legal retention rules)</li>
            <li>Withdraw consent to be contacted at any time</li>
          </ul>
          <p>
            To exercise any of these rights, email <a href="mailto:gtahomequest@gmail.com" className="text-[#f59e0b] underline">gtahomequest@gmail.com</a> or call {config.realtor.phone}.
          </p>

          <h2 className="text-[22px] font-extrabold mt-8 mb-2">Cookies and analytics</h2>
          <p>
            We use cookies for analytics and advertising measurement. The consent banner on first visit lets you
            accept or decline non-essential cookies. You can also clear cookies in your browser at any time.
          </p>

          <h2 className="text-[22px] font-extrabold mt-8 mb-2">Children</h2>
          <p>This site is not directed to children under 16, and we do not knowingly collect information from them.</p>

          <h2 className="text-[22px] font-extrabold mt-8 mb-2">Changes to this policy</h2>
          <p>
            We may update this policy from time to time. The &quot;Last updated&quot; date at the top of this page reflects the most
            recent change. Material changes will be announced on the homepage.
          </p>

          <h2 className="text-[22px] font-extrabold mt-8 mb-2">Contact</h2>
          <p>
            <strong>{config.realtor.name}</strong>, {config.realtor.title}<br />
            {config.brokerage.name}<br />
            Email: <a href="mailto:gtahomequest@gmail.com" className="text-[#f59e0b] underline">gtahomequest@gmail.com</a><br />
            Phone: <a href={`tel:${config.realtor.phoneE164}`} className="text-[#f59e0b] underline">{config.realtor.phone}</a>
          </p>
          <p className="text-[13px] text-[#64748b] mt-8">
            If you have a complaint about our handling of your personal information, you may contact the Office of the
            Privacy Commissioner of Canada at <a href="https://www.priv.gc.ca" className="underline" target="_blank" rel="noopener noreferrer">priv.gc.ca</a>.
          </p>
        </div>
      </div>
    </main>
  );
}

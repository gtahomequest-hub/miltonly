// /book: a booking page (ML-014). It was a 307 to /about, which has no form, and the school and
// mosque pages (36 on the sitemap) link here from their "Book a showing" button. The form takes
// the fields the task set: the listing card modal's name and phone, plus an optional email and a
// note, source "book-page", through the one ingress with the same guards, confirmation and desk
// alert as every other form.
//
// ?ref= is the page the visitor came from. It is validated to a path on this site (one rule, shared
// with the ingest: src/lib/lead/refPath.ts) and handed to the form, which sends it as the lead's
// landingPage; nothing else reads it.
//
// noindex: a form page has nothing for the index, and the ?ref= permutations (one per linking
// page) must not become URLs of their own; the canonical is /book without a query.

import { generateMetadata as genMeta } from "@/lib/seo";
import { config } from "@/lib/config";
import { sameOriginPath } from "@/lib/lead/refPath";
import SiteChrome from "@/components/nav/SiteChrome";
import Link from "next/link";
import BookForm from "./BookForm";

export const dynamic = "force-dynamic";

export const metadata = genMeta({
  title: `Book a showing in ${config.CITY_NAME}`,
  description: `Ask ${config.realtor.name} to show you a ${config.CITY_NAME} home. Your name and number, the home if you know it, and he confirms a time by phone.`,
  canonical: `${config.SITE_URL}/book`,
  noIndex: true,
});

const FIRST_NAME = config.realtor.name.split(" ")[0];

const STEPS = [
  { n: "1", text: "You send your name and number, and the home if you have one in mind." },
  { n: "2", text: `${FIRST_NAME} calls within the hour during business hours to set a time that suits you.` },
  { n: "3", text: "You see the home with him, and there is nothing to sign to look." },
];

export default function BookPage({ searchParams }: { searchParams?: { [key: string]: string | string[] | undefined } }) {
  const raw = searchParams?.ref;
  const refPath = sameOriginPath(Array.isArray(raw) ? raw[0] : raw);
  return (
    <SiteChrome>
      <div className="min-h-screen bg-[#fffdfa] px-4 py-8">
        <div className="mx-auto w-full max-w-[440px]">
          {refPath && (
            <Link href={refPath} className="inline-flex min-h-[44px] items-center text-[14px] font-semibold text-[#017848]">
              ← Back to the page you were on
            </Link>
          )}
          <div className="mb-5 mt-2">
            <p className="mb-2 text-[12px] font-bold uppercase tracking-[0.12em] text-[#017848]">A showing, at your pace</p>
            <h1 className="font-fraunces mb-2 text-[30px] font-extrabold tracking-[-0.02em] text-[#073126]">Book a showing</h1>
            <p className="text-[15px] leading-relaxed text-[#292b29]">
              No portal, no queue: one message, one call back.
            </p>
          </div>
          {/* The ladder: what happens after the tap, so the ask is small and the next step is known. */}
          <ol className="mb-5 space-y-2" aria-label="What happens next">
            {STEPS.map((s) => (
              <li key={s.n} className="flex items-start gap-3 text-[14px] leading-snug text-[#292b29]">
                <span className="mt-[1px] inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#073126] text-[12px] font-extrabold text-[#00ff80]">{s.n}</span>
                <span>{s.text}</span>
              </li>
            ))}
          </ol>
          <BookForm refPath={refPath} />
          <a
            href={`tel:${config.realtor.phoneE164}`}
            className="mt-4 flex min-h-[48px] w-full items-center justify-center rounded-lg border border-[#017848] text-[14px] font-bold text-[#017848]"
          >
            Faster by phone? Call or text {config.realtor.phone}
          </a>
          <p className="mt-3 text-[12px] text-[#6b6f6a]">
            {config.realtor.name}, {config.brokerage.name}.
          </p>
        </div>
      </div>
    </SiteChrome>
  );
}

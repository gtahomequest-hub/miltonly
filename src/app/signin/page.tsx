import { generateMetadata as genMeta } from "@/lib/seo";
import { config } from "@/lib/config";
import SignInForm from "./SignInForm";

// noindex — an auth wall has no place in the index, and its redirect/intent/street param
// permutations were the single biggest crawl-budget drain (see robots.ts).
//
// This is INERT until "/signin" comes out of the robots disallow: Google cannot fetch the page,
// so it never reads this tag. It is NOT belt-and-suspenders with the block — the two cancel.
// It ships now so the directive is already in place the moment the block is lifted (the
// follow-up deploy), and as insurance if the block ever fails or is removed. What actually
// stops discovery today is rel="nofollow" on every live CTA (see robots.ts).
//
// genMeta emits `noindex, nofollow` — seo.ts:64-66 hardcodes follow:false alongside
// index:false. Correct for an auth wall; just don't expect the `noindex, follow` used for
// the /listings and /sold facets.
export const metadata = genMeta({
  title: `Sign In — ${config.SITE_NAME}`,
  description: `Sign in to save listings and get alerts on ${config.CITY_NAME} real estate.`,
  canonical: `${config.SITE_URL}/signin`,
  noIndex: true,
});

export default function SignInPage() {
  return (
    <div className="min-h-screen bg-[#f8f9fb] flex items-center justify-center px-5">
      <div className="w-full max-w-[400px]">
        <div className="text-center mb-8">
          <h1 className="text-[24px] font-extrabold text-[#07111f] tracking-[-0.02em] mb-2">Sign in to {config.SITE_NAME}</h1>
          <p className="text-[13px] text-[#64748b]">Save listings and get personalized alerts</p>
        </div>
        <SignInForm />
      </div>
    </div>
  );
}

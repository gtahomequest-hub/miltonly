import { generateMetadata as genMeta } from "@/lib/seo";
import SignInForm from "./SignInForm";

export const metadata = genMeta({
  title: "Sign In — Miltonly",
  description: "Sign in to save listings and get alerts on Milton real estate.",
  canonical: "https://miltonly.com/signin",
});

export default function SignInPage() {
  return (
    <div className="min-h-screen bg-[#f8f9fb] flex items-center justify-center px-5">
      <div className="w-full max-w-[400px]">
        <div className="text-center mb-8">
          <h1 className="text-[24px] font-extrabold text-[#07111f] tracking-[-0.02em] mb-2">Sign in to Miltonly</h1>
          <p className="text-[13px] text-[#64748b]">Save listings and get personalized alerts</p>
        </div>
        <SignInForm />
      </div>
    </div>
  );
}

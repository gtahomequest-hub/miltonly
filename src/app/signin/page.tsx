import { generateMetadata as genMeta } from "@/lib/seo";

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
          <h1 className="text-[24px] font-extrabold text-[#07111f] tracking-[-0.02em] mb-2">Sign in</h1>
          <p className="text-[13px] text-[#64748b]">Sign in to save listings and get alerts</p>
        </div>
        <div className="bg-white rounded-2xl border border-[#e2e8f0] p-8 shadow-sm">
          <div className="space-y-4">
            <div>
              <label className="block text-[12px] font-bold text-[#374151] mb-1.5">Email</label>
              <input type="email" placeholder="you@email.com" className="w-full border border-[#e2e8f0] rounded-lg px-4 py-3 text-[14px] outline-none focus:border-[#f59e0b] transition-colors" />
            </div>
            <div>
              <label className="block text-[12px] font-bold text-[#374151] mb-1.5">Password</label>
              <input type="password" placeholder="Your password" className="w-full border border-[#e2e8f0] rounded-lg px-4 py-3 text-[14px] outline-none focus:border-[#f59e0b] transition-colors" />
            </div>
            <button className="w-full bg-[#07111f] text-[#f59e0b] text-[14px] font-bold py-3.5 rounded-xl hover:bg-[#0c1e35] transition-colors">
              Sign in
            </button>
          </div>
          <p className="text-[11px] text-[#94a3b8] text-center mt-5">Coming soon — sign in to save listings and get personalized alerts.</p>
        </div>
      </div>
    </div>
  );
}

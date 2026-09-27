// The published reviewer notice (MP-007, MLS® Rule 8.21): the sentence on the sign-in, terms
// and account pages telling a PropTx or TRREB reviewer to choose the reviewer answer and write
// in. A Server Component: the contact address is the server's (contactEmail(), no fallback);
// with none configured the notice names the /privacy page instead (reviewerPath handles it).
// Homesly's equivalent: D:\homesly src/components/vow/ReviewerPath.tsx.

import { contactEmail } from "@/lib/compliance/contact";
import { reviewerPath } from "@/lib/vow/reviewer";

export default function ReviewerNotice({ className = "" }: { className?: string }) {
  const [lead, ...rest] = reviewerPath(contactEmail());
  return (
    <aside
      aria-labelledby="reviewer-notice-h"
      className={`rounded-2xl border border-[#dfe0dc] bg-[#f6f4ef] px-5 py-4 text-[13px] leading-relaxed text-[#073126] ${className}`}
      data-reviewer-notice
    >
      <h2 id="reviewer-notice-h" className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#6b6f6a]">
        For PropTx and TRREB reviewers
      </h2>
      <p className="mt-2">{lead}</p>
      {rest.map((p, i) => (
        <p key={i} className="mt-2">
          {p}
        </p>
      ))}
    </aside>
  );
}

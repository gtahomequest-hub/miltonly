// src/components/compliance/RegistrantStrip.tsx
// The registrant strip for the pages that draw their own header (MC-047, PropTx item 10): the
// ads landing pages, the two thank-you pages and the coming-soon page. Every other page gets
// the same two names from SiteNav's strip. TRREB's auditor: a VOW "must be branded to you, not
// just your Real Estate company", so the header names the registrant and the brokerage, each by
// its registered name, and the phone layout stacks them rather than cut either.
import { REGISTRANT_BROKERAGE_LINE, REGISTRANT_NAME_LINE } from "@/lib/compliance/registrant";

export default function RegistrantStrip() {
  return (
    <div
      className="flex flex-col sm:flex-row items-center justify-center gap-x-2.5 gap-y-px px-4 py-1 bg-black/30 border-b border-white/5 text-[11px] sm:text-[12px] leading-tight text-white/80 text-center"
      data-registrant
    >
      <span className="font-semibold text-white" data-registrant-name>{REGISTRANT_NAME_LINE}</span>
      <span className="hidden sm:inline opacity-50" aria-hidden="true">·</span>
      <span data-registrant-brokerage>{REGISTRANT_BROKERAGE_LINE}</span>
    </div>
  );
}

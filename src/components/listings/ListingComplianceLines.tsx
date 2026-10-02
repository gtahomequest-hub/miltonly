// src/components/listings/ListingComplianceLines.tsx
// THE LISTING NOTICES, ONE COPY (MC-047; shared at MC-046 Stage 1). A page that shows one MLS®
// listing carries three sentences beside it (PropTx MLS® Rules, Article 8):
//   8.24 what on the page is ours and where it came from (AugmentationLabel),
//   8.12 how to reach the Member about the property (ContactLine),
//   8.16 how the listing brokerage reports an error in what we added (ReportInaccuracyLine).
// The words live in src/lib/compliance/registrant.ts; these components are the only way a page
// renders them, so /listings/[mls] and /sales/ads/[mls] cannot drift. Each page styles the line
// through `className`; the text and the data attribute the battery reads are fixed here.
//
// No "use client": nothing here holds state, so a server or a client component can render them.

import { AUGMENTATION_LABEL, contactLine, reportInaccuracyLine } from "@/lib/compliance/registrant";

/** MLS® Rule 8.24: sits above the first block the page adds to the listing. */
export function AugmentationLabel({ className = "" }: { className?: string }) {
  return (
    <p className={className} data-augmented-label>
      {AUGMENTATION_LABEL}
    </p>
  );
}

/** MLS® Rule 8.12. `email` is CONTACT_EMAIL read on the server, or null when unset. */
export function ContactLine({ email, className }: { email: string | null; className?: string }) {
  return (
    <p className={className} data-contact-line>
      {contactLine(email)}
    </p>
  );
}

/** MLS® Rule 8.16. `email` is CONTACT_EMAIL read on the server, or null when unset. */
export function ReportInaccuracyLine({ email, className }: { email: string | null; className?: string }) {
  return (
    <p className={className} data-report-inaccuracy>
      {reportInaccuracyLine(email)}
    </p>
  );
}

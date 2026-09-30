// THE NEUTRAL LINE (MC-046 Stage 1). Where a VOW-derived block left the visitor view, the page
// carries this one sentence in its place, at most once per page: "Sold history for <subject> is
// for registered readers · Sign in". It carries no figure, no count and no sold status, so it
// can never itself disclose what it stands in for (PropTx VOW Best Practices item 40).
//
// The link goes to the portal's sold view for the subject where one exists (a street's own
// records island, a hub's /sold?nbhd=, Milton's /sold), otherwise to sign-in with a return path.
// Every caller goes through this component; the leak test finds it by `data-sold-history-line`.

import Link from "next/link";

type Props = {
  /** "Scott Boulevard", "Old Milton", or "Milton". The registry name, never a shortName. */
  subject: string;
  /** The portal's sold view for the subject, when one exists. */
  soldViewHref?: string;
  /** The page to return to after sign-in, used when there is no sold view. */
  returnPath?: string;
  tone?: "light" | "dark";
  className?: string;
};

export function soldHistorySignInHref(returnPath: string): string {
  return `/signin?redirect=${encodeURIComponent(returnPath)}&intent=sold`;
}

export default function SoldHistoryLine({ subject, soldViewHref, returnPath = "/", tone = "light", className = "" }: Props) {
  const href = soldViewHref ?? soldHistorySignInHref(returnPath);
  const text = tone === "dark" ? "text-[#f6f4ef]/80" : "text-[#073126]/75";
  const link = tone === "dark" ? "text-[#f6f4ef]" : "text-[#017848]";
  // The ruled wording: a street or hub reads "Sold history for <Name> …"; the homepage and the
  // menu read "Milton sold history …".
  const lead = subject === "Milton" ? "Milton sold history" : `Sold history for ${subject}`;
  return (
    <p className={`text-[13px] leading-relaxed ${text} ${className}`} data-sold-history-line>
      {lead} is for registered readers ·{" "}
      <Link href={href} rel="nofollow" className={`font-semibold underline underline-offset-2 ${link}`}>
        Sign in
      </Link>
    </p>
  );
}

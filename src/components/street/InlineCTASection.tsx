import { InlineCTA } from "@/components/ui";
import type { InlineCTASectionProps } from "@/types/street";
import { formatCAD } from "@/lib/charts/theme";
import { roundPriceForProse } from "@/lib/format";

interface VariantCopy {
  eyebrow: string;
  headlineLead: string;
  headlineTail: string;   // after the stat
  body: string;
  actionLabel: string;
  trustLine: string;
  defaultHref: string;
}

function copyFor(
  variant: InlineCTASectionProps["variant"],
  streetShort: string
): VariantCopy {
  switch (variant) {
    case "owner":
      return {
        eyebrow: `For ${streetShort} owners`,
        headlineLead: `Homes on your street have typically sold for`,
        headlineTail: `. What is yours worth today?`,
        body: `A short conversation grounded in every sale we have tracked on ${streetShort}. You will hear what is realistic, what timing works, and what to prepare for.`,
        actionLabel: "Request a valuation",
        trustLine: "Complimentary · Response within one hour",
        defaultHref: "#valuation",
      };
    case "detached":
      return {
        eyebrow: `${streetShort} · Detached`,
        headlineLead: `Detached homes here trade around`,
        headlineTail: `. We can help you act on a specific one.`,
        body: `Whether it is pricing strategy, a showing, or a direct approach to a neighbour, we know the inventory on this street.`,
        actionLabel: "Talk about a detached home",
        trustLine: "Private · No obligations",
        defaultHref: "#contact",
      };
    case "semi":
      return {
        eyebrow: `${streetShort} · Semi`,
        headlineLead: `Semi-detached homes on ${streetShort} close near`,
        headlineTail: `. A popular step up from townhouse.`,
        body: `Semi-detached supply is often tighter than detached. If timing matters, we can approach neighbours on your behalf.`,
        actionLabel: "Talk about a semi",
        trustLine: "Private · No obligations",
        defaultHref: "#contact",
      };
    case "townhouse":
      return {
        eyebrow: `${streetShort} · Townhouse`,
        headlineLead: `Townhouses on ${streetShort} sit at`,
        headlineTail: `. Most move within weeks of listing.`,
        body: `Townhouse demand here runs ahead of supply. If you want first pick on a new listing, we can set up a private feed.`,
        actionLabel: "Get first access",
        trustLine: "Off-market leads included",
        defaultHref: "#alerts",
      };
    case "condo":
      return {
        eyebrow: `${streetShort} · Condo`,
        headlineLead: `Condos on ${streetShort} typically close near`,
        headlineTail: `. A practical entry point into this street.`,
        body: `If you are weighing a condo purchase or thinking about what yours might rent for, we can walk through the current picture.`,
        actionLabel: "Explore condo options",
        trustLine: "Investor and end-user paths",
        defaultHref: "#contact",
      };
  }
}

export function InlineCTASection({
  variant,
  streetShort,
  typicalPrice,
  actionHref,
}: InlineCTASectionProps) {
  const c = copyFor(variant, streetShort);
  const headline = (
    <>
      {c.headlineLead} <em>{formatCAD(roundPriceForProse(typicalPrice))}</em>{c.headlineTail}
    </>
  );
  return (
    <InlineCTA
      eyebrow={c.eyebrow}
      headline={headline}
      body={c.body}
      actionLabel={c.actionLabel}
      actionHref={actionHref ?? c.defaultHref}
      trustLine={c.trustLine}
    />
  );
}


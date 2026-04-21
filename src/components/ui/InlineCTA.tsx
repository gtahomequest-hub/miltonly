import type { ReactNode } from "react";
import Link from "next/link";

interface InlineCTAProps {
  eyebrow: string;
  /** ReactNode so callers can embed <em> for the italic stat figure. */
  headline: ReactNode;
  body: string;
  actionLabel: string;
  actionHref: string;
  trustLine?: string;
  className?: string;
}

function ActionInner({ actionLabel }: { actionLabel: string }) {
  return (
    <>
      <span className="inline-cta-action-label">{actionLabel}</span>
      <span className="inline-cta-action-arrow" aria-hidden>→</span>
    </>
  );
}

export function InlineCTA({
  eyebrow,
  headline,
  body,
  actionLabel,
  actionHref,
  trustLine,
  className = "",
}: InlineCTAProps) {
  const isExternal = /^https?:\/\//.test(actionHref);

  return (
    <div className={`inline-cta ${className}`}>
      <div>
        <div className="inline-cta-eyebrow">{eyebrow}</div>
        <h4 className="inline-cta-headline">{headline}</h4>
        <p className="inline-cta-body">{body}</p>
      </div>
      <div>
        {isExternal ? (
          <a
            href={actionHref}
            className="inline-cta-action"
            target="_blank"
            rel="noopener noreferrer"
          >
            <ActionInner actionLabel={actionLabel} />
          </a>
        ) : (
          <Link href={actionHref} className="inline-cta-action">
            <ActionInner actionLabel={actionLabel} />
          </Link>
        )}
        {trustLine && <div className="inline-cta-trust">{trustLine}</div>}
      </div>
    </div>
  );
}

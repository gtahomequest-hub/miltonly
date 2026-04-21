import type { ReactNode } from "react";
import Link from "next/link";

type Accent = "navy" | "blue" | "blue-muted" | "gold" | "line";

interface PillBaseProps {
  children: ReactNode;
  accent?: Accent;
  className?: string;
}

interface PillLinkProps extends PillBaseProps {
  href: string;
  onClick?: never;
}
interface PillButtonProps extends PillBaseProps {
  href?: never;
  onClick?: () => void;
}
type PillProps = PillLinkProps | PillButtonProps;

const ACCENT: Record<Accent, string> = {
  navy:          "pill-accent-navy",
  blue:          "pill-accent-blue",
  "blue-muted":  "pill-accent-blue-muted",
  gold:          "pill-accent-gold",
  line:          "",
};

export function Pill({ children, accent = "line", className = "", ...rest }: PillProps) {
  const classes = `pill ${ACCENT[accent]} ${className}`.trim();

  if ("href" in rest && rest.href) {
    return (
      <Link href={rest.href} className={classes}>
        {children}
      </Link>
    );
  }
  return (
    <button
      type="button"
      onClick={"onClick" in rest ? rest.onClick : undefined}
      className={classes}
    >
      {children}
    </button>
  );
}

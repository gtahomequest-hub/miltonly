import type { ReactNode } from "react";

interface SectionProps {
  children: ReactNode;
  className?: string;
  bordered?: boolean;
  tone?: "paper" | "paper-warm" | "navy" | "navy-deep" | "white" | "transparent";
  py?: "default" | "hero" | "compact" | "none";
}

const TONE_STYLE: Record<NonNullable<SectionProps["tone"]>, { bg: string; border: string }> = {
  paper:        { bg: "var(--paper)",      border: "var(--line)" },
  "paper-warm": { bg: "var(--paper-warm)", border: "var(--line)" },
  navy:         { bg: "var(--navy)",       border: "var(--line-dark)" },
  "navy-deep":  { bg: "var(--navy-deep)",  border: "var(--line-dark)" },
  white:        { bg: "#ffffff",           border: "var(--line)" },
  transparent:  { bg: "transparent",       border: "var(--line)" },
};

const PY: Record<NonNullable<SectionProps["py"]>, string> = {
  default: "py-24",
  hero:    "pt-10 pb-16",
  compact: "py-12",
  none:    "",
};

export function Section({
  children,
  className = "",
  bordered = true,
  tone = "transparent",
  py = "default",
}: SectionProps) {
  const { bg, border } = TONE_STYLE[tone];
  return (
    <section
      className={`${PY[py]} ${bordered ? "border-b" : ""} ${className}`}
      style={{
        backgroundColor: bg === "transparent" ? undefined : bg,
        borderBottomColor: bordered ? border : undefined,
      }}
    >
      {children}
    </section>
  );
}

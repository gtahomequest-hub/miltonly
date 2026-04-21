import type { ReactNode, ElementType } from "react";

interface DotShiftBgProps {
  children: ReactNode;
  /** `strong` for navy/dark panels (gold dots), `subtle` for light panels (navy dots). */
  variant?: "strong" | "subtle";
  className?: string;
  as?: ElementType;
}

export function DotShiftBg({
  children,
  variant = "strong",
  className = "",
  as: Tag = "div",
}: DotShiftBgProps) {
  const cls = variant === "subtle" ? "dot-shift-bg-subtle" : "dot-shift-bg-strong";
  return <Tag className={`${cls} ${className}`}>{children}</Tag>;
}

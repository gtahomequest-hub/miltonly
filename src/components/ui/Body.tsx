import type { ReactNode, ElementType } from "react";

interface BodyProps {
  children: ReactNode;
  className?: string;
  variant?: "base" | "lead";
  as?: ElementType;
}

export function Body({
  children,
  className = "",
  variant = "base",
  as: Tag = "p",
}: BodyProps) {
  const cls = variant === "lead" ? "body-lead" : "body-base";
  return <Tag className={`${cls} ${className}`}>{children}</Tag>;
}

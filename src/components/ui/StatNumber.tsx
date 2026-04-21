import type { ReactNode, ElementType } from "react";

interface StatNumberProps {
  children: ReactNode;
  className?: string;
  size?: "sm" | "md" | "lg";
  as?: ElementType;
  /** Optional inline color override (e.g. on dark panels use #fff). */
  color?: string;
}

const SIZE: Record<NonNullable<StatNumberProps["size"]>, string> = {
  sm: "stat-number-sm",
  md: "stat-number-md",
  lg: "stat-number-lg",
};

export function StatNumber({
  children,
  className = "",
  size = "lg",
  as: Tag = "span",
  color,
}: StatNumberProps) {
  return (
    <Tag
      className={`stat-number ${SIZE[size]} ${className}`}
      style={color ? { color } : undefined}
    >
      {children}
    </Tag>
  );
}

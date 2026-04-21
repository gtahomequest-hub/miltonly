import type { ReactNode, ElementType } from "react";

interface MonoLabelProps {
  children: ReactNode;
  className?: string;
  color?: "ink" | "faint" | "gold" | "blue" | "white";
  size?: "sm" | "md" | "lg";
  as?: ElementType;
}

const COLOR: Record<NonNullable<MonoLabelProps["color"]>, string> = {
  ink:   "var(--ink)",
  faint: "var(--ink-faint)",
  gold:  "var(--gold)",
  blue:  "var(--blue)",
  white: "#ffffff",
};
const SIZE: Record<NonNullable<MonoLabelProps["size"]>, string> = {
  sm: "mono-label-sm",
  md: "mono-label-md",
  lg: "mono-label-lg",
};

export function MonoLabel({
  children,
  className = "",
  color = "faint",
  size = "md",
  as: Tag = "span",
}: MonoLabelProps) {
  return (
    <Tag
      className={`mono-label ${SIZE[size]} ${className}`}
      style={{ color: COLOR[color] }}
    >
      {children}
    </Tag>
  );
}

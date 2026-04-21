import type { ReactNode } from "react";

interface EyebrowProps {
  children: ReactNode;
  className?: string;
  color?: "blue" | "gold" | "faint" | "ink" | "white";
  size?: "sm" | "md" | "lg";
}

const COLOR: Record<NonNullable<EyebrowProps["color"]>, string> = {
  blue:  "var(--blue)",
  gold:  "var(--gold)",
  faint: "var(--ink-faint)",
  ink:   "var(--ink)",
  white: "#ffffff",
};

const SIZE: Record<NonNullable<EyebrowProps["size"]>, string> = {
  sm: "mono-label-sm",
  md: "mono-label-md",
  lg: "mono-label-lg",
};

export function Eyebrow({
  children,
  className = "",
  color = "blue",
  size = "lg",
}: EyebrowProps) {
  return (
    <span
      className={`mono-label ${SIZE[size]} ${className}`}
      style={{ color: COLOR[color] }}
    >
      {children}
    </span>
  );
}

import type { ReactNode, ElementType, CSSProperties } from "react";

type Level = 1 | 2 | 3 | 4;
type Tone = "light" | "dark";

interface SerifHeadingProps {
  children: ReactNode;
  level: Level;
  /** Override the rendered HTML tag independently from the visual level. */
  as?: ElementType;
  /** `dark` uses white text — for navy / dark backgrounds. Default `light` uses var(--navy). */
  tone?: Tone;
  className?: string;
  id?: string;
}

const TAG: Record<Level, ElementType> = { 1: "h1", 2: "h2", 3: "h3", 4: "h4" };
const CLS: Record<Level, string> = {
  1: "serif-h1",
  2: "serif-h2",
  3: "serif-h3",
  4: "serif-h4",
};

export function SerifHeading({
  children,
  level,
  as,
  tone = "light",
  className = "",
  id,
}: SerifHeadingProps) {
  const Tag = as ?? TAG[level];
  const style: CSSProperties | undefined =
    tone === "dark" ? { color: "#ffffff" } : undefined;
  return (
    <Tag id={id} className={`${CLS[level]} ${className}`} style={style}>
      {children}
    </Tag>
  );
}

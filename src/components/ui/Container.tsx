import type { ReactNode } from "react";

interface ContainerProps {
  children: ReactNode;
  className?: string;
  as?: "div" | "section" | "article" | "header" | "footer" | "main" | "nav";
}

export function Container({ children, className = "", as: Tag = "div" }: ContainerProps) {
  return (
    <Tag className={`max-w-[1240px] mx-auto px-5 sm:px-8 ${className}`}>
      {children}
    </Tag>
  );
}

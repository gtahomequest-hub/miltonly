import Link from "next/link";
import { Container } from "@/components/ui";
import type { PatternBlockProps } from "@/types/street";

export function PatternBlock({ eyebrow, headline, body, ctas }: PatternBlockProps) {
  return (
    <section className="border-b" style={{ paddingTop: 96, paddingBottom: 96, borderColor: "var(--line)" }}>
      <Container>
        <div className="pattern-block">
          <div className="pattern-block-eyebrow">{eyebrow}</div>
          <h2 className="pattern-block-headline">{headline}</h2>
          <p className="pattern-block-body">{body}</p>
          <div className="pattern-ctas">
            {ctas.map((c, i) => (
              <Link key={i} href={c.href} className="pattern-cta">
                <span className="pattern-cta-label">{c.label}</span>
                <span className="pattern-cta-title">{c.title}</span>
              </Link>
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}


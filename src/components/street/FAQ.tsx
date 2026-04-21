import { Container, SerifHeading, Eyebrow } from "@/components/ui";
import type { FAQProps } from "@/types/street";

export function FAQ({ faqs }: FAQProps) {
  if (faqs.length === 0) return null;

  return (
    <section id="s10" className="border-b" style={{ paddingTop: 96, paddingBottom: 96, borderColor: "var(--line)" }}>
      <Container>
        <Eyebrow color="blue" size="lg" className="block mb-3">Common questions</Eyebrow>
        <SerifHeading level={2}>
          What people <em>actually ask</em>
        </SerifHeading>

        <div className="faq-list">
          {faqs.map((item, i) => (
            <details key={i} className="faq-item" open>
              <summary>{item.question}</summary>
              <div className="answer">{item.answer}</div>
            </details>
          ))}
        </div>
      </Container>
    </section>
  );
}


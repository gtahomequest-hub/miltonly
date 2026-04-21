import { SerifHeading, Body } from "@/components/ui";
import type { DescriptionBodyProps } from "@/types/street";

export function DescriptionBody({
  sections,
  faq,
  inlineSlot,
  inlineSlotAfter = 1,
}: DescriptionBodyProps) {
  // `faq` is the full 8-section output's FAQ array; consumed by the page-level
  // FAQ component rather than rendered here. Referenced to satisfy the prop
  // contract and to keep future inline-FAQ rendering cheap to add.
  void faq;

  return (
    <div className="description-body">
      {sections.map((sec, i) => (
        <div key={sec.id}>
          <div className="section-heading-block" id={sec.id}>
            <SerifHeading level={3}>{sec.heading}</SerifHeading>
          </div>
          {sec.paragraphs.map((p, j) => (
            <Body key={j} variant="lead">{p}</Body>
          ))}
          {i === inlineSlotAfter && inlineSlot ? inlineSlot : null}
        </div>
      ))}
    </div>
  );
}

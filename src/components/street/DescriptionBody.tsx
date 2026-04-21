import { SerifHeading, Body } from "@/components/ui";
import type { DescriptionBodyProps } from "@/types/street";

export function DescriptionBody({
  sections,
  bestFitFor,
  differentPriorities,
  inlineSlot,
  inlineSlotAfter = 1,
}: DescriptionBodyProps) {
  return (
    <div className="description-body">
      {sections.map((sec, i) => (
        <div key={sec.id ?? i}>
          <div className="section-heading-block" id={sec.id}>
            <SerifHeading level={3}>{sec.heading}</SerifHeading>
          </div>
          {sec.paragraphs.map((p, j) => (
            <Body key={j} variant="lead">{p}</Body>
          ))}
          {i === inlineSlotAfter && inlineSlot ? inlineSlot : null}
        </div>
      ))}

      {bestFitFor.length > 0 && (
        <>
          <div className="section-heading-block">
            <SerifHeading level={3}>Best fit for</SerifHeading>
          </div>
          <ul className="best-fit-list">
            {bestFitFor.map((item, i) => (
              <li key={i}>
                <strong>{item.strong}.</strong> {item.body}
              </li>
            ))}
          </ul>
        </>
      )}

      {differentPriorities.length > 0 && (
        <>
          <div className="section-heading-block">
            <SerifHeading level={3}>For different priorities</SerifHeading>
          </div>
          <ul className="diff-priorities-list">
            {differentPriorities.map((item, i) => (
              <li key={i}>
                <strong>{item.strong}.</strong> {item.body}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}


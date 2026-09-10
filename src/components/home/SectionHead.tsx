// src/components/home/SectionHead.tsx
// THE ONE STRUCTURAL DEVICE ON THIS PAGE, and the reason the layout does not read like
// every other brokerage homepage.
//
// A real estate homepage is normally a stack of centred card grids under centred titles.
// This site is an encyclopedia, so its homepage is set like one: each section is an ENTRY,
// carrying a monospace index number, a rule that runs the full width, and a heading set
// hard against the left margin with its standfirst beside it rather than beneath it. The
// index numbers are literal and sequential, which is only tolerable because the sections
// really are a fixed, ordered set.
//
// The rule + number + two-column head is repeated exactly, section after section, so the
// page reads as one document rather than as a series of imported widgets.
interface Props {
  index: string;
  title: string;
  standfirst?: string;
  /** a right-aligned link, e.g. "All 445 streets" */
  action?: { href: string; label: string };
}

export function SectionHead({ index, title, standfirst, action }: Props) {
  return (
    <div className="mh-head">
      <span className="mh-index" aria-hidden="true">
        {index}
      </span>
      <div className="mh-headmain">
        <h2>{title}</h2>
        {standfirst ? <p>{standfirst}</p> : null}
      </div>
      {action ? (
        <a className="mh-headaction" href={action.href}>
          {action.label}
        </a>
      ) : null}
    </div>
  );
}

export default SectionHead;

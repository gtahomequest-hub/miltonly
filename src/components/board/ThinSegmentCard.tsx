// src/components/board/ThinSegmentCard.tsx
// Reusable thin-segment treatment: never fake a number, never hide the segment.
// Lift it out into a bordered card, state the real count + why it's insufficient,
// and offer the human alternative (hand-picked comparables + valuation CTA).
// Used wherever a cell is suppressed (Board tabs now; style/type pages later).

interface Props {
  label: string; // "Milton North detached"
  count: number; // real sales count
  window: string; // widest window tried, e.g. "12 months"
  href?: string; // valuation CTA target
}

export function ThinSegmentCard({ label, count, window, href = '/sell' }: Props) {
  return (
    <div className="brd-thin">
      <div className="brd-thin-head">{label}</div>
      <p className="brd-thin-body">
        {count === 0 ? 'No sales' : count === 1 ? '1 sale' : `${count} sales`} in {window} — too thin
        for a reliable typical price. Valuing one of these means picking comparables by hand.
      </p>
      <a className="brd-thin-cta" href={href}>
        Get a grounded valuation →
      </a>
    </div>
  );
}

export default ThinSegmentCard;

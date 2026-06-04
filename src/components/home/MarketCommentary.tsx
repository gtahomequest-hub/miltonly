// src/components/home/MarketCommentary.tsx
import type { MarketCommentary as Commentary } from './types';

export function MarketCommentary({ commentary }: { commentary: Commentary }) {
  return (
    <section className="m-block" id="market">
      <div className="m-wrap">
        <div className="m-sechead">
          <span className="m-eyebrow">The market read</span>
          <h2>How Milton is trading</h2>
        </div>
        <div className="m-commentary">
          {commentary.paragraphs.map((p, i) => (
            <p key={i} className={i === 0 ? 'm-lead' : undefined}>
              {p}
            </p>
          ))}
          <div className="m-src">{commentary.source}</div>
        </div>
      </div>
    </section>
  );
}

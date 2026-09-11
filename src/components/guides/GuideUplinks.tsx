// src/components/guides/GuideUplinks.tsx
// The "Guides" block a street page or a hub carries. Server-rendered anchors, so the link
// sits in the HTML a crawler reads and in the HTML the battery's guide-links check reads.
// Self-contained CSS (no dependency on .street-v2 or .hub-v2 tokens) so the same block
// renders identically on either shell; the tokens are the site's own.
//
// The shape is a reading ledger rather than a card grid: one rule down the left, the
// guide's category in mono, the title in Fraunces, the dek beneath. Small on purpose.
import './guide-uplinks.css';
import type { GuideUplink } from '@/lib/guides/uplinks';

export function GuideUplinks({
  guides,
  context,
  variant,
}: {
  guides: GuideUplink[];
  /** The page these guides are read alongside: "Main Street East" or "Old Milton". */
  context: string;
  variant: 'street' | 'hub';
}) {
  if (guides.length === 0) return null;
  return (
    <section className={`g-up g-up-${variant}`} aria-labelledby="g-up-h">
      <div className="g-up-wrap">
        <div className="g-up-head">
          <span className="g-up-eyebrow">Guides</span>
          <h2 id="g-up-h">Read alongside {context}</h2>
        </div>
        <ol className="g-up-list">
          {guides.map((g, i) => (
            <li className="g-up-row" key={g.slug}>
              <span className="g-up-n">{String(i + 1).padStart(2, '0')}</span>
              <a className="g-up-link" href={g.href} data-guide={g.slug}>
                <span className="g-up-cat">{g.categoryLabel}</span>
                <span className="g-up-t">{g.title}</span>
                <span className="g-up-d">{g.dek}</span>
              </a>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export default GuideUplinks;

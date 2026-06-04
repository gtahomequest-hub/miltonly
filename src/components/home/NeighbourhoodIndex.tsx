// src/components/home/NeighbourhoodIndex.tsx
import type { NeighbourhoodCard } from './types';
import { fullPrice } from './format';

function Card({ n }: { n: NeighbourhoodCard }) {
  const silent = n.typicalPriceRounded === null;
  return (
    <a className="m-nhood" href={`/neighbourhoods/${n.slug}`}>
      <div className="m-nm">{n.name}</div>
      <div className="m-ch">{n.character}</div>
      <div className={`m-pr${silent ? ' m-silent' : ''}`}>
        {silent
          ? n.silentNote ?? 'typical price not stated — thin activity'
          : `typically ${fullPrice(n.typicalPriceRounded as number)}`}
      </div>
    </a>
  );
}

interface Props {
  items: NeighbourhoodCard[];
  total: number;
}

export function NeighbourhoodIndex({ items, total }: Props) {
  const urban = items.filter((n) => n.group === 'urban');
  const rural = items.filter((n) => n.group === 'rural');

  return (
    <section className="m-block" id="index" style={{ background: 'var(--m-bg-secondary)' }}>
      <div className="m-wrap">
        <div className="m-row-between">
          <div className="m-sechead" style={{ marginBottom: 0 }}>
            <span className="m-eyebrow">Twenty-four neighbourhoods</span>
            <h2>Milton, neighbourhood by neighbourhood</h2>
          </div>
          <a className="m-more" href="/neighbourhoods">
            View all {total} →
          </a>
        </div>

        {urban.length > 0 && (
          <>
            <div className="m-grouptag" style={{ marginTop: 30 }}>
              Urban hubs
            </div>
            <div className="m-grid">
              {urban.map((n) => (
                <Card key={n.slug} n={n} />
              ))}
            </div>
          </>
        )}

        {rural.length > 0 && (
          <>
            <div className="m-grouptag" style={{ marginTop: 34 }}>
              Rural areas
            </div>
            <div className="m-grid">
              {rural.map((n) => (
                <Card key={n.slug} n={n} />
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}

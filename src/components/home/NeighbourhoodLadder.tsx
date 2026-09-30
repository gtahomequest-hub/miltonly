// src/components/home/NeighbourhoodLadder.tsx
// Every published neighbourhood, as a LADDER rather than a card grid.
//
// WHY NOT CARDS. Every brokerage homepage in this market renders neighbourhoods as a
// grid of photo cards, which sorts alphabetically, hides the figures inside the tile,
// and makes twenty-two places look like twenty-two identical products. A ladder ranks
// them: one ruled row each, with a measure bar drawn to the top of the list.
//
// RANKED BY HOMES FOR SALE NOW (MC-046 R7, R9). The ladder was ordered by 12-month sales and
// carried each hub's sales count and typical sold price. All three are derived from sold
// records, and item 40 keeps them from a signed-out reader: the order alone would disclose
// where Milton trades most. The order, the bar and the one figure are now the hub's active
// listings, public IDX rows, and a tie reads A to Z (the loader sorts; this renders).
import type { HubCard } from './types';
import { SectionHead } from './SectionHead';

interface Props {
  neighbourhoods: HubCard[];
}

export function NeighbourhoodLadder({ neighbourhoods }: Props) {
  if (neighbourhoods.length === 0) return null;
  const maxActive = Math.max(...neighbourhoods.map((n) => n.activeCount), 1);

  return (
    <section className="mh-sec mh-hoods" id="neighbourhoods">
      <div className="m-wrap">
        <SectionHead
          index="03"
          title="Milton, neighbourhood by neighbourhood"
          standfirst="Every published neighbourhood, ordered by how many homes are for sale in it today."
          action={{ href: '/neighbourhoods', label: 'All neighbourhoods' }}
        />
        <ol className="mh-ladder">
          {neighbourhoods.map((n) => (
            <li key={n.slug}>
              <a href={`/neighbourhoods/${n.slug}`}>
                <span className="mh-ladname">{n.name}</span>
                <span className="mh-ladbar" aria-hidden="true">
                  <span style={{ width: `${Math.max(2, Math.round((n.activeCount / maxActive) * 100))}%` }} />
                </span>
                <span className="mh-ladactive" data-fig="nbhd-active" data-slug={n.slug} data-value={n.activeCount}>
                  {n.activeCount} <em>for sale</em>
                </span>
              </a>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export default NeighbourhoodLadder;

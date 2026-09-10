// src/components/home/NeighbourhoodLadder.tsx
// All 22 published neighbourhoods, as a LADDER rather than a card grid.
//
// WHY NOT CARDS. Every brokerage homepage in this market renders neighbourhoods as a
// grid of photo cards, which sorts alphabetically, hides the figures inside the tile,
// and makes twenty-two places look like twenty-two identical products. A ladder ranks
// them: one ruled row each, ordered by 12-month sales, with a measure bar drawn to the
// busiest hood. The ordering is the content — a reader learns where Milton actually
// trades before reading a single number, and the shape is honest because the bar is
// scaled to a real maximum rather than to the width of a card.
//
// THE PRICE IS THE HUB'S OWN. It comes from getNeighbourhoodCards, which runs the hub
// page's exact aggregate through the hub page's exact k-anon gate. A hood whose hub
// suppresses its price prints no price here either, on the same day, for the same
// reason, and says so rather than printing a zero. Suppression is stated, not hidden:
// "pool too thin to publish" is a fact about the market, and a reader who sees it learns
// something true about a rural hood with four sales a year.
import type { HubCard } from './types';
import { SectionHead } from './SectionHead';

interface Props {
  neighbourhoods: HubCard[];
}

const money = (n: number) => `$${n.toLocaleString('en-CA')}`;

export function NeighbourhoodLadder({ neighbourhoods }: Props) {
  if (neighbourhoods.length === 0) return null;
  const maxSales = Math.max(...neighbourhoods.map((n) => n.salesCount), 1);

  return (
    <section className="mh-sec mh-hoods" id="neighbourhoods">
      <div className="m-wrap">
        <SectionHead
          index="03"
          title="Milton, neighbourhood by neighbourhood"
          standfirst="Every published neighbourhood, ordered by how much it actually trades. The price is the same 12-month typical each hub page publishes, suppressed below five sales."
          action={{ href: '/neighbourhoods', label: 'All neighbourhoods' }}
        />
        <ol className="mh-ladder">
          {neighbourhoods.map((n) => (
            <li key={n.slug}>
              <a href={`/neighbourhoods/${n.slug}`}>
                <span className="mh-ladname">{n.name}</span>
                <span className="mh-ladbar" aria-hidden="true">
                  <span style={{ width: `${Math.max(2, Math.round((n.salesCount / maxSales) * 100))}%` }} />
                </span>
                <span className="mh-ladsales">
                  {n.salesCount} <em>sold</em>
                </span>
                <span
                  className="mh-ladprice"
                  data-fig="nbhd-typical"
                  data-slug={n.slug}
                  data-value={n.typicalSoldPrice ?? ''}
                >
                  {n.typicalSoldPrice !== null ? (
                    money(n.typicalSoldPrice)
                  ) : (
                    <em className="mh-ladsilent">pool too thin to publish</em>
                  )}
                </span>
                <span className="mh-ladactive" data-fig="nbhd-active" data-slug={n.slug} data-value={n.activeCount}>
                  {n.activeCount} <em>active</em>
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

// src/components/home/NewestListings.tsx
// The newest active sale listings.
//
// TWO THINGS MAKE THIS DIFFERENT FROM THE STANDARD HOMEPAGE LISTING GRID, and both are
// deliberate:
//
//   1. EVERY CARD CARRIES THREE LINKS, not one. A listing card that links only to itself
//      is a dead end for a crawler and a dead end for a reader who does not want that
//      house: the address goes to the listing, the neighbourhood goes to its hub. Six
//      cards therefore contribute up to eighteen internal links to pages we own, instead
//      of six links to pages that expire.
//   2. THE ADDRESS IS ALREADY GATED. These cards come from getNewestListingCards, which
//      runs the same server-side RECO/IDX display gate the listings grid uses, so a
//      withheld address arrives here as "Address withheld by seller" and never as a
//      street address the client could reveal.
import type { ListingCardData } from '@/components/listings/v2/types';
import { SectionHead } from './SectionHead';

interface Props {
  listings: ListingCardData[];
  newThisWeek: number;
}

/** TREB stores "1035 - OM Old Milton". The hub link needs the clean name and slug. */
function hood(raw: string): { label: string; slug: string } {
  const cleaned = raw.replace(/^\d+\s*-\s*\w+\s+/, '').trim();
  const label = cleaned
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
  return { label, slug: cleaned.toLowerCase().replace(/\s+/g, '-') };
}

const money = (n: number) => `$${n.toLocaleString('en-CA')}`;

function daysSince(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));
}

export function NewestListings({ listings, newThisWeek }: Props) {
  if (listings.length === 0) return null;
  return (
    <section className="mh-sec mh-listings" id="newest">
      <div className="m-wrap">
        <SectionHead
          index="02"
          title="Newest on the market"
          standfirst={`${newThisWeek} Milton homes came to market in the last seven days. These are the most recent, newest first.`}
          action={{ href: '/listings', label: 'All listings' }}
        />
        <ul className="mh-cards">
          {listings.map((l) => {
            const h = hood(l.neighbourhood);
            const d = daysSince(l.listedAt);
            return (
              <li key={l.mlsNumber} className="mh-card">
                <a className="mh-cardphoto" href={`/listings/${l.mlsNumber}`} tabIndex={-1} aria-hidden="true">
                  {l.photos[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={l.photos[0]} alt="" loading="lazy" width={400} height={260} />
                  ) : (
                    <span className="mh-nophoto" />
                  )}
                </a>
                <div className="mh-cardbody">
                  <span className="mh-cardprice">{money(l.price)}</span>
                  <a className="mh-cardaddr" href={`/listings/${l.mlsNumber}`}>
                    {l.address}
                  </a>
                  <span className="mh-cardmeta">
                    {l.bedrooms} bed · {l.bathrooms} bath · {l.propertyType}
                  </span>
                  <span className="mh-cardfoot">
                    <a href={`/neighbourhoods/${h.slug}`}>{h.label}</a>
                    <span className="mh-carddays">{d === 0 ? 'Listed today' : `${d} days on market`}</span>
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

export default NewestListings;

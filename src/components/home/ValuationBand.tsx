// src/components/home/ValuationBand.tsx
// The valuation form, and the claims that earn it the space.
//
// A form is not indexable content, so the prose beside it has to do the work. The proof
// points are therefore not adjectives: each is a LIVE FIGURE, and each sentence describes
// exactly the set its figure counts.
//
// "738 Milton streets with their own page" once counted `surfacedStreetWhere()`, the set
// allowed to appear in search and in a hub ladder, while 444 had a page. The count now comes
// from publishedStreetPageCount(), the same set src/app/sitemap.ts emits.
//
// THE SALES COUNT AND SOLD-TO-ASK LEFT WITH MC-046 (R7). Both were aggregates of sold records,
// and item 40 keeps every value derived from them from a signed-out reader. What stays is
// public: the pages this site has published and the streets it has filmed.
//
// The form itself is HomeValuationCard, the only component in this repo with a proven
// conversion record: CASL consent text snapshotted at submit, honeypot, phone formatting,
// GA4 generate_lead, and the one ingest path behind it. It is reused whole, in its forest theme,
// with a homepage source tag.
import HomeValuationCard from '@/components/landing/HomeValuationCard';
import { SectionHead } from './SectionHead';

interface Props {
  /** published street PAGES, from the sitemap's set */
  streetPageCount: number;
  videoCount: number;
}

export function ValuationBand({ streetPageCount, videoCount }: Props) {
  // Only proof points with a live figure behind them render. A claim with no figure is
  // dropped rather than softened into an adjective.
  const proof: { fig: string; figure: string; label: string }[] = [
    {
      fig: 'proof-street-pages',
      figure: streetPageCount.toLocaleString('en-CA'),
      label: 'Milton street pages published, each one researched and kept current',
    },
  ];
  if (videoCount > 0) {
    proof.push({
      fig: 'proof-video-count',
      figure: videoCount.toLocaleString('en-CA'),
      label: 'streets filmed end to end, so a valuation starts from the street itself',
    });
  }

  return (
    <section className="mh-sec mh-value" id="valuation">
      <div className="m-wrap">
        <SectionHead
          index="04"
          title="What your home is worth, in writing"
          standfirst="Aamir reads the comparable sales on your street, not a national model's guess at your postal code. A written valuation, within 24 hours, no obligation."
        />
        <div className="mh-valuegrid">
          <ol className="mh-proof">
            {proof.map((p) => (
              <li key={p.fig}>
                <span className="mh-prooffig" data-fig={p.fig} data-value={p.figure}>
                  {p.figure}
                </span>
                <span className="mh-prooflabel">{p.label}</span>
              </li>
            ))}
          </ol>
          <div className="mh-valueform">
            <HomeValuationCard
              mlsNumber=""
              source="homepage-valuation"
              theme="forest"
              kicker="Free valuation, no obligation"
              title="What's your Milton home worth?"
              ctaLabel="Get my home's value"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

export default ValuationBand;

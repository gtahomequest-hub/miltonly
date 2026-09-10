// src/components/home/ValuationBand.tsx
// The valuation form, and the three claims that earn it the space.
//
// A form is not indexable content, so the prose beside it has to do the work. The three
// proof points are therefore not adjectives: each is a LIVE FIGURE from the same seam the
// rest of the page reads, and each names what it counts. A homepage that says "trusted"
// says nothing; one that says "445 street pages, 1,531 sales tracked, 98.1% sold to ask"
// hands the reader something they can check on the very next page.
//
// The form itself is HomeValuationCard, the only component in this repo with a proven
// conversion record: CASL consent text snapshotted at submit, honeypot, phone formatting,
// GA4 generate_lead, and /api/leads behind it. It is reused whole, in its forest theme,
// with a homepage source tag. Nothing about the submit pipeline is re-implemented here.
import HomeValuationCard from '@/components/landing/HomeValuationCard';
import { SectionHead } from './SectionHead';

interface Props {
  streetCount: number;
  sold12mo: number;
  soldToAsk: number | null;
  videoCount: number;
}

export function ValuationBand({ streetCount, sold12mo, soldToAsk, videoCount }: Props) {
  // Only proof points with a live figure behind them render. A claim with a null figure
  // is dropped rather than softened into an adjective.
  const proof: { figure: string; label: string }[] = [
    { figure: streetCount.toLocaleString('en-CA'), label: 'Milton streets with their own page, each one researched' },
    { figure: sold12mo.toLocaleString('en-CA'), label: 'sales tracked over the last 12 months, the basis of every figure here' },
  ];
  if (soldToAsk !== null) {
    proof.push({ figure: `${soldToAsk}%`, label: 'of asking, what Milton homes are actually closing at right now' });
  } else if (videoCount > 0) {
    proof.push({ figure: videoCount.toLocaleString('en-CA'), label: 'streets filmed end to end, so a valuation starts from the street itself' });
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
              <li key={p.label}>
                <span className="mh-prooffig">{p.figure}</span>
                <span className="mh-prooflabel">{p.label}</span>
              </li>
            ))}
          </ol>
          <div className="mh-valueform">
            <HomeValuationCard
              mlsNumber=""
              source="homepage-valuation"
              theme="forest"
              kicker="Free valuation — no obligation"
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
